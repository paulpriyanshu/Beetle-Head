// ==================================================
// DOM ELEMENTS
// ==================================================

const input = document.getElementById("siteInput");
const sendBtn = document.getElementById("sendBtn");
const messages = document.getElementById("messages");
const agentToggle = document.getElementById("agentModeToggle");
const debugPanel = document.getElementById("debugPanel");

// APIs
const CHAT_API = "http://127.0.0.1:8000/generate/stream";
const AGENT_API = "http://127.0.0.1:8000/agent/stream";

// ==================================================
// GLOBAL STATE
// ==================================================

let agentMode = false;
let autoScroll = true;
let isUserScrolling = false;
let currentPageContent = null;

// ==================================================
// SIMPLIFIED PAGE CONTENT READING - Direct HTML Injection
// ==================================================
function isRestrictedChromePage(url) {
  return url.startsWith("chrome://") ||
         url.startsWith("edge://") ||
         url.startsWith("about:");
}

function normalizePageContent(raw) {
  return {
    url: raw.url,
    title: raw.title,
    description: raw.description,
    pageType: raw.isEcommerce ? "ecommerce" : "article",
    mainContent: [
      raw.mainHeading,
      raw.bodyText
    ].filter(Boolean).join("\n\n").slice(0, 6000),

    products: raw.productInfo
      ? [{
          title: raw.productInfo.title,
          price: raw.productInfo.price,
          platform: raw.productInfo.platform
        }]
      : null
  };
}
async function getCurrentPageContent() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    log("📄 Reading page HTML from tab: " + tab.id, "info");
    
    // Execute script directly in the page to extract content
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        // This function runs in the context of the web page
        const content = {
          url: window.location.href,
          title: document.title,
          
          // Get meta description
          description: (() => {
            const meta = document.querySelector('meta[name="description"]') || 
                        document.querySelector('meta[property="og:description"]');
            return meta ? meta.content : '';
          })(),
          
          // Get all text content
          fullHTML: document.documentElement.outerHTML,
          
          // Get clean text from body
          bodyText: (() => {
            const body = document.body.cloneNode(true);
            // Remove scripts, styles, etc
            const unwanted = body.querySelectorAll('script, style, noscript, iframe');
            unwanted.forEach(el => el.remove());
            return body.innerText.replace(/\s+/g, ' ').trim().substring(0, 8000);
          })(),
          
          // Get main heading
          mainHeading: (() => {
            const h1 = document.querySelector('h1');
            return h1 ? h1.textContent.trim() : '';
          })(),
          
          // Get all headings
          headings: Array.from(document.querySelectorAll('h1, h2, h3')).slice(0, 20).map(h => ({
            level: h.tagName,
            text: h.textContent.trim()
          })),
          
          // Get images
          images: Array.from(document.querySelectorAll('img')).slice(0, 10).map(img => ({
            src: img.src,
            alt: img.alt || ''
          })),
          
          // Check for e-commerce patterns
          isEcommerce: !!(
            document.querySelector('[class*="price"]') || 
            document.querySelector('[class*="cart"]') ||
            document.querySelector('[class*="buy"]')
          ),
          
          // Try to find product info
          productInfo: (() => {
            // Amazon
            if (window.location.href.includes('amazon')) {
              const title = document.querySelector('#productTitle');
              const price = document.querySelector('.a-price .a-offscreen');
              return {
                title: title ? title.textContent.trim() : '',
                price: price ? price.textContent.trim() : '',
                platform: 'Amazon'
              };
            }
            
            // Flipkart
            if (window.location.href.includes('flipkart')) {
              const title = document.querySelector('.B_NuCI, ._35KyD6');
              const price = document.querySelector('._30jeq3, ._1_WHN1');
              return {
                title: title ? title.textContent.trim() : '',
                price: price ? price.textContent.trim() : '',
                platform: 'Flipkart'
              };
            }
            
            return null;
          })()
        };
        
        return content;
      }
    });
    
    if (results && results[0] && results[0].result) {
      const content = results[0].result;
      currentPageContent = content;
      
      log("✅ Page content extracted: " + content.url, "success");
      log("📊 Text length: " + (content.bodyText?.length || 0) + " chars", "info");
      log("🏷️ Title: " + content.title, "info");
      
      if (content.productInfo && content.productInfo.title) {
        log("🛍️ Product detected: " + content.productInfo.title, "success");
      }
      
      return content;
    } else {
      log("⚠️ Could not extract page content", "warning");
      return null;
    }
  } catch (error) {
    log("❌ Error reading page: " + error.message, "error");
    return null;
  }
}
function extractCompactPageContext() {
  const cleanText = (el) =>
    el ? el.textContent.replace(/\s+/g, " ").trim() : "";

  const bodyClone = document.body.cloneNode(true);
  bodyClone.querySelectorAll(
    "script,style,noscript,iframe,svg,canvas"
  ).forEach(el => el.remove());

  const bodyText = cleanText(bodyClone).slice(0, 1500);

  const headings = Array.from(
    document.querySelectorAll("h1, h2")
  )
    .slice(0, 6)
    .map(h => "- " + cleanText(h))
    .join("\n");

  let product = null;

  if (location.href.includes("amazon")) {
    const title = cleanText(document.querySelector("#productTitle"));
    const price = cleanText(document.querySelector(".a-price .a-offscreen"));
    if (title) {
      product = {
        title,
        price,
        platform: "Amazon"
      };
    }
  }

  if (location.href.includes("flipkart")) {
    const title = cleanText(document.querySelector("._35KyD6, .B_NuCI"));
    const price = cleanText(document.querySelector("._30jeq3"));
    if (title) {
      product = {
        title,
        price,
        platform: "Flipkart"
      };
    }
  }

  return {
    url: location.href,
    title: document.title,
    pageType: product ? "ecommerce" : "article",
    mainContent: `
${headings}

${bodyText}
`.trim().slice(0, 2000),

    products: product ? [product] : null
  };
}

