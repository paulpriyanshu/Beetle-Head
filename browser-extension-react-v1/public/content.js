(function initUltimateAI() {
  if (!chrome?.runtime?.id) return;

  // ==================================================
  // 🧠 GLOBAL STATE
  // ==================================================
  let lastActiveElement = null;
  let typingTimer = null;
  let menuTimer = null;
  let overlayDiv = null;
  let currentErrors = [];
  let aiErrors = [];
  let aiCheckTimer = null;
  let logoState = "neutral";
  let activeInput = null;
  let lastAIText = "";

  const RULES = [
    { reg: /\b(i\s+am\s+was|i\s+is|was\s+eated|did\s+went|recieve|teh|tady|tesing|definately|accross|alot|occured|separate|comming)\b/gi, type: 'error', suggestion: null },
    { reg: /\b(how\s+is\s+you|how\s+are\s+he|she\s+are|they\s+is|we\s+is|i\s+is|you\s+is)\b/gi, type: 'error', suggestion: "Grammar error" },
    { reg: /\b(there\s+is\s+many|there\s+is\s+some|there\s+is\s+few)\b/gi, type: 'error', suggestion: "Subject-verb disagreement" },
    { reg: /\b(\w+)\s+\1\b/gi, type: 'error', suggestion: "Remove duplicate word" },
    { reg: /\b(very|basically|actually|literally|simply|just)\b/gi, type: 'improve', suggestion: "Omit filler word" }
  ];

  // ==================================================
  // 🎯 CORE DETECTION LOGIC
  // ==================================================
  function analyzeText(isFromAI = false) {
    if (!lastActiveElement) return;
    const text = getLiveText(lastActiveElement);
    if (!text) return;

    let localErrors = [];
    if (text.length > 2) {
      RULES.forEach(rule => {
        let match;
        rule.reg.lastIndex = 0;
        while ((match = rule.reg.exec(text)) !== null) {
          localErrors.push({
            start: match.index,
            end: match.index + match[0].length,
            type: rule.type,
            text: match[0],
            suggestion: rule.suggestion
          });
        }
      });
    }

    const filteredAI = aiErrors.filter(ai =>
      !localErrors.some(loc => (ai.start < loc.end && ai.end > loc.start))
    );

    currentErrors = [...localErrors, ...filteredAI];

    logoState = currentErrors.some(e => e.type === 'error') ? "error" :
      currentErrors.some(e => e.type === 'improve') ? "improve" : "neutral";

    updateLogoVisuals();
    syncOverlay();

    if (!isFromAI) {
      clearTimeout(aiCheckTimer);
      aiCheckTimer = setTimeout(() => {
        const currentText = getLiveText(lastActiveElement);
        if (currentText.length >= 5) triggerAIGrammarCheck(currentText);
      }, 1000); // 1s debounce
    }
  }

  async function triggerAIGrammarCheck(text) {
    if (text.length < 5 || text === lastAIText) return;
    if (!chrome.runtime?.id) return; // Guard for context invalidation

    lastAIText = text;
    try {
      chrome.runtime.sendMessage({
        type: "CHECK_GRAMMAR",
        text: text
      }, (response) => {
        if (chrome.runtime.lastError) return;
        if (response && response.success) {
          aiErrors = response.errors || [];
          analyzeText(true);
        }
      });
    } catch (e) {
      // Silent fail on context invalidation
    }
  }

  function getLiveText(el) {
    if (!el) return "";
    return el.isContentEditable ? el.innerText : (el.value || "");
  }

  function isWritable(el) {
    if (!el || !el.tagName) return false;
    const tagName = el.tagName.toLowerCase();
    return el.isContentEditable || tagName === 'textarea' ||
      (tagName === 'input' && ['text', 'search', 'email'].includes(el.type));
  }

  // ==================================================
  // 🎨 UI & VISUALS
  // ==================================================
  function syncOverlay() {
    if (!lastActiveElement || !overlayDiv) return;
    if (currentErrors.length === 0) { overlayDiv.innerHTML = ''; return; }

    const rect = lastActiveElement.getBoundingClientRect();
    const style = window.getComputedStyle(lastActiveElement);

    Object.assign(overlayDiv.style, {
      top: `${rect.top + window.scrollY}px`,
      left: `${rect.left + window.scrollX}px`,
      width: `${rect.width}px`,
      height: `${rect.height}px`,
      fontFamily: style.fontFamily,
      fontSize: style.fontSize,
      fontWeight: style.fontWeight,
      lineHeight: style.lineHeight,
      padding: style.padding,
      margin: style.margin,
      boxSizing: style.boxSizing,
      textAlign: style.textAlign,
      letterSpacing: style.letterSpacing,
      position: 'absolute',
      pointerEvents: 'none',
      zIndex: '2147483646',
      color: 'transparent',
      whiteSpace: 'pre-wrap',
      wordWrap: 'break-word',
      overflow: 'hidden'
    });

    const text = getLiveText(lastActiveElement);
    let html = ""; let cursor = 0;
    currentErrors.sort((a, b) => a.start - b.start).forEach(err => {
      html += escapeHTML(text.substring(cursor, err.start));
      const color = err.type === 'error' ? '#ff4d4d' : '#ffcc00';
      html += `<span style="border-bottom: 2px wavy ${color};">${escapeHTML(text.substring(err.start, err.end))}</span>`;
      cursor = err.end;
    });
    html += escapeHTML(text.substring(cursor));
    overlayDiv.innerHTML = html.replace(/\n/g, '<br/>');
  }

  function escapeHTML(str) {
    return str.replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
  }

  function updateLogoVisuals(forceState) {
    const root = document.getElementById("ai-root");
    if (!root) return;
    const fab = root.shadowRoot.getElementById('ai-fab');
    if (!fab) return;

    const state = forceState || logoState;

    if (state === "loading") {
      fab.style.background = "#6e8efb";
      fab.innerHTML = `<span style="animation: spin 1s linear infinite">⏳</span>`;
    } else if (state === "success") {
      fab.style.background = "#4ade80";
      fab.innerHTML = "✅";
      setTimeout(() => updateLogoVisuals(), 2000);
    } else if (state === "error") {
      fab.style.background = "#ff4d4d";
      fab.innerHTML = "❗";
    } else if (state === "improve") {
      fab.style.background = "#ffcc00";
      fab.innerHTML = "💡";
    } else {
      fab.style.background = "linear-gradient(135deg, #6e8efb, #a777e3)";
      fab.innerHTML = "🤖";
    }
  }

  function injectUI() {
    if (document.getElementById("ai-root") || !document.body) return;

    overlayDiv = document.createElement('div');
    overlayDiv.id = 'ai-highlight-overlay';
    document.body.appendChild(overlayDiv);

    const root = document.createElement("div");
    root.id = "ai-root";
    const shadow = root.attachShadow({ mode: "open" });

    shadow.innerHTML = `
      <style>
        .container { position: fixed; bottom: 25px; right: 25px; z-index: 2147483647; font-family: sans-serif; padding-bottom: 10px;}
        .fab { width: 52px; height: 52px; border-radius: 50%; display: flex; align-items: center; justify-content: center; 
               cursor: pointer; color: white; box-shadow: 0 4px 15px rgba(0,0,0,0.25); transition: 0.3s; font-size: 24px; border: none;
               animation: fabGlow 3s infinite ease-in-out; }
        .fab:hover { transform: scale(1.1); animation-duration: 1.5s; }
        .menu { position: absolute; bottom: 70px; right: 0; background: white; border-radius: 12px; width: 220px; 
                 display: none; flex-direction: column; box-shadow: 0 10px 40px rgba(0,0,0,0.2); border: 1px solid #eee; overflow: hidden; }
        .menu.visible { display: flex; animation: fadeUp 0.2s ease; }
        .item { padding: 12px 16px; font-size: 14px; color: #333; cursor: pointer; border-bottom: 1px solid #f5f5f5; display: flex; align-items: center; gap: 10px; }
        .item:hover { background: #f0f7ff; color: #0066ff; }
        .item:last-child { border-bottom: none; }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        
        @keyframes fabGlow {
          0% { box-shadow: 0 0 10px rgba(110, 142, 251, 0.4), 0 0 20px rgba(167, 119, 227, 0.2); }
          50% { box-shadow: 0 0 25px rgba(110, 142, 251, 0.8), 0 0 40px rgba(167, 119, 227, 0.4); }
          100% { box-shadow: 0 0 10px rgba(110, 142, 251, 0.4), 0 0 20px rgba(167, 119, 227, 0.2); }
        }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      </style>
      <div class="container" id="ai-container">
        <div class="menu" id="ai-menu"></div>
        <div class="fab" id="ai-fab">🤖</div>
      </div>
    `;

    const container = shadow.getElementById('ai-container');
    const menu = shadow.getElementById('ai-menu');

    container.onmouseenter = () => {
      clearTimeout(menuTimer);
      renderMenuContent(menu);
      menu.classList.add('visible');
    };

    container.onmouseleave = () => {
      menuTimer = setTimeout(() => {
        menu.classList.remove('visible');
      }, 300);
    };

    document.documentElement.appendChild(root);
  }

  function renderMenuContent(menu) {
    const text = getLiveText(lastActiveElement);
    const isActuallyTyping = lastActiveElement && document.activeElement === lastActiveElement && text.length > 2;

    let html = `<div class="item" data-action="OPEN_CHAT">💬 Open AI Chat</div>`;

    if (isActuallyTyping) {
      const errors = currentErrors.filter(e => e.type === 'error' || e.type === 'improve');
      if (errors.length > 0) {
        html += `<div class="item" data-action="CORRECT_ALL" style="font-weight: bold; color: #0066ff;">✨ Correct All Errors</div>`;
        errors.slice(0, 2).forEach((err, idx) => {
          const label = err.suggestion ? `✅ Fix: ${err.suggestion}` : `✅ Fix "${err.text}"`;
          html += `<div class="item" data-action="APPLY_FIX" data-index="${idx}"> ${label}</div>`;
        });
      }

      html += `
        <div class="item" data-action="REWRITE" data-mode="professional">👔 Make Professional</div>
        <div class="item" data-action="REWRITE" data-mode="concise">✂️ Make Concise</div>
        <div class="item" data-action="REWRITE" data-mode="explained">🤔 Explain this</div>
      `;
    }

    const isYT = window.location.href.includes('youtube.com/watch');
    html += isYT ? `<div class="item" data-action="SUMMARIZE_VIDEO">📺 Summarize Video</div>` :
      `<div class="item" data-action="SUMMARIZE_PAGE">📄 Summarize Page</div>`;

    menu.innerHTML = html;

    menu.querySelectorAll('.item').forEach(item => {
      item.onclick = (e) => {
        e.stopPropagation();
        const action = item.dataset.action;
        const index = item.dataset.index;
        const mode = item.dataset.mode;

        if (action === "APPLY_FIX") {
          applySpecificFix(parseInt(index));
        } else if (action === "REWRITE") {
          triggerAIRewrite(mode);
        } else if (action === "CORRECT_ALL") {
          triggerAIRewrite("corrected");
        } else {
          handleAction(action);
        }
        menu.classList.remove('visible');
      };
    });
  }

  async function triggerAIRewrite(mode) {
    if (!lastActiveElement) return;
    const text = getLiveText(lastActiveElement);
    if (text.length < 3) return;
    if (!chrome.runtime?.id) return;

    updateLogoVisuals("loading");

    try {
      chrome.runtime.sendMessage({
        type: "REWRITE_TEXT",
        text: text,
        properties: [mode]
      }, (response) => {
        if (chrome.runtime.lastError) {
          updateLogoVisuals("neutral");
          return;
        }
        if (response && response.success && response.versions[mode]) {
          updateInputValue(response.versions[mode]);
          updateLogoVisuals("success");
        } else {
          updateLogoVisuals("neutral");
        }
      });
    } catch (e) {
      updateLogoVisuals("neutral");
    }
  }

  function applySpecificFix(index) {
    const err = currentErrors.filter(e => e.type === 'error' || e.type === 'improve')[index];
    if (!err || !lastActiveElement) return;

    const fullText = getLiveText(lastActiveElement);
    const replacement = err.suggestion && !err.suggestion.includes(" ") ? err.suggestion : null;

    if (replacement) {
      const newText = fullText.substring(0, err.start) + replacement + fullText.substring(err.end);
      updateInputValue(newText);
    } else {
      handleAction(err.type === 'error' ? 'CHECK' : 'IMPROVE');
    }
  }

  function updateInputValue(val) {
    if (!lastActiveElement) return;
    if (lastActiveElement.isContentEditable) lastActiveElement.innerText = val;
    else lastActiveElement.value = val;
    lastActiveElement.dispatchEvent(new Event('input', { bubbles: true }));
    analyzeText();
  }

  function handleAction(action) {
    if (!chrome.runtime?.id) return;

    if (action === "OPEN_CHAT") {
      try { chrome.runtime.sendMessage({ type: "OPEN_SIDEBAR" }); } catch (e) { }
      return;
    }

    const text = getLiveText(lastActiveElement);
    let prompt = "";
    switch (action) {
      case 'CHECK': prompt = `Correct the grammar: "${text}"`; break;
      case 'IMPROVE': prompt = `Improve tone and clarity: "${text}"`; break;
      case 'SUMMARIZE_VIDEO': prompt = "Summarize this YouTube video."; break;
      case 'SUMMARIZE_PAGE': prompt = "Summarize this page."; break;
    }

    try {
      chrome.runtime.sendMessage({
        type: "SEND_TO_CHAT",
        message: prompt,
        meta: { url: location.href, title: document.title }
      });
    } catch (e) { }
  }

  // ==================================================
  // 📨 MESSAGE HANDLER (Automation & Actions)
  // ==================================================
  function setupGlobalListeners() {
    // Input detection
    document.addEventListener('focusin', (e) => {
      if (isWritable(e.target)) {
        lastActiveElement = e.target;
        analyzeText();
      }
    }, true);

    document.addEventListener('input', (e) => {
      if (isWritable(e.target)) {
        lastActiveElement = e.target;
        clearTimeout(typingTimer);
        typingTimer = setTimeout(analyzeText, 150);
      }
    }, true);

    document.addEventListener('mousedown', (e) => {
      if (!isWritable(e.target) && !e.target.closest('#ai-root')) {
        setTimeout(() => {
          if (document.activeElement.tagName === 'BODY') lastActiveElement = null;
        }, 200);
      }
    });

    window.addEventListener('resize', syncOverlay);
    window.addEventListener('scroll', syncOverlay, true);

    // Automation listeners
    if (chrome.runtime?.onMessage) {
      try {
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
          if (!chrome.runtime?.id) return false;

          if (request.type === "PING") {
            sendResponse({ pong: true });
            return true;
          }

          if (request.type === "GET_SELECTION") {
            const text = window.getSelection()?.toString()?.trim() || "";
            sendResponse({ text });
            return true;
          }

          if (request.type === "REPLACE_TEXT") {
            updateInputValue(request.text);
            return true;
          }

          if (request.action === "AUTOMATE") {
            performAutomation(request.data)
              .then(result => sendResponse({ success: true, result }))
              .catch(error => sendResponse({ success: false, error: error.message }));
            return true;
          }

          if (request.action === "GET_PAGE_CONTENT") {
            getPageContent()
              .then(content => sendResponse({ success: true, content }))
              .catch(error => sendResponse({ success: false, error: error.message }));
            return true;
          }

          if (request.action === "EXECUTE_DOM_ACTIONS") {
            executeDOMActions(request.actions)
              .then(result => sendResponse({ success: true, result }))
              .catch(error => sendResponse({ success: false, error: error.message }));
            return true;
          }

          if (request.action === "GET_CURRENT_INPUT") {
            const active = document.activeElement;
            if (active && isWritable(active)) {
              sendResponse({
                success: true,
                text: getLiveText(active),
                placeholder: active.placeholder || '',
                elementType: active.tagName
              });
            } else {
              sendResponse({ success: false, message: "No active input" });
            }
            return true;
          }

          if (request.action === "INSERT_TEXT") {
            const active = document.activeElement;
            if (active && isWritable(active)) {
              updateInputValue(request.text);
              sendResponse({ success: true });
            } else {
              sendResponse({ success: false, message: "No active input" });
            }
            return true;
          }

          // 🆕 Circle Search Handlers
          if (request.type === "ACTIVATE_CIRCLE_SEARCH") {
            activateCircleSearchDrawing();
            sendResponse({ success: true });
            return true;
          }

          if (request.type === "DEACTIVATE_CIRCLE_SEARCH") {
            deactivateCircleSearchDrawing();
            sendResponse({ success: true });
            return true;
          }

          // 🆕 Video Control Listeners
          if (request.type === "VIDEO_SEEK") {
            const video = document.querySelector('video');
            if (video) {
              video.currentTime = request.time;
              if (video.paused) video.play();
              sendResponse({ success: true });
            } else {
              sendResponse({ success: false, message: "No video found" });
            }
            return true;
          }

          if (request.type === "GET_VIDEO_STATE") {
            const video = document.querySelector('video');
            if (video) {
              sendResponse({
                success: true,
                currentTime: video.currentTime,
                duration: video.duration,
                paused: video.paused
              });
            } else {
              sendResponse({ success: false });
            }
            return true;
          }
        });
      } catch (e) {
        console.warn("⚠️ AI Assistant: Could not register message listener (context invalidated)");
      }
    }
  }

  // ==================================================
  // 🎥 VIDEO TRACKING (YouTube Tracking)
  // ==================================================
  function initVideoTracking() {
    if (!window.location.hostname.includes('youtube.com')) return;

    let lastUrl = '';

    const timer = setInterval(() => {
      // Check if context is still valid, if not, clear timer and stop
      if (!chrome.runtime?.id) {
        clearInterval(timer);
        return;
      }

      const video = document.querySelector('video');
      const currentUrl = window.location.href;

      // Send update if playing, OR if the URL changed (to keep sidebar in sync during navigation)
      if (video && (!video.paused || currentUrl !== lastUrl)) {
        lastUrl = currentUrl;
        try {
          chrome.runtime.sendMessage({
            type: "VIDEO_PROGRESS_UPDATE",
            data: {
              currentTime: video.currentTime,
              duration: video.duration,
              title: document.title.replace('- YouTube', '').trim(),
              url: currentUrl
            }
          }).catch(err => {
            // Extension context might be invalidated
          });
        } catch (e) {
          clearInterval(timer);
        }
      }
    }, 1000);
  }

  // ==================================================
  // 🛠️ AUTOMATION HELPERS
  // ==================================================
  async function performAutomation(data) {
    if (data.action === "play_song") return await spotifyPlaySong(data.query);
    if (data.action === "play_video") return await youtubePlayVideo(data.query);
    return { message: "Unknown automation type" };
  }

  async function executeDOMActions(actions) {
    const results = [];
    for (const action of actions) {
      try {
        let result;
        switch (action.type) {
          case 'click': result = await clickElement(action.selector, action.options); break;
          case 'fill_input': result = await fillInput(action.selector, action.value, action.options); break;
          case 'wait': result = await sleep(action.duration || 1000); break;
          case 'scroll': result = await scrollPage(action.direction, action.amount); break;
        }
        results.push({ action: action.type, success: result.success !== false, ...result });
        await sleep(500);
      } catch (error) {
        results.push({ action: action.type, success: false, error: error.message });
      }
    }
    return { results, totalActions: actions.length };
  }

  async function clickElement(selector, options = {}) {
    const element = await waitForElement(selector);
    if (!element) return { success: false, message: "Element not found" };
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await sleep(300);
    element.click();
    return { success: true };
  }

  async function fillInput(selector, value) {
    const element = await waitForElement(selector);
    if (!element) return { success: false, message: "Input not found" };
    element.value = value;
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
    return { success: true };
  }

  function waitForElement(selector, timeout = 5000) {
    return new Promise(resolve => {
      const el = document.querySelector(selector);
      if (el) return resolve(el);
      const observer = new MutationObserver(() => {
        const el = document.querySelector(selector);
        if (el) { observer.disconnect(); resolve(el); }
      });
      observer.observe(document.body, { childList: true, subtree: true });
      setTimeout(() => { observer.disconnect(); resolve(null); }, timeout);
    });
  }

  async function scrollPage(direction, amount = 500) {
    window.scrollBy({ top: direction === 'down' ? amount : -amount, behavior: 'smooth' });
    return { success: true };
  }

  async function getPageContent() {
    return {
      url: window.location.href,
      title: document.title,
      text: document.body.innerText.substring(0, 10000)
    };
  }

  async function spotifyPlaySong(query) {
    await sleep(2000);
    const playBtn = document.querySelector('button[data-testid="play-button"]');
    if (playBtn) { playBtn.click(); return { message: `Playing: ${query}` }; }
    return { message: "Play button not found" };
  }

  async function youtubePlayVideo(query) {
    await sleep(2000);
    const video = document.querySelector('a#video-title');
    if (video) { video.click(); return { message: `Playing: ${query}` }; }
    return { message: "Video not found" };
  }

  function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

  // ==================================================
  // 🎨 DOM CUSTOMIZATION HELPERS
  // ==================================================

  /**
   * Inject and/or return a unique ID token for an element
   */
  function getOrInjectAiId(element) {
    if (!element.hasAttribute('data-ai-id')) {
      const id = 'ai-' + Math.random().toString(36).substring(2, 9);
      element.setAttribute('data-ai-id', id);
    }
    return element.getAttribute('data-ai-id');
  }

  /**
   * Generate a unique CSS selector for an element (Primary: ID Token)
   */
  function generateSelector(element) {
    const aiId = getOrInjectAiId(element);
    return `[data-ai-id="${aiId}"]`;
  }

  /**
   * Check if element is visible and meaningful
   */
  function isElementVisible(element) {
    if (element.tagName === 'BODY') return true;
    const style = window.getComputedStyle(element);
    const rect = element.getBoundingClientRect();

    // Check display and visibility
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
      return false;
    }

    // Check if element has dimensions
    if (rect.width === 0 && rect.height === 0) {
      return false;
    }

    return true;
  }

  /**
   * Extract element hierarchy with selectors
   */
  window.getUsefulElements = function () {
    const IMPORTANT_TAGS = [
      'body', 'header', 'nav', 'main', 'footer', 'section', 'article', 'aside',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'p', 'a', 'button', 'input', 'textarea', 'select',
      'div', 'span', 'ul', 'ol', 'li',
      'form', 'label', 'img'
    ];

    const elements = [];
    const MAX_ELEMENTS = 200; // Increased limit for complex sites
    const processedElements = new Set();

    console.log("🔍 Starting ID-Token-based element extraction...");

    // Helper to extract element data
    function extractElementData(el, depth = 0) {
      if (elements.length >= MAX_ELEMENTS) return;
      if (processedElements.has(el)) return;

      const tagName = el.tagName.toLowerCase();
      if (!IMPORTANT_TAGS.includes(tagName)) return;

      // Filter by visibility 
      if (!isElementVisible(el)) return;

      processedElements.add(el);

      const style = window.getComputedStyle(el);
      const selector = generateSelector(el);

      // Get text content (direct text only)
      let text = '';
      if (el.childNodes) {
        for (const node of el.childNodes) {
          if (node.nodeType === 3) {
            text += node.textContent;
          }
        }
      }
      text = text.trim().substring(0, 100);

      // Extract meaningful style properties for LLM
      const styleData = {
        color: style.color,
        backgroundColor: style.backgroundColor,
        fontSize: style.fontSize,
        fontWeight: style.fontWeight,
        display: style.display,
        padding: style.padding,
        margin: style.margin,
        borderRadius: style.borderRadius
      };

      // Extract attributes for context but NOT for selection anymore
      const attrs = {
        id: el.id || undefined,
        class: el.className || undefined,
        type: el.type || undefined,
        placeholder: el.placeholder || undefined
      };

      // Clean undefined values
      Object.keys(attrs).forEach(key => {
        if (attrs[key] === undefined) delete attrs[key];
      });

      elements.push({
        selector: selector, // [data-ai-id="..."]
        tag: tagName,
        text: text || undefined,
        attrs: attrs,
        style: styleData,
        depth: depth,
        rect: {
          width: Math.round(el.getBoundingClientRect().width),
          height: Math.round(el.getBoundingClientRect().height)
        }
      });

      // Recursively process children
      if (depth < 6 && el.children) {
        Array.from(el.children).forEach(child => {
          extractElementData(child, depth + 1);
        });
      }
    }

    // Start extraction from body
    if (document.body) {
      extractElementData(document.body, 0);
    }

    console.log(`✅ Extracted ${elements.length} elements with stable ID tokens`);
    return elements;
  };


  /**
   * Apply customized elements using selector-based approach (VERSION 2.0 - ID TOKENS)
   */
  window.applyCustomizedElements = function (input) {
    let modifications = input;

    // Handle different input formats
    if (!Array.isArray(modifications)) {
      if (typeof input === 'object') {
        modifications = input.modifications || input.elements || input.ELEMENTS || [];
      }
    }

    if (!Array.isArray(modifications) || modifications.length === 0) {
      console.warn("⚠️ No modifications to apply");
      return { total: 0, success: 0, failed: 0 };
    }

    console.log(`🎨 ===== APPLYING ${modifications.length} CUSTOMIZATIONS (v2.0) =====`);

    let successCount = 0;
    let failCount = 0;

    modifications.forEach((mod, idx) => {
      try {
        let elements = [];

        // Step 1: Try Primary Targeting (ID Token)
        if (mod.selector) {
          elements = Array.from(document.querySelectorAll(mod.selector));
          if (elements.length > 0) {
            console.log(`   ✓ [Mod ${idx + 1}] Matched via ID Token: "${mod.selector}"`);
          }
        }

        // Step 2: Fuzzy Fallback (if ID match fails or wasn't provided)
        if (elements.length === 0 && mod.tag) {
          console.log(`   ⚠️ [Mod ${idx + 1}] ID Token failed or missing. Trying fuzzy fallback...`);

          // Try to find elements by tag + class + text content if available
          const potentialElements = document.getElementsByTagName(mod.tag);
          for (const el of potentialElements) {
            // Check if it matches classes
            const classMatch = !mod.attrs?.class || el.className.includes(mod.attrs.class);

            // Check if it's the intended element (simple text match if provided)
            const textMatch = !mod.text || el.innerText.includes(mod.text);

            if (classMatch && textMatch) {
              elements.push(el);
              console.log(`   💡 Found fallback match: <${mod.tag}>`);
              break; // Only match one for fallback to be safe
            }
          }
        }

        if (elements.length === 0) {
          console.warn(`   ❌ [Mod ${idx + 1}] Could not find element:`, mod.selector || mod.tag);
          failCount++;
          return;
        }

        // Step 3: Apply Styles with Aggressive Overrides
        elements.forEach((el, elIdx) => {
          if (mod.changes) {
            Object.keys(mod.changes).forEach(prop => {
              const value = mod.changes[prop];
              const cssProp = prop.replace(/([A-Z])/g, '-$1').toLowerCase().replace(/^-/, '');
              el.style.setProperty(cssProp, value, 'important');
            });

            // Enhanced visual feedback - 3 second glow
            const originalTransition = el.style.transition;
            const originalOutline = el.style.outline;
            const originalBoxShadow = el.style.boxShadow;

            el.style.setProperty('transition', 'outline 0.2s, box-shadow 0.2s', 'important');
            el.style.setProperty('outline', '1.5px solid rgba(74, 222, 128, 0.8)', 'important');
            el.style.setProperty('box-shadow', '0 0 8px rgba(74, 222, 128, 0.4)', 'important');

            setTimeout(() => {
              el.style.outline = originalOutline;
              el.style.boxShadow = originalBoxShadow;
              setTimeout(() => { el.style.transition = originalTransition; }, 200);
            }, 1500);
          }
        });

        successCount++;
      } catch (e) {
        console.error(`⚠️ Error applying modification ${idx}:`, e);
        failCount++;
      }
    });

    console.log(`\n🏁 CUSTOMIZATION COMPLETE: ${successCount} succeeded, ${failCount} failed`);
    return {
      total: modifications.length,
      success: successCount,
      failed: failCount
    };
  };

  // ==================================================
  // 🔍 CIRCLE TO SEARCH - CANVAS DRAWING
  // ==================================================
  let circleSearchCanvas = null;
  let circleSearchCtx = null;
  let isDrawingCircle = false;
  let drawingPath = [];
  let minX = Infinity, minY = Infinity, maxX = 0, maxY = 0;

  function activateCircleSearchDrawing() {
    console.log("🔍 Activating Circle to Search drawing mode");

    // Create canvas overlay
    circleSearchCanvas = document.createElement('canvas');
    circleSearchCanvas.id = 'circle-search-canvas';
    circleSearchCanvas.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      z-index: 2147483647;
      cursor: crosshair;
      background: rgba(0, 0, 0, 0.3);
    `;

    circleSearchCanvas.width = window.innerWidth;
    circleSearchCanvas.height = window.innerHeight;
    document.body.appendChild(circleSearchCanvas);

    circleSearchCtx = circleSearchCanvas.getContext('2d');
    circleSearchCtx.strokeStyle = '#4a9eff';
    circleSearchCtx.lineWidth = 3;
    circleSearchCtx.lineCap = 'round';
    circleSearchCtx.lineJoin = 'round';
    circleSearchCtx.shadowColor = '#4a9eff';
    circleSearchCtx.shadowBlur = 10;

    // Attach event listeners
    circleSearchCanvas.addEventListener('mousedown', startDrawing);
    circleSearchCanvas.addEventListener('mousemove', draw);
    circleSearchCanvas.addEventListener('mouseup', finishDrawing);
    circleSearchCanvas.addEventListener('mouseleave', cancelDrawing);

    // ESC to cancel
    document.addEventListener('keydown', handleEscKey);
  }

  function startDrawing(e) {
    isDrawingCircle = true;
    drawingPath = [];
    minX = Infinity;
    minY = Infinity;
    maxX = 0;
    maxY = 0;

    const rect = circleSearchCanvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    drawingPath.push({ x, y });
    updateBounds(x, y);
  }

  function draw(e) {
    if (!isDrawingCircle) return;

    const rect = circleSearchCanvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    drawingPath.push({ x, y });
    updateBounds(x, y);

    // Draw the path
    circleSearchCtx.clearRect(0, 0, circleSearchCanvas.width, circleSearchCanvas.height);
    circleSearchCtx.beginPath();
    drawingPath.forEach((point, i) => {
      if (i === 0) {
        circleSearchCtx.moveTo(point.x, point.y);
      } else {
        circleSearchCtx.lineTo(point.x, point.y);
      }
    });
    circleSearchCtx.stroke();
  }

  function updateBounds(x, y) {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }

  async function finishDrawing() {
    if (!isDrawingCircle) return;
    isDrawingCircle = false;

    console.log("✅ Drawing complete, capturing region");

    // Add padding
    const padding = 20;
    const captureX = Math.max(0, minX - padding);
    const captureY = Math.max(0, minY - padding);
    const captureWidth = Math.min(circleSearchCanvas.width - captureX, maxX - minX + (padding * 2));
    const captureHeight = Math.min(circleSearchCanvas.height - captureY, maxY - minY + (padding * 2));

    // Remove canvas first
    deactivateCircleSearchDrawing();

    // Wait a bit for canvas to be removed
    await sleep(100);

    // Capture the selected region using Chrome API
    try {
      const dataUrl = await captureRegion(captureX, captureY, captureWidth, captureHeight);

      // Send to sidebar
      chrome.runtime.sendMessage({
        type: "CIRCLE_SEARCH_COMPLETE",
        imageData: dataUrl,
        pageUrl: window.location.href,
        pageTitle: document.title
      });
    } catch (error) {
      console.error("Error capturing region:", error);
    }
  }

  function cancelDrawing() {
    isDrawingCircle = false;

    deactivateCircleSearchDrawing();
  }

  function handleEscKey(e) {
    if (e.key === 'Escape' && circleSearchCanvas) {
      cancelDrawing();
    }
  }

  function deactivateCircleSearchDrawing() {
    if (circleSearchCanvas) {
      circleSearchCanvas.remove();
      circleSearchCanvas = null;
      circleSearchCtx = null;
    }
    isDrawingCircle = false;
    drawingPath = [];
    document.removeEventListener('keydown', handleEscKey);
  }

  async function captureRegion(x, y, width, height) {
    return new Promise((resolve) => {
      // Request full page screenshot from background
      chrome.runtime.sendMessage(
        { type: "CAPTURE_VIEWPORT" },
        (response) => {
          if (response && response.image) {
            // Crop the image using canvas
            const img = new Image();
            img.onload = () => {
              const canvas = document.createElement('canvas');
              canvas.width = width;
              canvas.height = height;
              const ctx = canvas.getContext('2d');

              // Scale values for device pixel ratio
              const dpr = window.devicePixelRatio || 1;
              ctx.drawImage(
                img,
                x * dpr, y * dpr, width * dpr, height * dpr,
                0, 0, width, height
              );

              resolve(canvas.toDataURL('image/png'));
            };
            img.src = response.image;
          }
        }
      );
    });
  }

  // ==================================================
  // 🏁 INITIALIZATION
  // ==================================================
  function init() {
    if (!document.body) { window.requestAnimationFrame(init); return; }
    injectUI();
    setupGlobalListeners();
    initVideoTracking();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();

})();