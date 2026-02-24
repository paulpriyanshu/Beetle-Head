// ==========================================
// AGENT MANAGER - Orchestrates the Agent Loop
// ==========================================

export async function startAgentLoop(tabId, goal, history = []) {
    console.log(`🤖 Starting Agent Loop for tab ${tabId} with goal: "${goal}"`);

    // 0. Security Check
    const tab = await chrome.tabs.get(tabId);
    if (!tab.url || tab.url.startsWith("chrome://") || tab.url.startsWith("edge://") || tab.url.startsWith("about:") || tab.url.startsWith("chrome-extension://")) {
        broadcastStatus("❌ Cannot run on system pages. Please navigate to a website.");
        return { success: false, error: "Restricted Page" };
    }

    // 1. Inject Dependencies
    await injectAgentScripts(tabId);

    let stepCount = 0;
    const maxSteps = 20;

    try {
        while (stepCount < maxSteps) {
            stepCount++;
            console.log(`🔄 Agent Step ${stepCount}/${maxSteps}`);

            // 2. Capture State
            console.log("📸 Capturing DOM state...");
            const state = await captureAgentState(tabId);
            if (!state) throw new Error("Failed to capture state");
            console.log("✅ State captured:", state.url);

            // 3. Send to Backend
            const decision = await fetchAgentDecision(goal, state, history, state.url);

            console.log("🧠 Agent Decision:", decision);
            console.log("  - Status:", decision.status);
            console.log("  - Tool Call:", decision.tool_call);
            console.log("  - Message:", decision.message);

            if (decision.status === "error") {
                throw new Error(decision.message);
            }

            const toolCall = decision.tool_call;
            const message = decision.message;

            console.log("📋 Extracted - ToolCall:", toolCall, "Message:", message);

            // Update History
            if (message) {
                history.push({ role: "assistant", content: message });
            }
            console.log("✓ Checkpoint 1: History updated");

            if (!toolCall) {
                console.log("No tool call, agent might be thinking or done.");
                if (message && message.toLowerCase().includes("done")) {
                    break;
                }
                continue;
            }
            console.log("✓ Checkpoint 2: ToolCall exists, name =", toolCall.name);

            if (toolCall.name === "navigate_to") {
                console.log("🧭 Navigating to:", toolCall.args.url);
                broadcastStatus(`Navigating to ${toolCall.args.url}...`);

                await chrome.tabs.update(tabId, { url: toolCall.args.url });

                // Wait for navigation to complete
                await waitForTabLoad(tabId);

                // Reduced stabilization delay
                await new Promise(r => setTimeout(r, 800));

                // Re-inject dependencies
                await injectAgentScripts(tabId);

                // Add to history
                history.push({
                    role: "system",
                    content: `Navigated to ${toolCall.args.url}`
                });

                continue; // Skip standard tool execution for this step
            }
            console.log("✓ Checkpoint 3: Not navigate_to, proceeding to execute");

            // 4. Execute Tool
            console.log(`🛠️ About to execute tool: ${toolCall.name} with args:`, toolCall.args);
            const result = await executeAgentTool(tabId, toolCall);
            console.log("⚡ Tool Result:", result);

            // Add tool execution result to history
            if (toolCall.name === "read_page_content" && result.content) {
                // For read_page_content, pass the actual content to the agent
                history.push({
                    role: "system",
                    content: `Page Content: "${result.title}"\n\n${result.content}\n\n(${result.wordCount} words)`
                });
            } else {
                // For other tools, just describe the action
                history.push({
                    role: "system",
                    content: `Tool '${toolCall.name}' Executed. Result: ${JSON.stringify(result)}`
                });
            }

            // If type_text auto-submitted a search, wait for page to load new results
            if (toolCall.name === "type_text" && result.submitted) {
                console.log("🔍 Search submitted, waiting for results...");

                // Wait for page navigation to complete (like navigate_to)
                await waitForTabLoad(tabId);
                await new Promise(r => setTimeout(r, 1000)); // Stabilization delay

                // Re-inject scripts on new page
                await injectAgentScripts(tabId);
            }

            if (toolCall.name === "done") {
                console.log("🎉 Agent completed the task!");
                broadcastStatus("Agent Finished: " + (toolCall.args.summary || "Success"));
                return { success: true, summary: toolCall.args.summary };
            }

            // Reduced wait for page to settle
            await new Promise(r => setTimeout(r, 800));
        }
    } catch (err) {
        console.error("❌ Agent Loop Error:", err);
        broadcastStatus("Agent Error: " + err.message);
        return { success: false, error: err.message };
    }
}

async function injectAgentScripts(tabId) {
    await chrome.scripting.executeScript({
        target: { tabId },
        files: ['dom/domObserver.js', 'features/toolExecutor.js']
    });
}

async function captureAgentState(tabId) {
    // Retry logic
    for (let i = 0; i < 3; i++) {
        try {
            const results = await chrome.scripting.executeScript({
                target: { tabId },
                func: () => {
                    if (!window.DOMObserver) return { error: "DOMObserver not found" };
                    try {
                        return window.DOMObserver.captureState();
                    } catch (e) {
                        return { error: "Capture threw: " + e.message };
                    }
                }
            });

            if (results && results[0] && results[0].result) {
                const res = results[0].result;
                if (res.error) {
                    // console.warn("⚠️ Content script verification failed:", res.error);
                    // Throw to trigger retry logic
                    throw new Error(res.error);
                }
                return res;
            }

            console.log("⚠️ State capture failed (null result), retrying injection...");
            await injectAgentScripts(tabId);
            await new Promise(r => setTimeout(r, 1000));

        } catch (e) {
            console.warn(`⚠️ State capture attempt ${i + 1} failed:`, e);
            console.log("♻️ Re-injecting scripts and retrying...");
            try {
                await injectAgentScripts(tabId);
            } catch (injectErr) {
                console.error("Injection failed:", injectErr);
            }
            await new Promise(r => setTimeout(r, 2000)); // Longer wait after injection
        }
    }
    return null;
}

async function executeAgentTool(tabId, toolCall) {
    const results = await chrome.scripting.executeScript({
        target: { tabId },
        func: (name, args) => window.ToolExecutor.execute({ name, args }),
        args: [toolCall.name, toolCall.args]
    });
    return results[0]?.result;
}

async function fetchAgentDecision(goal, domState, history, currentUrl) {
    try {
        const response = await fetch('http://localhost:8000/agent/step', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                goal: goal,
                dom_state: domState,
                history: history,
                current_url: currentUrl
            })
        });
        return await response.json();
    } catch (e) {
        console.error("API Error:", e);
        return { status: "error", message: e.message };
    }
}

function broadcastStatus(msg) {
    chrome.runtime.sendMessage({
        type: "SYSTEM_STATUS",
        text: msg
    }).catch(() => { });
}

function waitForTabLoad(tabId) {
    return new Promise(resolve => {
        chrome.tabs.get(tabId, tab => {
            if (chrome.runtime.lastError || !tab) return resolve();
            if (tab.status === 'complete') return resolve();

            const listener = (tid, changeInfo) => {
                if (tid === tabId && changeInfo.status === 'complete') {
                    chrome.tabs.onUpdated.removeListener(listener);
                    resolve();
                }
            };
            chrome.tabs.onUpdated.addListener(listener);

            setTimeout(() => {
                chrome.tabs.onUpdated.removeListener(listener);
                resolve();
            }, 15000);
        });
    });
}
