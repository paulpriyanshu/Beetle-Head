// ==========================================
// AGENT MANAGER — Multi-Source Research Agent
// ==========================================

let shouldStopAgent = false;

export function stopAgentLoop() {
    shouldStopAgent = true;
}

// ==========================================
// MAIN LOOP
// ==========================================

export async function startAgentLoop(tabId, goal, history = []) {
    shouldStopAgent = false;
    const MAX_STEPS = 10; // Human-like: search → read → navigate → done

    const tab = await chrome.tabs.get(tabId);
    if (!tab.url || /^(chrome|edge|about|chrome-extension):/.test(tab.url)) {
        broadcastStatus("❌ Cannot run on system pages.");
        return { success: false, error: "Restricted page" };
    }

    await injectAgentScripts(tabId);

    // Track researched pages for final summary
    const researchLog = [];

    // Hard per-tool limits — forces linear phase progression
    const toolUseCounts = {};
    const TOOL_LIMITS = { search_google: 1, search_youtube: 1, open_urls_in_background: 2, navigate_to: 1 };


    try {
        for (let step = 0; step < MAX_STEPS; step++) {
            if (shouldStopAgent) {
                broadcastStatus("Agent stopped.");
                return { success: false, error: "Stopped by user" };
            }

            broadcastStatus(`Step ${step + 1}…`);

            // 1. Capture & compress DOM state
            const rawState = await captureAgentState(tabId);
            if (!rawState) throw new Error("Failed to capture page state");

            const domState = {
                ...rawState,
                pageContent: truncate(rawState.pageContent, 2000),
                interactables: (rawState.interactables || []).slice(0, 30),
                search_results: (rawState.search_results || []).slice(0, 10),
            };

            // 2. Ask backend with compressed history (avoid context overload)
            const decision = await fetchAgentDecision(goal, domState, compressHistory(history), rawState.url);
            if (decision.status === "error") throw new Error(decision.message);

            const { tool_call: toolCall, message } = decision;
            if (message) history.push({ role: "assistant", content: message });

            if (!toolCall) { await delay(600); continue; }

            // Enforce tool-use limits — force linear progression
            if (toolCall.name in TOOL_LIMITS) {
                const count = (toolUseCounts[toolCall.name] || 0);
                if (count >= TOOL_LIMITS[toolCall.name]) {
                    broadcastStatus(`⚠️ ${toolCall.name} limit reached, move to next phase…`);
                    history.push({ role: "system", content: `SYSTEM: ${toolCall.name} already used ${count} time(s). Proceed to next phase.` });
                    continue;
                }
                toolUseCounts[toolCall.name] = count + 1;
            }

            broadcastStatus(`🛠 ${toolCall.name}`);

            // ==== DONE ====
            if (toolCall.name === "done") {
                const summary = buildFinalSummary(toolCall.args?.summary, researchLog);
                broadcastStatus("✅ Research complete");
                return { success: true, summary };
            }

            // ==== GOOGLE SEARCH ====
            if (toolCall.name === "search_google") {
                const query = toolCall.args.query;
                broadcastStatus(`🔍 Searching Google: "${query}"`);
                const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
                await chrome.tabs.update(tabId, { url: searchUrl });
                await waitForTabLoad(tabId);
                await delay(800);
                await injectAgentScripts(tabId);
                history.push({ role: "system", content: `Searched Google for: "${query}"\nURL: ${searchUrl}` });
                continue;
            }

            // ==== YOUTUBE SEARCH ====
            if (toolCall.name === "search_youtube") {
                const query = toolCall.args.query;
                broadcastStatus(`🎥 Searching YouTube: "${query}"`);
                const ytUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
                const ytTab = await chrome.tabs.create({ url: ytUrl, active: false });
                await waitForTabLoad(ytTab.id);
                await delay(800);

                // Scrape video results from the YouTube results page
                const videos = await scrapeYouTubeResults(ytTab.id);
                chrome.tabs.remove(ytTab.id).catch(() => { });

                if (videos.length > 0) {
                    videos.forEach(v => researchLog.push({ type: "youtube", ...v }));
                    history.push({
                        role: "system",
                        content: `YouTube results for "${query}":\n\n${videos.map(
                            (v, i) => `[${i + 1}] ${v.title}\n${v.url}`
                        ).join("\n\n")}`
                    });
                } else {
                    history.push({ role: "system", content: `YouTube search returned no readable results for "${query}".` });
                }
                continue;
            }

            // ==== OPEN URLS IN BACKGROUND ====
            if (toolCall.name === "open_urls_in_background") {
                const summaries = await readUrlsInBackground(toolCall.args.urls);
                summaries.forEach(s => researchLog.push({ type: "web", ...s }));
                history.push({
                    role: "system",
                    content: `Read ${summaries.length} pages:\n\n${summaries.map(
                        (s, i) => `[${i + 1}] ${s.title}\n${s.url}\n${s.snippet}`
                    ).join("\n\n")}`
                });
                continue;
            }

            // ==== NAVIGATE TO ====
            if (toolCall.name === "navigate_to") {
                broadcastStatus(`🌐 Navigating to ${toolCall.args.url}…`);
                await chrome.tabs.update(tabId, { url: toolCall.args.url });
                await waitForTabLoad(tabId);
                await delay(1000);
                await injectAgentScripts(tabId);

                const pageText = await readCurrentPageText(tabId);
                const { title, url } = parsePageText(pageText);
                researchLog.push({ type: "web", title, url, snippet: truncate(pageText, 300) });

                history.push({
                    role: "system",
                    content: `Navigated to: ${toolCall.args.url}\n\nPage content:\n${pageText}`
                });
                continue;
            }

            // ==== OTHER TOOLS (click, type, scroll, read_page_content) ====
            const result = await executeAgentTool(tabId, toolCall);

            if (toolCall.name === "read_page_content" && result?.content) {
                history.push({
                    role: "system",
                    content: `Page: "${result.title}"\n\n${truncate(result.content, 4000)}`
                });
            } else {
                history.push({
                    role: "system",
                    content: `Tool '${toolCall.name}' result: ${JSON.stringify(result)}`
                });
            }

            if (toolCall.name === "type_text" && result?.submitted) {
                await waitForTabLoad(tabId);
                await delay(1000);
                await injectAgentScripts(tabId);
            }

            await delay(600);
        }
    } catch (err) {
        broadcastStatus("❌ " + err.message);
        return { success: false, error: err.message };
    }

    return { success: false, error: "Max steps reached" };
}

