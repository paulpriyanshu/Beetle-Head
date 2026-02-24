// ==================================================
// DOM ELEMENTS MODULE
// Centralized DOM element references
// ==================================================

export const DOM = {
  // Modal elements
  get ssModal() { return document.getElementById("ssModal"); },
  get ssClose() { return document.getElementById("ssClose"); },
  get ssVisible() { return document.getElementById("ssVisible"); },
  get ssFull() { return document.getElementById("ssFull"); },

  // Input elements
  get input() { return document.getElementById("siteInput"); },
  get sendBtn() { return document.getElementById("sendBtn"); },

  // Display elements
  get messages() { return document.getElementById("messages"); },
  get debugPanel() { return document.getElementById("debugPanel"); },

  // Toggle elements
  get debugToggle() { return document.getElementById("debugToggle"); },

  // Navigation tabs
  get btnChats() { return document.getElementById("btnChats"); },
  get btnNotes() { return document.getElementById("btnNotes"); },
  get btnAgent() { return document.getElementById("btnAgent"); },
  get navTabs() { return document.querySelectorAll(".nav-tab"); },

  // Header actions
  get btnModeToggle() { return document.getElementById("btnModeToggle"); },

  // Action buttons
  get btnScreenshot() { return document.getElementById("btnScreenshot"); },
  get btnScreenRecord() { return document.getElementById("btnScreenRecord"); },
  get btnWritingTool() { return document.getElementById("btnWritingTool"); },
  get btnCircleSearch() { return document.getElementById("btnCircleSearch"); },
  get btnShowTAbs() { return document.getElementById("btnShowTAbs"); },
  get btnNews() { return document.getElementById("btnNews"); },
  get btnSiteTheme() { return document.getElementById("btnSiteTheme"); },
  get btnHistory() { return document.getElementById("btnHistory"); },
  get chatHistoryView() { return document.getElementById("chatHistoryView"); },
  get chatHistoryList() { return document.getElementById("chatHistoryList"); },
  get btnBackToChat() { return document.getElementById("btnBackToChat"); },
  get btnBackToNotes() { return document.getElementById("btnBackToNotes"); }



};

// ==================================================
// INTERNAL STATE (to avoid circular dependency)
// ==================================================

let autoScrollEnabled = true;
let isUserScrollingFlag = false;

export function setAutoScroll(enabled) {
  autoScrollEnabled = enabled;
}

export function getAutoScroll() {
  return autoScrollEnabled;
}

// ==================================================
// DOM HELPER FUNCTIONS
// ==================================================

export function focusInput() {
  setTimeout(() => {
    if (document.activeElement !== DOM.input) {
      DOM.input?.focus();
    }
  }, 50);
}

export function autoGrowTextarea() {
  if (!DOM.input) return;
  DOM.input.style.height = 'auto';
  DOM.input.style.height = Math.min(DOM.input.scrollHeight, 120) + 'px';
}

export function setSendButtonToStop() {
  if (!DOM.sendBtn) return;
  DOM.sendBtn.textContent = "⏹";
  DOM.sendBtn.classList.add("stop-btn");
}

export function setSendButtonToSend() {
  if (!DOM.sendBtn) return;
  DOM.sendBtn.textContent = "↑";
  DOM.sendBtn.classList.remove("stop-btn");
}

// ==================================================
// SCROLL HELPERS (NO STORE DEPENDENCY)
// ==================================================

export function isScrolledToBottom() {
  if (!DOM.messages) return true;
  const threshold = 100;
  return DOM.messages.scrollHeight - DOM.messages.scrollTop - DOM.messages.clientHeight < threshold;
}

export function scrollToBottom(_unused) {
  if (!DOM.messages) return;
  if (autoScrollEnabled) {
    DOM.messages.scrollTop = DOM.messages.scrollHeight;
  }
}