// Check if query is about current page
function isPageContextQuery(query) {
  const pageKeywords = [
    'this page', 'current page', 'this site', 'this website',
    'summarize', 'summary', 'summarise', 'tldr',
    'what\'s on', 'what is on', 'what\'s here',
    'what does this', 'tell me about this',
    'page content', 'contents', 'content',
    'product', 'item', 'price', 'buy',
    'article', 'post', 'read this'
  ];
  
  const lowerQuery = query.toLowerCase();
  const hasKeyword = pageKeywords.some(keyword => lowerQuery.includes(keyword));
  
  if (hasKeyword) {
    log("🎯 Page context query detected: " + query, "success");
  }
  
  return hasKeyword;
}

// ==================================================
// AUTO-SCROLL MANAGEMENT
// ==================================================

function isScrolledToBottom() {
  const threshold = 100;
  return messages.scrollHeight - messages.scrollTop - messages.clientHeight < threshold;
}

function scrollToBottom() {
  if (autoScroll) {
    messages.scrollTop = messages.scrollHeight;
  }
}

messages.addEventListener('scroll', () => {
  if (isUserScrolling) {
    isUserScrolling = false;
    return;
  }
  
  if (isScrolledToBottom()) {
    autoScroll = true;
  } else {
    autoScroll = false;
  }
});

function smoothScrollToBottom() {
  if (autoScroll) {
    isUserScrolling = true;
    messages.scrollTo({
      top: messages.scrollHeight,
      behavior: 'smooth'
    });
  }
}

// ==================================================
// TAB OPEN HELPER
// ==================================================

function openTab(url) {
  chrome.runtime.sendMessage({
    type: "OPEN_TAB",
    url
  });
}

// ==================================================
// DEBUG LOGGER
// ==================================================

function log(message, type = "info") {
  const line = document.createElement("div");
  line.className = `debug-line ${type}`;
  line.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
  if (debugPanel) {
    debugPanel.appendChild(line);
    debugPanel.scrollTop = debugPanel.scrollHeight;
  }
  console.log(`[${type.toUpperCase()}] ${message}`);
}

// ==================================================
// FOCUS HANDLING & AUTO-GROW TEXTAREA
// ==================================================

function focusInput() {
  setTimeout(() => {
    if (document.activeElement !== input) {
      input?.focus();
    }
  }, 50);
}