// ==========================================
// FINAL SUMMARY BUILDER
// Merges agent's LLM summary with the research log links
// ==========================================

function buildFinalSummary(llmSummary, researchLog) {
    const webPages = researchLog.filter(r => r.type === "web" && r.url);
    const videos = researchLog.filter(r => r.type === "youtube" && r.url);

    let linkSection = "";

    if (webPages.length > 0) {
        linkSection += "\n\n### 🔗 Web Sources\n" +
            webPages.map(p => `- [${p.title || p.url}](${p.url})`).join("\n");
    }

    if (videos.length > 0) {
        linkSection += "\n\n### 🎥 YouTube\n" +
            videos.map(v => `- [${v.title || v.url}](${v.url})`).join("\n");
    }

    return (llmSummary || "Research complete.") + linkSection;
}

// ==========================================
// MULTI-URL READER (background tabs)
// ==========================================

async function readUrlsInBackground(urls) {
    broadcastStatus(`📖 Reading ${urls.length} pages…`);
    const results = [];

    for (const url of urls) {
        let tab = null;
        try {
            tab = await chrome.tabs.create({ url, active: false });
            await waitForTabLoad(tab.id);
            await delay(500);

            const [res] = await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: () => ({
                    title: document.title,
                    url: window.location.href,
                    snippet: document.body?.innerText?.replace(/\s+/g, " ").slice(0, 1500) || ""
                })
            });
            if (res?.result) results.push(res.result);
        } catch (e) {
            results.push({ title: "Error", url, snippet: "Could not read page." });
        } finally {
            if (tab) chrome.tabs.remove(tab.id).catch(() => { });
        }
    }
    return results;
}