export function smoothScrollToBottom() {
  if (!DOM.messages) return;
  if (autoScrollEnabled) {
    isUserScrollingFlag = true;
    DOM.messages.scrollTo({
      top: DOM.messages.scrollHeight,
      behavior: 'smooth'
    });
  }
}

// ==================================================
// SCROLL EVENT HANDLER
// ==================================================

export function setupScrollHandler() {
  if (!DOM.messages) return;

  DOM.messages.addEventListener('scroll', () => {
    if (isUserScrollingFlag) {
      isUserScrollingFlag = false;
      return;
    }

    if (isScrolledToBottom()) {
      autoScrollEnabled = true;
    } else {
      autoScrollEnabled = false;
      log("Auto-scroll paused - user scrolling up", "info");
    }
  });
}

// ==================================================
// DEBUG LOGGER
// ==================================================

export function log(message, type = "info") {
  if (!DOM.debugPanel) return;
  const line = document.createElement("div");
  line.className = `debug-line ${type}`;
  line.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
  DOM.debugPanel.appendChild(line);
  DOM.debugPanel.scrollTop = DOM.debugPanel.scrollHeight;
}

// ==================================================
// TAB HELPER
// ==================================================

export function openTab(url) {
  chrome.runtime.sendMessage({
    type: "OPEN_TAB",
    url
  });
}
// ==================================================
// SNAPSHOT UI FUNCTIONS
// ==================================================

export function addSnapshotProgress(format) {
    const card = document.createElement("div");
    card.className = "snapshot-progress-card";
    
    const label = format.replace('_', ' ').charAt(0).toUpperCase() + format.replace('_', ' ').slice(1);
    
    card.innerHTML = `
        <div class="snap-progress-header">
            <div class="snap-progress-title">
                <span>✨</span>
                <span>Generating ${label}...</span>
            </div>
            <div class="snap-progress-pct">0%</div>
        </div>
        <div class="snap-progress-bar-container">
            <div class="snap-progress-bar-fill"></div>
        </div>
        <div class="snap-progress-status">Initializing...</div>
    `;
    
    DOM.messages.appendChild(card);
    if (typeof scrollToBottom === 'function') scrollToBottom();
    
    return {
        update: (pct, status) => {
            const fill = card.querySelector('.snap-progress-bar-fill');
            const pctText = card.querySelector('.snap-progress-pct');
            const statusText = card.querySelector('.snap-progress-status');
            
            if (fill) fill.style.width = `${pct}%`;
            if (pctText) pctText.textContent = `${pct}%`;
            if (statusText) statusText.textContent = status;
        },
        remove: () => card.remove()
    };
}

export function addSnapshotPreviewCard(taskData, onDownload, onDelete) {
    const card = document.createElement("div");
    card.className = "snapshot-preview-card";
    
    const format = taskData.format || 'pdf';
    const label = format.toUpperCase();
    const icon = format === 'png' ? '🖼️' : (format === 'markdown' ? '📝' : '📄');
    const title = taskData.filename || `Snapshot ${taskData.task_id.slice(0, 8)}`;
    
    card.innerHTML = `
        <div class="snap-preview-header">
            <div class="snap-preview-icon">${icon}</div>
            <div class="snap-preview-info">
                <div class="snap-preview-title">${title}</div>
                <div class="snap-preview-meta">${label} Snapshot • ${new Date().toLocaleTimeString()}</div>
            </div>
        </div>
        <div class="snap-preview-actions">
            <button class="snap-action-btn snap-action-download">
                <i data-lucide="download"></i> Download
            </button>
            <button class="snap-action-btn snap-action-delete">
                <i data-lucide="trash-2"></i> Delete
            </button>
        </div>
    `;
    
    DOM.messages.appendChild(card);
    if (window.lucide) window.lucide.createIcons();
    if (typeof scrollToBottom === 'function') scrollToBottom();
    
    card.querySelector('.snap-action-download').onclick = onDownload;
    card.querySelector('.snap-action-delete').onclick = onDelete;
    
    return {
        remove: () => card.remove()
    };
}