function autoGrowTextarea() {
  input.style.height = 'auto';
  input.style.height = Math.min(input.scrollHeight, 120) + 'px';
}

input.addEventListener('input', autoGrowTextarea);

window.addEventListener("load", focusInput);
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) focusInput();
});

// ==================================================
// MESSAGE HELPERS
// ==================================================

function addMessage(text, type) {
  const wrapper = document.createElement("div");
  wrapper.className = type === "user" ? "user-msg" : "bot-msg";

  if (type === "user") wrapper.textContent = text;

  if (type === "bot") {
    const textDiv = document.createElement("div");
    textDiv.className = "bot-text";
    wrapper.appendChild(textDiv);
  }

  messages.appendChild(wrapper);
  scrollToBottom();
  return wrapper;
}

function renderMarkdownStream(el, fullText) {
  el.innerHTML = marked.parse(fullText);
}

function addSystemBotMessage(text) {
  const wrapper = document.createElement("div");
  wrapper.className = "bot-msg";
  const textDiv = document.createElement("div");
  textDiv.className = "bot-text";
  textDiv.textContent = text;
  wrapper.appendChild(textDiv);
  messages.appendChild(wrapper);
  scrollToBottom();
}

// ==================================================
// LOADERS & STATUS
// ==================================================

function addTypingLoader(parent) {
  const loader = document.createElement("div");
  loader.className = "typing";
  loader.innerHTML = "<span></span><span></span><span></span>";
  parent.appendChild(loader);
  scrollToBottom();
  return loader;
}

function addAgentStatus(parent) {
  const status = document.createElement("div");
  status.className = "agent-status";
  status.innerHTML = `
    <div class="agent-status-header">
      <span class="agent-status-icon">⚙️</span>
      <span>Agent Actions</span>
    </div>
    <ul class="agent-action-list"></ul>
  `;
  parent.appendChild(status);
  scrollToBottom();
  return status.querySelector(".agent-action-list");
}

function addAgentAction(list, text) {
  const item = document.createElement("li");
  item.className = "agent-action-item";
  item.textContent = text;
  list.appendChild(item);
  scrollToBottom();
}

function addLoadingSection(parent, type) {
  const section = document.createElement("div");
  section.className = "loading-section";
  
  const icons = {
    products: "🛍️",
    videos: "🎥",
    images: "🖼️"
  };
  
  const labels = {
    products: "Loading product recommendations",
    videos: "Finding relevant videos",
    images: "Gathering images"
  };
  
  section.innerHTML = `
    <div class="loading-section-header">
      <div class="loading-spinner"></div>
      <span>${icons[type]} ${labels[type]}...</span>
    </div>
    <div class="loading-skeleton-grid">
      <div class="skeleton-card"></div>
      <div class="skeleton-card"></div>
      <div class="skeleton-card"></div>
    </div>
  `;
  
  parent.appendChild(section);
  scrollToBottom();
  return section;
}

// ==================================================
// ENHANCED CHAT MODE WITH PAGE CONTEXT
// ==================================================

async function streamChatResponse(text) {
  let fullText = "";
  const bot = addMessage("", "bot");
  const textEl = bot.querySelector(".bot-text");
  const typing = addTypingLoader(textEl);

  let richContentLoaders = {};
  let pageContent = null; // ✅ IMPORTANT (scope fixed)

  // Check if query needs page context
  if (isPageContextQuery(text)) {
    log("📄 Fetching page context...", "info");

    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true
    });

    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: extractCompactPageContext
    });

    pageContent = results?.[0]?.result ?? null; // ✅ FIXED

    if (pageContent) {
      log("✅ Using page context in request", "success");
      console.log("📦 Page Context:", pageContent);
    } else {
      log("⚠️ Could not get page context", "warning");
    }
  }

  try {
    const requestBody = {
      prompt: text,
      page_content: pageContent // ✅ now correct
    };

    log("📤 Sending request to backend...", "info");

    const response = await fetch(CHAT_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const frames = buffer.split("\n\n");
      buffer = frames.pop();

      for (const frame of frames) {
        if (!frame.trim()) continue;

        try {
          const event = JSON.parse(frame);

          if (event.type === "text") {
            typing.remove();
            fullText += event.data;
            renderMarkdownStream(textEl, fullText);
            scrollToBottom();
          }

          if (event.type === "rich_blocks") {
            Object.values(richContentLoaders).forEach(l => l.remove());
            richContentLoaders = {};
            scrollToBottom();
          }

          if (event.type === "error") {
            typing.remove();
            textEl.textContent = "⚠️ " + event.data;
            scrollToBottom();
          }

          if (event.type === "done") {
            typing.remove();
            scrollToBottom();
          }
        } catch (e) {
          log("⚠️ Parse error: " + e.message, "error");
        }
      }
    }
  } catch (error) {
    typing.remove();
    textEl.textContent = "⚠️ Connection error: " + error.message;
    log("❌ Fetch error: " + error.message, "error");
    scrollToBottom();
  }
}