// ==========================================
// YOUTUBE RESULTS SCRAPER
// ==========================================

async function scrapeYouTubeResults(tabId) {
    try {
        const [res] = await chrome.scripting.executeScript({
            target: { tabId },
            func: () => {
                const items = document.querySelectorAll("ytd-video-renderer, ytd-compact-video-renderer");
                return Array.from(items).slice(0, 5).map(el => {
                    const titleEl = el.querySelector("#video-title");
                    const href = titleEl?.getAttribute("href") || "";
                    return {
                        title: titleEl?.textContent?.trim() || "YouTube Video",
                        url: href ? `https://www.youtube.com${href}` : ""
                    };
                }).filter(v => v.url);
            }
        });
        return res?.result || [];
    } catch {
        return [];
    }
}

// ==========================================
// READ CURRENT PAGE TEXT
// ==========================================

async function readCurrentPageText(tabId) {
    try {
        const [res] = await chrome.scripting.executeScript({
            target: { tabId },
            func: () => ({
                title: document.title,
                url: window.location.href,
                text: document.body?.innerText?.replace(/\s+/g, " ").slice(0, 3000) || ""
            })
        });
        const { title, url, text } = res?.result || {};
        return `Title: ${title}\nURL: ${url}\n\n${text}`;
    } catch {
        return "(Could not read page)";
    }
}

function parsePageText(text) {
    const titleMatch = text.match(/^Title: (.+)/m);
    const urlMatch = text.match(/^URL: (.+)/m);
    return {
        title: titleMatch?.[1] || "Unknown",
        url: urlMatch?.[1] || ""
    };
}

// ==========================================
// CORE HELPERS
// ==========================================

async function injectAgentScripts(tabId) {
    await chrome.scripting.executeScript({
        target: { tabId },
        files: ["dom/domObserver.js", "features/toolExecutor.js"],
    });
}

async function captureAgentState(tabId) {
    for (let i = 0; i < 3; i++) {
        try {
            const [res] = await chrome.scripting.executeScript({
                target: { tabId },
                func: () => window.DOMObserver?.captureState() ?? { error: "DOMObserver missing" }
            });
            if (res?.result?.error) throw new Error(res.result.error);
            if (res?.result) return res.result;
        } catch (e) {
            await injectAgentScripts(tabId);
            await delay(1500);
        }
    }
    return null;
}

async function executeAgentTool(tabId, toolCall) {
    const [res] = await chrome.scripting.executeScript({
        target: { tabId },
        func: (name, args) => window.ToolExecutor.execute({ name, args }),
        args: [toolCall.name, toolCall.args],
    });
    return res?.result;
}

async function fetchAgentDecision(goal, domState, history, currentUrl) {
    try {
        const res = await fetch("http://localhost:8000/agent/step", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ goal, dom_state: domState, history, current_url: currentUrl }),
        });
        return await res.json();
    } catch (e) {
        return { status: "error", message: e.message };
    }
}

function waitForTabLoad(tabId) {
    return new Promise(resolve => {
        chrome.tabs.get(tabId, tab => {
            if (chrome.runtime.lastError || !tab || tab.status === "complete") return resolve();
            const listener = (tid, info) => {
                if (tid === tabId && info.status === "complete") {
                    chrome.tabs.onUpdated.removeListener(listener);
                    resolve();
                }
            };
            chrome.tabs.onUpdated.addListener(listener);
            setTimeout(() => { chrome.tabs.onUpdated.removeListener(listener); resolve(); }, 15000);
        });
    });
}

function broadcastStatus(msg) {
    chrome.runtime.sendMessage({ type: "SYSTEM_STATUS", text: msg }).catch(() => { });
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }
function truncate(text = "", max = 2000) { return text.length > max ? text.slice(0, max) + "…" : text; }

// Keep history lean — trim old/large entries so LLM doesn't get overwhelmed
function compressHistory(history) {
    // Keep last 12 entries max
    const recent = history.slice(-12);
    return recent.map(msg => {
        if (msg.role === "system" && msg.content.length > 600) {
            return { ...msg, content: msg.content.slice(0, 600) + "… [truncated]" };
        }
        return msg;
    });
}