// ==================================================
// ACTION EXECUTOR WITH FEEDBACK
// ==================================================

function getActionDescription(action) {
  const descriptions = {
    "open_url": `Opening ${action.url}`,
    "open_web_search": `🔍 Searching Google for "${action.query}"`,
    "open_youtube_search": `▶️ Searching YouTube for "${action.query}"`,
    "open_youtube_playlist": `📺 Opening YouTube playlist for "${action.query}"`,
    "search_suggestion": `🔗 Opening ${action.target || "web"} search`
  };
  
  return descriptions[action.type] || `Executing ${action.label}`;
}

function executeAction(action, agentList = null) {
  const description = getActionDescription(action);
  log(`⚡ Executing: ${description}`, "success");
  
  if (agentList) {
    addAgentAction(agentList, description);
  }

  if (action.type === "open_url" && action.url) {
    openTab(action.url);
  }

  if (action.type === "open_web_search" && action.query) {
    openTab("https://www.google.com/search?q=" + encodeURIComponent(action.query));
  }

  if (action.type === "open_youtube_search" && action.query) {
    openTab("https://www.youtube.com/results?search_query=" + encodeURIComponent(action.query));
  }

  if (action.type === "open_youtube_playlist" && action.query) {
    openTab("https://www.youtube.com/results?search_query=" + encodeURIComponent(action.query) + "&sp=EgIQAw%253D%253D");
  }

  if (action.type === "search_suggestion" && action.query) {
    const urls = {
      youtube: `https://www.youtube.com/results?search_query=${encodeURIComponent(action.query)}`,
      amazon: `https://www.amazon.in/s?k=${encodeURIComponent(action.query)}`,
      flipkart: `https://www.flipkart.com/search?q=${encodeURIComponent(action.query)}`,
      wikipedia: `https://en.wikipedia.org/wiki/${encodeURIComponent(action.query.replace(/\s+/g, "_"))}`,
      images: `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(action.query)}`,
      web: `https://www.google.com/search?q=${encodeURIComponent(action.query)}`
    };
    
    openTab(urls[action.target] || urls.web);
  }

  if (action.type === "follow_up" && action.query) {
    sendMessage(action.query);
  }
}

// ==================================================
// ENHANCED AGENT MODE WITH PAGE CONTEXT
// ==================================================
async function streamAgentResponse(text) {
  let fullText = "";
  const bot = addMessage("", "bot");
  const textEl = bot.querySelector(".bot-text");
  const typing = addTypingLoader(textEl);

  // Agent UI
  const agentList = addAgentStatus(bot);

  // 🔑 STATE FLAGS (CRITICAL)
  let actionsReceived = false;
  let agentPanelClosed = false;

  log("🤖 Agent request started");

  let pageContent = null;

  // ==================================================
  // PAGE CONTEXT EXTRACTION (OPTIONAL)
  // ==================================================
  if (isPageContextQuery(text)) {
    log("📄 Fetching page context for agent...", "info");

    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true
    });

    // 🚫 Chrome internal pages are blocked
    if (isRestrictedChromePage(tab.url)) {
      addSystemBotMessage(
        "⚠️ I can’t read this page because Chrome blocks access to internal pages."
      );
      typing.remove();
      return;
    }

    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: extractCompactPageContext
    });

    pageContent = results?.[0]?.result ?? null;

    if (pageContent) {
      log("✅ Using page context in agent request", "success");
      console.log("📦 Agent Page Context:", pageContent);
    } else {
      log("⚠️ Could not extract page context for agent", "warning");
    }
  }

  // ==================================================
  // SEND REQUEST TO BACKEND
  // ==================================================
  try {
    const response = await fetch(AGENT_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: text,
        page_content: pageContent
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    // ==================================================
    // STREAM LOOP
    // ==================================================
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const frames = buffer.split("\n\n");
      buffer = frames.pop();

      for (const frame of frames) {
        if (!frame.trim()) continue;

        let event;
        try {
          event = JSON.parse(frame);
        } catch (err) {
          log("⚠️ Parse error: " + err.message, "error");
          continue;
        }

        // ---------------- TEXT ----------------
        if (event.type === "text") {
          typing.remove();
          fullText += event.data;
          renderMarkdownStream(textEl, fullText);
          scrollToBottom();
        }

        // ---------------- ACTIONS ----------------
        if (event.type === "actions") {
          actionsReceived = true;

          log("🎯 Actions received", "success");

          const autoActions = event.data.filter(a => a.auto);
          autoActions.forEach(a => executeAction(a, agentList));

          renderAgentActions(bot, event.data);
          scrollToBottom();
        }

        // ---------------- ERROR ----------------
        if (event.type === "error") {
          typing.remove();
          textEl.textContent = "⚠️ " + event.data;
          scrollToBottom();
        }

        // ---------------- DONE ----------------
        if (event.type === "done") {
          typing.remove();

          // ✅ FINALIZE AGENT PANEL IF NO ACTIONS
          if (!actionsReceived && !agentPanelClosed) {
            addAgentAction(
              agentList,
              "ℹ️ No actions required for this request"
            );
            agentPanelClosed = true;
          }

          scrollToBottom();
        }
      }
    }
  } catch (error) {
    typing.remove();
    textEl.textContent = "⚠️ Connection error: " + error.message;
    log("❌ Fetch error: " + error.message, "error");
    scrollToBottom();
  }
}

// ==================================================
// CONTENT SECTION HEADERS
// ==================================================

function addContentHeader(parent, text) {
  const header = document.createElement("div");
  header.className = "content-section-header";
  header.textContent = text;
  parent.appendChild(header);
  scrollToBottom();
}

// ==================================================
// ACTION BUTTONS
// ==================================================

function renderAgentActions(wrapper, actions) {
  if (!actions?.length) return;

  const box = document.createElement("div");
  box.className = "agent-actions";

  actions.forEach(action => {
    const btn = document.createElement("button");
    btn.className = "agent-action-btn";
    
    btn.textContent = action.auto ? `✓ ${action.label}` : action.label;
    if (action.auto) {
      btn.style.opacity = "0.75";
      btn.style.fontStyle = "italic";
    }

    btn.onclick = () => executeAction(action);

    box.appendChild(btn);
  });

  wrapper.appendChild(box);
  scrollToBottom();
}

// ==================================================
// RICH CONTENT RENDERERS
// ==================================================

function renderProducts(parent, products) {
  if (!products?.length) return;

  const box = document.createElement("div");
  box.className = "product-cards";

  products.forEach(p => {
    const card = document.createElement("div");
    card.className = "product-card";

    card.innerHTML = `
      <div class="product-title">${p.title}</div>
      <div class="product-price">${p.price ?? ""}</div>
      <div class="product-reason">${p.reason}</div>
      <button class="product-btn">View on ${p.platform}</button>
    `;

    card.querySelector(".product-btn").onclick = () =>
      executeAction({
        type: "search_suggestion",
        query: p.query,
        target: p.platform,
        auto: false
      });

    box.appendChild(card);
  });

  parent.appendChild(box);
  scrollToBottom();
}

function renderYouTubeVideos(parent, videos) {
  if (!videos?.length) return;

  const box = document.createElement("div");
  box.className = "youtube-cards";

  videos.forEach(video => {
    const card = document.createElement("div");
    card.className = "youtube-card";

    card.innerHTML = `
      <div class="yt-icon">▶</div>
      <div class="yt-content">
        <div class="yt-title">${video.title}</div>
        <div class="yt-reason">${video.reason}</div>
      </div>
    `;

    card.onclick = () =>
      executeAction({
        type: "open_youtube_search",
        query: video.query,
        auto: false
      });

    box.appendChild(card);
  });

  parent.appendChild(box);
  scrollToBottom();
}

function renderImages(parent, images) {
  if (!images?.length) return;

  const container = document.createElement("div");
  container.className = "image-carousel";

  images.forEach((img, index) => {
    const wrapper = document.createElement("div");
    wrapper.className = "image-wrapper";

    const el = document.createElement("img");
    
    el.src = `https://picsum.photos/400/300?random=${Date.now()}-${index}`;
    el.alt = img.caption;
    el.loading = "lazy";
    
    let errorCount = 0;
    el.onerror = () => {
      errorCount++;
      if (errorCount === 1) {
        el.src = `https://via.placeholder.com/400x300/667eea/ffffff?text=${encodeURIComponent(img.caption.substring(0, 30))}`;
      } else if (errorCount === 2) {
        el.src = `https://placehold.co/400x300/667eea/ffffff/png?text=${encodeURIComponent(img.caption.substring(0, 30))}`;
      } else {
        wrapper.innerHTML = `
          <div style="width: 100%; height: 100%; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); display: flex; align-items: center; justify-content: center; padding: 20px;">
            <div style="color: white; text-align: center; font-size: 14px; font-weight: 600; line-height: 1.4;">
              ${img.caption}
            </div>
          </div>
          <div class="image-caption">${img.caption}</div>
        `;
      }
    };

    const caption = document.createElement("div");
    caption.className = "image-caption";
    caption.textContent = img.caption;

    wrapper.appendChild(el);
    wrapper.appendChild(caption);
    container.appendChild(wrapper);
  });

  parent.appendChild(container);
  scrollToBottom();
}

// ==================================================
// MODE TOGGLE
// ==================================================

agentToggle.addEventListener("change", () => {
  agentMode = agentToggle.checked;
  addSystemBotMessage(
    agentMode ? "🤖 Agent mode enabled - Actions will auto-execute" : "💬 Chat mode enabled"
  );
});

// ==================================================
// SEND HANDLER
// ==================================================

async function sendMessage(textOverride) {
  const text = typeof textOverride === "string" ? textOverride : input.value.trim();
  if (!text) return;

  autoScroll = true;

  addMessage(text, "user");
  input.value = "";
  input.style.height = "auto";

  const urls = extractUrls(text);
  if (urls.length > 0) {
    urls.forEach(url => fetchUrlPreview(url));
  }

  if (agentMode) await streamAgentResponse(text);
  else await streamChatResponse(text);
}

function extractUrls(text) {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  return text.match(urlRegex) || [];
}

// ==================================================
// EVENTS
// ==================================================

sendBtn.addEventListener("click", sendMessage);

input.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

function renderUrlPreview(data) {
  const card = document.createElement("div");
  card.className = "url-preview-card";

  card.innerHTML = `
    ${data.image ? `<img src="${data.image}" class="preview-image"/>` : ""}
    <div class="preview-body">
      <div class="preview-title">${data.title || ""}</div>
      <div class="preview-desc">${data.description || ""}</div>
      <div class="preview-site">${data.site || new URL(data.url).hostname}</div>
    </div>
  `;

  card.onclick = () => openTab(data.url);

  messages.appendChild(card);
  scrollToBottom();
}

async function fetchUrlPreview(url) {
  try {
    const res = await fetch("http://127.0.0.1:8000/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url })
    });

    const data = await res.json();
    renderUrlPreview(data);
  } catch (err) {
    log("OG preview failed: " + err.message, "warning");
  }
}

// ==================================================
// DEBUG: Test page content extraction
// ==================================================
window.testPageContent = async function() {
  log("🧪 Testing page content extraction...", "info");
  const content = await getCurrentPageContent();
  console.log("✅ Page Content:", content);
  return content;
};

log("✅ Script loaded - Type testPageContent() to test", "success");