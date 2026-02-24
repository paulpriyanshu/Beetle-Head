// ==================================================
// SIDEBAR.JS - MAIN ENTRY POINT WITH AUTO VIDEO DETECTION
// ==================================================

// Import modules
import { DOM, log, focusInput, autoGrowTextarea, setSendButtonToStop, setSendButtonToSend, scrollToBottom, isScrolledToBottom, openTab } from './dom/elements.js';
import { store, API } from './state/store.js';
import { initScreenshot } from './features/screenshot.js';
import { initScreenRecord, handleRecordingData } from './features/screenrecord.js';
import { initAutofill, detectFormFillIntent, handleFormFillRequest } from './features/autofill.js';
import { useHighlightedTextAI, applyFixToWebpage } from './features/writingTool.js';
import { initNews } from './features/news.js';
import { initCircleSearch, handleCircleSearchResult } from './features/circleSearch.js';
import { initSmartSnapshot } from './features/smartSnapshot.js';

// ==================================================
// INITIALIZATION
// ==================================================

window.addEventListener('load', () => {
  console.log("🎯 Sidebar loaded, sending ready signal...");

  chrome.runtime.sendMessage({
    type: "SIDEBAR_READY"
  }).then(response => {
    console.log("✅ Ready signal acknowledged:", response);

    // 🆕 Initialize default context (active tab)
    initializeDefaultContext();

    // 🆕 Check for YouTube video and show preview
    setTimeout(() => {
      checkAndShowVideoPreview();
    }, 500);

    // 🆕 Listen for tab updates (navigation) while sidebar is open
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      if (changeInfo.status === 'complete' && tab.active) {
        console.log("🔄 Tab updated, checking for video preview...");
        checkAndShowVideoPreview();

        // 🆕 Update default context if not manual
        if (!isManualContext && tab.url && tab.url.startsWith('http')) {
          updateDefaultContext(tab);
        }

        // 🆕 Save context on update
        if (tab.url && tab.url.startsWith('http')) {
          saveContext(tab);
        }
      }
    });

    // 🆕 Listen for tab switching
    chrome.tabs.onActivated.addListener(async (activeInfo) => {
      console.log("🔀 Tab switched, checking for video preview...");
      checkAndShowVideoPreview();

      browserFocusedTabId = activeInfo.tabId; // 🆕 Track focus

      // 🆕 Save context for the new tab
      const tab = await chrome.tabs.get(activeInfo.tabId);

      // 🆕 Update default context if not manual
      if (!isManualContext && tab && tab.url && tab.url.startsWith('http')) {
        updateDefaultContext(tab);
      }

      if (tab && tab.url && tab.url.startsWith('http')) {
        saveContext(tab);
      }
    });
  }).catch(err => {
    console.log("⚠️ Ready signal failed (this is OK on first load):", err.message);
  });
});

// Backup ready signal
setTimeout(() => {
  chrome.runtime.sendMessage({
    type: "SIDEBAR_READY"
  }).then(() => {
    // Check for video preview on backup ready
    setTimeout(() => {
      checkAndShowVideoPreview();
    }, 300);
  }).catch(() => { });
}, 500);

// ==================================================
// 🆕 YOUTUBE VIDEO PREVIEW - AUTO DETECTION
// ==================================================

async function checkAndShowVideoPreview() {
  try {
    // Get current tab info
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab || !tab.url || isRestrictedPage(tab.url)) return;

    const url = tab.url;

    // Check if it's a YouTube video
    if (url.includes('youtube.com/watch')) {
      console.log("🎥 YouTube video detected, showing preview card");
      await showYouTubeVideoPreview(tab);
    }
  } catch (error) {
    console.error("Error checking for video:", error);
  }
}

// 🆕 Save Context to Vector DB
async function saveContext(tab) {
  if (!tab || isRestrictedPage(tab.url)) return;
  console.log("💾 Saving context for tab:", tab.title);
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: extractDOMTree
    });

    const pageContext = results?.[0]?.result;

    if (pageContext) {
      // We can optimize this by checking if we recently saved this URL
      // For now, let's just send it
      const auth = await new Promise(resolve => chrome.storage.local.get(['access_token'], resolve));
      const token = auth.access_token;

      fetch(API.CONTEXT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          url: tab.url,
          title: tab.title,
          raw_html: pageContext, // Use the extracted DOM tree structure
          // We could also send just text content if extractDOMTree is too heavy, 
          // but the backend handles parsing.
        })
      }).then(res => res.json()).then(data => {
        console.log("✅ Context saved:", data);
      }).catch(eff => console.error("❌ Context save failed:", eff));
    }
  } catch (error) {
    console.error("❌ Error extracting context for save:", error);
  }
}

async function showYouTubeVideoPreview(tab) {
  // Extract video info
  let videoTitle = "YouTube Video";
  let channelName = "";
  let thumbnailUrl = "";

  try {
    // Try to get video info from page
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: extractYouTubeVideoInfo
    });

    if (results && results[0] && results[0].result) {
      const videoInfo = results[0].result;
      videoTitle = videoInfo.title || videoTitle;
      channelName = videoInfo.channel || "";
      thumbnailUrl = videoInfo.thumbnail || "";
    }
  } catch (error) {
    console.log("Could not extract video info:", error);
    videoTitle = tab.title.replace(" - YouTube", "");
  }

  // Create and show the preview card
  renderVideoPreviewCard(videoTitle, channelName, thumbnailUrl, tab.url);
}

function extractYouTubeVideoInfo() {
  try {
    const titleEl = document.querySelector('h1.ytd-watch-metadata') ||
      document.querySelector('h1.title') ||
      document.querySelector('h1');

    const channelEl = document.querySelector('#channel-name a') ||
      document.querySelector('ytd-channel-name a') ||
      document.querySelector('.ytd-channel-name a');

    const thumbnailEl = document.querySelector('video') ||
      document.querySelector('.ytp-cued-thumbnail-overlay-image');

    return {
      title: titleEl ? titleEl.textContent.trim() : null,
      channel: channelEl ? channelEl.textContent.trim() : null,
      thumbnail: thumbnailEl ? (thumbnailEl.poster || thumbnailEl.style.backgroundImage?.match(/url\("(.+)"\)/)?.[1]) : null
    };
  } catch (error) {
    return null;
  }
}

function renderVideoPreviewCard(title, channel, thumbnail, url) {
  // Check if preview already exists
  let card = document.querySelector('.video-preview-card');
  const isNewCard = !card;

  if (isNewCard) {
    card = document.createElement('div');
    card.className = 'video-preview-card';
  }

  const videoId = extractVideoId(url);

  // Respect dismissal
  if (videoId && dismissedVideos.has(videoId)) {
    if (card) card.remove();
    return;
  }

  const thumbUrl = thumbnail || `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;

  card.innerHTML = `
    <div class="video-preview-header">
      <div class="video-preview-icon">📺</div>
      <div class="video-preview-title-section">
        <div class="video-preview-badge">YouTube Video Detected</div>
        <div class="video-preview-subtitle">Choose an action below</div>
      </div>
      <button class="video-preview-close" title="Dismiss">✕</button>
    </div>
    
    <div class="video-preview-content">
      <div class="video-preview-thumbnail">
        <img src="${thumbUrl}" alt="Video thumbnail" class="preview-thumb">
        <div class="video-preview-play-icon">▶</div>
      </div>
      
      <div class="video-preview-info">
        <div class="video-preview-video-title">${escapeHTML(title)}</div>
        ${channel ? `<div class="video-preview-channel">by ${escapeHTML(channel)}</div>` : ''}
      </div>
    </div>
    
    <div class="video-preview-actions">
      <button class="video-action-btn video-action-primary" data-action="summarize-video">
        <span class="video-action-icon">🎬</span>
        <div class="video-action-text">
          <div class="video-action-label">Summarize Video</div>
          <div class="video-action-desc">Get key points from this video</div>
        </div>
      </button>
      
      <button class="video-action-btn video-action-secondary" data-action="summarize-page">
        <span class="video-action-icon">📄</span>
        <div class="video-action-text">
          <div class="video-action-label">Summarize Page</div>
          <div class="video-action-desc">Include description & comments</div>
        </div>
      </button>
    </div>
  `;

  // Add to messages area if it's a new card
  if (isNewCard) {
    DOM.messages.appendChild(card);
  }

  scrollToBottom();

  // Handle Close Button dismissal removed
  // Respect dismissal for preview removed

  // Setup thumbnail error handler
  const thumbImg = card.querySelector('.preview-thumb');
  if (thumbImg) {
    thumbImg.onerror = () => { thumbImg.style.display = 'none'; };
  }

  // Setup close button
  card.querySelector('.video-preview-close').onclick = () => {
    card.style.animation = 'fadeOut 0.3s ease';
    setTimeout(() => card.remove(), 300);
  };

  // Setup action buttons
  card.querySelector('[data-action="summarize-video"]').onclick = () => {
    handleVideoAction('summarize-video', card);
  };

  card.querySelector('[data-action="summarize-page"]').onclick = () => {
    handleVideoAction('summarize-page', card);
  };
}

function handleVideoAction(action, card) {
  // Visual feedback
  card.style.opacity = '0.6';
  card.style.pointerEvents = 'none';

  let message = "";

  if (action === 'summarize-video') {
    message = "Summarize this YouTube video";
  } else if (action === 'summarize-page') {
    message = "Summarize this page including the video, description, and comments";
  }

  // Send the message
  setTimeout(() => {
    sendMessage(message);
  }, 400);
}

function extractVideoId(url) {
  if (!url) return '';
  try {
    const urlObj = new URL(url);
    if (urlObj.hostname.includes('youtu.be')) {
      return urlObj.pathname.slice(1);
    }
    if (urlObj.pathname.includes('/shorts/')) {
      return urlObj.pathname.split('/shorts/')[1].split(/[?#]/)[0];
    }
    return urlObj.searchParams.get('v') || '';
  } catch {
    // Fallback regex for non-standard formats
    const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:v\/|u\/\w\/|embed\/|watch\?v=))([^#\&\?]*)/);
    return (match && match[1].length === 11) ? match[1] : '';
  }
}

// ==================================================
// INITIALIZE FEATURES
// ==================================================

// ==================================================
// ROBUST INITIALIZATION
// ==================================================

function initializeSidebar() {
  console.log("🚀 Initializing sidebar components...");

  // Initialize Lucide Icons
  if (window.lucide) {
    window.lucide.createIcons();
  }

  try {
    // 1. Feature Modules
    if (typeof initScreenshot === 'function') initScreenshot(store);
    if (typeof initScreenRecord === 'function') initScreenRecord(store);
    if (typeof initNews === 'function') initNews(store);
    if (typeof initAutofill === 'function') initAutofill();
    if (typeof initCircleSearch === 'function') initCircleSearch();
    if (typeof initSmartSnapshot === 'function') initSmartSnapshot();

    // 2. Input Handling
    if (DOM.input) {
      DOM.input.addEventListener('input', autoGrowTextarea);
      DOM.input.addEventListener("keydown", handleInputKeydown);
    } else {
      console.warn("⚠️ DOM.input not found during initialization");
    }

    // 3. Send Button
    if (DOM.sendBtn) {
      DOM.sendBtn.addEventListener("click", handleSendClick);
    } else {
      console.warn("⚠️ DOM.sendBtn not found during initialization");
    }

    // 4. Scroll & Visibility
    if (DOM.messages) {
      DOM.messages.addEventListener('scroll', handleScroll);
    }

    window.addEventListener("load", focusInput);
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) focusInput();
    });

    // 5. Theme Enforced (Legacy toggle removed)
    if (chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ enforcedTheme: 'dark' });
    }
    document.body.classList.add('theme-dark');
    document.body.classList.remove('theme-light');


    // 6. Navigation Buttons
    // 6. Navigation Tabs
    const tabs = {
      chats: DOM.btnChats,
      notes: DOM.btnNotes,
      agent: DOM.btnAgent
    };

    window.switchTabInternal = function (activeId) {
      const currentTab = document.querySelector('.nav-tab.active')?.id;

      // If clicking already active tab, show history (except Agent/Theme)
      if (currentTab === activeId) {
        if (activeId === 'btnChats') {
          showChatHistory();
          return;
        } else if (activeId === 'btnNotes') {
          showNotesHistory();
          return;
        }
      }

      DOM.navTabs.forEach(tab => {
        const isTarget = tab.id === activeId || (activeId === 'btnMedia' && tab.id === 'btnProfile');
        tab.classList.toggle('active', isTarget);
      });

      // Handle Content Visibility
      const messagesArea = document.getElementById('messages');
      const notesArea = document.getElementById('notesTab');
      const chatHistoryArea = document.getElementById('chatHistoryView');
      const mediaArea = document.getElementById('mediaTab');

      // Reset all views
      [messagesArea, notesArea, chatHistoryArea, mediaArea].forEach(area => {
        if (area) {
          area.classList.remove('active');
          area.style.display = 'none'; // Fallback
        }
      });

      if (activeId === 'btnNotes') {
        if (notesArea) {
          notesArea.classList.add('active');
          notesArea.style.display = 'flex';
          renderGeneralNotes();
          // Hide back button in main notes view
          const backBtn = document.getElementById('btnBackToNotes');
          if (backBtn) backBtn.style.display = 'none';
        }
      } else if (activeId === 'btnHistory') {
        showChatHistory();
      } else if (activeId === 'btnMedia') {
        if (mediaArea) {
          mediaArea.classList.add('active');
          mediaArea.style.display = 'flex';
          renderMediaGallery();
        }
      } else {
        // Default to chats (btnChats, btnAgent transitions, etc)
        if (messagesArea) {
          messagesArea.classList.add('active');
          messagesArea.style.display = 'flex';
        }
      }

      // Refresh icons for any new content (like empty states)
      if (window.lucide) {
        window.lucide.createIcons();
      }
    };

    const switchTab = window.switchTabInternal;

    if (tabs.chats) {
      tabs.chats.addEventListener('click', () => {
        switchTab('btnChats');
      });
    }

    if (tabs.notes) {
      tabs.notes.addEventListener('click', () => {
        switchTab('btnNotes');
      });
    }

    if (DOM.btnHistory) {
      DOM.btnHistory.addEventListener('click', () => {
        switchTab('btnHistory');
      });
    }

    if (DOM.btnBackToChat) {
      DOM.btnBackToChat.addEventListener('click', () => {
        switchTab('btnChats');
      });
    }

    const btnBackFromMedia = document.getElementById('btnBackFromMedia');
    if (btnBackFromMedia) {
      btnBackFromMedia.addEventListener('click', () => {
        switchTab('btnChats');
      });
    }

    if (DOM.btnBackToNotes) {
      DOM.btnBackToNotes.addEventListener('click', () => {
        // Go back to main chat view
        switchTab('btnChats');
      });
    }

    if (tabs.agent) {
      tabs.agent.addEventListener('click', () => {
        handleAgentToggle();
      });
    }


    // 7. Feature Listeners
    const btnWritingTool = document.getElementById('btnWritingTool');
    if (btnWritingTool) {
      btnWritingTool.addEventListener('click', () => {
        if (DOM.input) {
          DOM.input.value = "Summarise this page";
          autoGrowTextarea();
          focusInput();
        }
        if (typeof sendMessage === 'function') sendMessage("Summarise this page");
      });
    }

    // 🆕 New Chat Button
    const btnNewChat = document.getElementById('btnNewChat');
    if (btnNewChat) {
      btnNewChat.addEventListener('click', () => {
        if (typeof startNewChat === 'function') {
          startNewChat();
        } else {
          // Inline logic if function not defined
          store.setConversationId(null);
          DOM.messages.innerHTML = '';
          addSystemBotMessage("✨ Started a new chat.");
          switchTab('btnChats');
        }
      });
    }

    // Show all tabs in carousel
    const btnShowTabs = document.getElementById('btnShowTAbs');
    if (btnShowTabs) {
      btnShowTabs.addEventListener('click', showTabsCarousel);
    }

    const btnSiteTheme = document.getElementById('btnSiteTheme');
    if (btnSiteTheme) {
      btnSiteTheme.addEventListener('click', toggleWebsiteTheme);
    }

    // 8. Debug and Agent Toggles
    if (DOM.debugToggle && DOM.debugPanel) {
      DOM.debugToggle.onclick = () => {
        DOM.debugPanel.classList.toggle('active');
      };
    }

    // 9. Tools Toggle
    const btnToolsToggle = document.getElementById('btnToolsToggle');
    const actionBar = document.querySelector('.floating-action-bar');
    if (btnToolsToggle && actionBar) {
      btnToolsToggle.addEventListener('click', () => {
        const isCollapsed = actionBar.classList.toggle('collapsed');
        btnToolsToggle.classList.toggle('active', isCollapsed);

        // Also toggle the tabs carousel for context
        toggleInputTabsCarousel();
      });
    }

    // 🆕 Initializations
    initYouTubeNotes();
    initGeneralNotes();
    initPlusMenu();
    initAuth();

    log("✅ Sidebar initialized", "success");
  } catch (error) {
    console.error("❌ Initialization error:", error);
    log(`❌ Init error: ${error.message}`, "error");
  }
}

// 🆕 Plus Menu Logic
function initPlusMenu() {
  const container = document.querySelector('.plus-menu-container');
  const btn = document.getElementById('btnPlusMenu');

  if (!container || !btn) return;

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    container.classList.toggle('active');
  });

  document.addEventListener('click', () => {
    container.classList.remove('active');
  });

  // Prevent closing when clicking inside dropdown
  const dropdown = document.querySelector('.plus-dropdown');
  if (dropdown) {
    dropdown.addEventListener('click', (e) => e.stopPropagation());
  }

  // Hook up actions
  // New Chat is handled by existing listener on #btnNewChat if ID matches
  const btnNewChat = document.getElementById('btnNewChat');
  if (btnNewChat) {
    btnNewChat.addEventListener('click', () => {
      container.classList.remove('active');
      // Start new chat logic reuse
      if (typeof startNewChat === 'function') {
        startNewChat();
      } else {
        // Fallback
        store.setConversationId(null);
        DOM.messages.innerHTML = '';
        addSystemBotMessage("✨ Started a new chat.");
        switchTab('btnChats');
      }
    });
  }

  const btnUpload = document.getElementById('btnUploadFile');
  if (btnUpload) {
    btnUpload.addEventListener('click', () => {
      container.classList.remove('active');

      const fileInput = document.createElement('input');
      fileInput.type = 'file';
      fileInput.accept = 'image/*';
      fileInput.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        log(`📂 Uploading ${file.name}...`, "info");

        const reader = new FileReader();
        reader.onload = async (event) => {
          const base64Data = event.target.result;
          const result = await window.uploadMediaToR2(base64Data, file.name, 'image', 'uploaded');
          if (result.status === "success") {
            log("✅ File uploaded successfully", "success");
            window.showInputPreview(result.file_url);
          } else {
            log(`❌ Upload failed: ${result.message}`, "error");
          }
        };
        reader.readAsDataURL(file);
      };
      fileInput.click();
    });
  }

  const btnPhoto = document.getElementById('btnTakePhoto');
  if (btnPhoto) {
    btnPhoto.addEventListener('click', async () => {
      container.classList.remove('active');

      try {
        log("📸 Opening camera...", "info");
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });

        // Show a simple modal for camera capture
        const video = document.createElement('video');
        video.srcObject = stream;
        video.autoplay = true;
        video.style.width = '100%';
        video.style.borderRadius = '8px';

        const captureBtn = document.createElement('button');
        captureBtn.textContent = "Capture Photo";
        captureBtn.className = "login-btn-primary"; // reuse style
        captureBtn.style.marginTop = '10px';

        const modal = document.createElement('div');
        modal.className = "ss-modal";
        modal.style.zIndex = '10005';
        modal.innerHTML = `
          <div class="ss-modal-backdrop"></div>
          <div class="ss-modal-card" style="padding: 20px;">
            <div class="ss-modal-header">
              <span>Take Photo</span>
              <button class="ss-close">✕</button>
            </div>
            <div class="ss-modal-body" style="display: flex; flex-direction: column; align-items: center;">
            </div>
          </div>
        `;
        document.body.appendChild(modal);
        modal.querySelector('.ss-modal-body').appendChild(video);
        modal.querySelector('.ss-modal-body').appendChild(captureBtn);

        const closeCamera = () => {
          stream.getTracks().forEach(track => track.stop());
          modal.remove();
        };

        modal.querySelector('.ss-close').onclick = closeCamera;

        captureBtn.onclick = async () => {
          const canvas = document.createElement('canvas');
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          canvas.getContext('2d').drawImage(video, 0, 0);
          const imageData = canvas.toDataURL('image/png');

          closeCamera();
          log("📸 Photo captured, uploading...", "info");

          const result = await window.uploadMediaToR2(imageData, `photo_${Date.now()}.png`, 'image', 'uploaded');
          if (result.status === "success") {
            log("✅ Photo uploaded successfully", "success");
            window.showInputPreview(result.file_url);
          } else {
            log(`❌ Upload failed: ${result.message}`, "error");
          }
        };

      } catch (err) {
        log(`❌ Camera error: ${err.message}`, "error");
        addSystemBotMessage("📸 Camera feature could not be opened. Ensure you have given permissions.");
      }
    });
  }
}

// Run initialization
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeSidebar);
} else {
  initializeSidebar();
}

// ==================================================
// 🆕 GENERAL NOTES LOGIC
// ==================================================
function initGeneralNotes() {
  const saveBtn = document.getElementById('saveGeneralNoteBtn');
  if (saveBtn) {
    saveBtn.onclick = () => {
      const input = document.getElementById('generalNoteInput');
      const text = input.value.trim();
      if (text) {
        saveGeneralNote(text);
        input.value = '';
      }
    };
  }
}

async function saveGeneralNote(text) {
  try {
    const auth = await new Promise(resolve => chrome.storage.local.get(['access_token'], resolve));
    const token = auth.access_token;

    // addSystemBotMessage("Saving note...", "system");
    const saveBtn = document.getElementById('saveGeneralNoteBtn');
    saveBtn.disabled = true;
    saveBtn.textContent = "Saving...";

    const response = await fetch(API.NOTES, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({
        content: text,
        note_type: 'general',
        created_at: new Date().toISOString()
      })
    });

    saveBtn.disabled = false;
    saveBtn.textContent = "Save General Note";

    const data = await response.json();
    if (data.status === "success") {
      renderGeneralNotes();
      log("📓 General note saved to DB", "success");
    } else {
      log(`❌ Save failed: ${data.message}`, "error");
    }
  } catch (error) {
    console.error("Save note error:", error);
    log("❌ Save note failed", "error");
  }
}

async function renderGeneralNotes() {
  const container = document.getElementById('generalNotesList');
  if (!container) return;

  // Show skeleton loader
  container.innerHTML = `
    <div class="notes-skeleton">
      ${Array(3).fill(0).map((_, i) => `
        <div class="skeleton-note-card ${i % 2 === 0 ? 'general' : ''}">
          ${i % 2 === 1 ? `
            <div class="skeleton-note-header">
              <div class="skeleton skeleton-note-thumb"></div>
              <div class="skeleton-note-content">
                <div class="skeleton skeleton-note-title"></div>
                <div class="skeleton skeleton-note-text"></div>
                <div class="skeleton skeleton-note-date"></div>
              </div>
            </div>
          ` : `
            <div class="skeleton-note-content">
              <div class="skeleton skeleton-note-text"></div>
              <div class="skeleton skeleton-note-text short"></div>
              <div class="skeleton skeleton-note-date"></div>
            </div>
          `}
        </div>
      `).join('')}
    </div>
  `;


  try {
    const auth = await new Promise(resolve => chrome.storage.local.get(['access_token'], resolve));
    const token = auth.access_token;

    const response = await fetch(API.NOTES, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${token}`
      }
    });

    const data = await response.json();
    const notes = data.notes || [];

    if (notes.length === 0) {
      container.innerHTML = `<div class="empty-notes"><span class="empty-icon"><i data-lucide="book-open"></i></span><p>No notes yet.</p></div>`;
      if (window.lucide) window.lucide.createIcons();
      return;
    }

    container.innerHTML = notes.map(note => {
      // Handle Video Notes
      if (note.note_type === 'video' || note.video_url) {
        const thumb = note.thumbnail_url || getYouTubeThumbnail(note.video_url);
        return `
          <div class="note-card video-note-card" data-url="${note.video_url}" data-time="${note.timestamp}">
            <button class="delete-note" data-id="${note.id}">✕</button>
            <div class="note-video-preview">
              <img src="${thumb}" alt="Thumbnail">
             ${note.timestamp ? `<span class="note-timestamp-badge">${note.timestamp}</span>` : ''}
            </div>
            <div class="note-content-area">
              <div class="note-video-title">${escapeHTML(note.video_title || 'Video Note')}</div>
              <div class="note-text">${escapeHTML(note.content)}</div>
              <div class="note-date">${new Date(note.created_at).toLocaleDateString()}</div>
            </div>
          </div>
        `;
      }
      // General Notes
      return `
        <div class="note-card">
          <button class="delete-note" data-id="${note.id}">✕</button>
          <div class="note-text">${escapeHTML(note.content)}</div>
          <div class="note-date">${new Date(note.created_at).toLocaleDateString()}</div>
        </div>
      `;
    }).join('');

    // Add click handlers
    container.querySelectorAll('.video-note-card').forEach(card => {
      card.onclick = (e) => {
        if (e.target.classList.contains('delete-note')) return;
        const url = card.dataset.url;
        chrome.tabs.create({ url: url });
      };
    });

    container.querySelectorAll('.delete-note').forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        deleteUnifiedNote(btn.dataset.id);
      };
    });

    if (window.lucide) window.lucide.createIcons();

  } catch (error) {
    console.error("Load notes error:", error);
    container.innerHTML = `<div class="error-notes">Failed to load notes</div>`;
  }
}

function deleteUnifiedNote(id) {
  chrome.storage.local.get(['all_notes'], (result) => {
    const notes = (result.all_notes || []).filter(n => n.id != id);
    chrome.storage.local.set({ all_notes: notes }, () => {
      renderGeneralNotes();
      // Re-render all active trackers
      videoTrackers.forEach((card, videoId) => {
        const list = card.querySelector('.video-notes-list');
        if (list && !card.querySelector('.video-notes-body').classList.contains('hidden')) {
          renderVideoNotes(videoId, list);
        }
      });
    });
  });
}

function getYouTubeThumbnail(url) {
  const id = extractVideoId(url);
  return id ? `https://img.youtube.com/vi/${id}/mqdefault.jpg` : '';
}


// ==================================================
// 🆕 YOUTUBE TRACKING & NOTES LOGIC
// ==================================================
let videoStates = new Map(); // id -> data
let videoTrackers = new Map(); // id -> DOM element

function initLayoutControls() {
  const resizer = document.getElementById('videoResizer');
  const videoArea = document.getElementById('videoProgressArea');
  const mainContent = document.querySelector('.main-content');
  const expandBtn = document.getElementById('btnExpandChat');

  if (!resizer || !videoArea || !mainContent) return;

  let isResizing = false;
  let lastVideoHeight = 120; // Default or stored
  let isExpanded = false;

  // 1. DRAG LOGIC
  resizer.addEventListener('mousedown', (e) => {
    isResizing = true;
    document.body.style.cursor = 'row-resize';
    document.body.classList.add('resizing');
  });

  document.addEventListener('mousemove', (e) => {
    if (!isResizing) return;

    // Calculate new height based on mouse Y position
    // Sidebar header is approx 64px
    const headerHeight = 64;
    let newHeight = e.clientY - headerHeight;

    // Bounds
    if (newHeight < 0) newHeight = 0;
    if (newHeight > 300) newHeight = 300; // Max tracker height

    videoArea.style.height = `${newHeight}px`;
    lastVideoHeight = newHeight;

    // Update expand state if manually closed
    if (newHeight === 0 && !isExpanded) {
      toggleExpand(true);
    } else if (newHeight > 0 && isExpanded) {
      toggleExpand(false);
    }
  });

  document.addEventListener('mouseup', () => {
    if (isResizing) {
      isResizing = false;
      document.body.style.cursor = 'default';
      document.body.classList.remove('resizing');
    }
  });

  // 2. EXPAND LOGIC
  function toggleExpand(forceExpand = null) {
    isExpanded = forceExpand !== null ? forceExpand : !isExpanded;

    if (isExpanded) {
      videoArea.dataset.prevHeight = videoArea.style.height || lastVideoHeight + 'px';
      videoArea.style.height = '0px';
      resizer.style.display = 'none';
      if (expandBtn) {
        expandBtn.innerHTML = '<i data-lucide="minimize-2"></i>';
        if (window.lucide) window.lucide.createIcons();
      }
      log("⬆ Chat expanded", "info");
    } else {
      const restoreHeight = videoArea.dataset.prevHeight || '120px';
      videoArea.style.height = restoreHeight;
      resizer.style.display = 'block';
      if (expandBtn) {
        expandBtn.innerHTML = '<i data-lucide="maximize-2"></i>';
        if (window.lucide) window.lucide.createIcons();
      }
      log("⬇ Video area restored", "info");
    }
  }

  if (expandBtn) {
    expandBtn.onclick = () => toggleExpand();
  }
}


function initYouTubeNotes() {
  console.log("🎬 Initializing YouTube notes logic...");
  initLayoutControls();

  // 1. Listen for background updates
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === "VIDEO_PROGRESS_UPDATE") {
      updateVideoProgressUI(request.data);
    }

    // 🆕 Circle Search Result
    if (request.type === "CIRCLE_SEARCH_RESULT") {
      console.log("🔍 Received circle search result in sidebar");
      handleCircleSearchResult(request.imageData, request.pageUrl, request.pageTitle);
      sendResponse({ success: true });
      return true;
    }
  });
}

let isVideoNotesExpanded = false;

function updateVideoProgressUI(data) {
  const videoId = extractVideoId(data.url);
  if (!videoId) return;

  const isNewVideo = !videoStates.has(videoId);
  videoStates.set(videoId, data);

  const progressStr = formatTime(data.currentTime);
  const durationStr = formatTime(data.duration);
  const percent = (data.currentTime / data.duration) * 100;

  // Render progress bar in Chat area
  const container = document.getElementById('videoProgressArea');
  if (!container) return;

  // Respect dismissal removed as per user request

  // Check if we already have a tracker for this video
  let card = videoTrackers.get(videoId);

  if (!card) {
    const template = document.getElementById('videoNotesTemplate');
    if (template) {
      const clone = template.content.cloneNode(true);
      card = clone.querySelector('.video-progress-card');
      card.setAttribute('data-video-id', videoId);
      container.appendChild(card);
      videoTrackers.set(videoId, card);

      // Initialize contextual UI for this specific card
      setupVideoNotesContextualUI(card, videoId);
    }
  }

  if (card) {
    // Update progress info
    const titleLabel = card.querySelector('.video-title-label');
    const timeLabel = card.querySelector('.video-time-label');
    const progressBar = card.querySelector('.progress-bar');
    const saveTimeLabel = card.querySelector('.video-current-time-label');

    if (titleLabel) titleLabel.textContent = `🎬 ${data.title.substring(0, 30)}...`;
    if (timeLabel) timeLabel.textContent = `${progressStr} / ${durationStr}`;
    if (progressBar) progressBar.style.width = `${percent}%`;
    if (saveTimeLabel) saveTimeLabel.textContent = progressStr;

    // If it's a new video state (first time seen), render notes
    // We don't use isVideoNotesExpanded globally anymore, each card has its own state
    const body = card.querySelector('.video-notes-body');
    if (isNewVideo && body && !body.classList.contains('hidden')) {
      renderVideoNotes(videoId, card.querySelector('.video-notes-list'));
    }
  }

  if (window.lucide) window.lucide.createIcons();
}

function setupVideoNotesContextualUI(card, videoId) {
  const expandBtn = card.querySelector('.video-notes-toggle-header');
  const body = card.querySelector('.video-notes-body');
  const saveBtn = card.querySelector('.save-video-note-btn');
  const input = card.querySelector('.video-note-input');
  const list = card.querySelector('.video-notes-list');

  // closeBtn logic removed as per user request

  if (expandBtn && body) {
    expandBtn.onclick = () => {
      const isHidden = body.classList.toggle('hidden');
      // expandBtn.textContent = isHidden ? '▼' : '▲';
      if (!isHidden) {
        renderVideoNotes(videoId, list);
        if (input) input.focus();
      }
    };
  }

  if (saveBtn && input) {
    saveBtn.onclick = () => {
      const text = input.value.trim();
      if (text) {
        saveVideoNote(videoId, text, () => {
          input.value = '';
          renderVideoNotes(videoId, list);
          // Also refresh general notes to show the new video note
          renderGeneralNotes();
        });
      }
    };

    input.onkeydown = (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        saveBtn.click();
      }
    };
  }
}

async function saveVideoNote(videoId, text, callback) {
  const state = videoStates.get(videoId);
  if (!state) return;

  const note = {
    id: Date.now().toString(),
    type: 'video',
    text: text,
    timestamp: state.currentTime,
    timestampStr: formatTime(state.currentTime),
    videoUrl: state.url,
    videoTitle: state.title,
    thumbnailUrl: getYouTubeThumbnail(state.url),
    date: new Date().toISOString()
  };

  chrome.storage.local.get(['all_notes'], (result) => {
    const notes = result.all_notes || [];
    notes.unshift(note);
    chrome.storage.local.set({ all_notes: notes }, () => {
      log("🎬 Video note saved at " + note.timestampStr, "success");
      if (callback) callback();
    });
  });
}

function renderVideoNotes(videoId, listSelectorOrEl) {
  const container = typeof listSelectorOrEl === 'string' ? document.querySelector(listSelectorOrEl) : listSelectorOrEl;
  if (!container) return;

  chrome.storage.local.get(['all_notes'], (result) => {
    const allNotes = result.all_notes || [];
    const notes = allNotes.filter(n => n.type === 'video' && extractVideoId(n.videoUrl) === videoId);

    if (notes.length === 0) {
      container.innerHTML = `<p style="font-size: 11px; color: var(--text-secondary); text-align: center; padding: 10px;">No video notes yet.</p>`;
      return;
    }

    container.innerHTML = notes.map(note => `
      <div class="note-card compact" data-id="${note.id}">
        <button class="delete-note" data-id="${note.id}">✕</button>
        <div class="note-timestamp" data-time="${note.timestamp}" data-url="${note.videoUrl}">${formatTime(note.timestamp)}</div>
        <div class="note-text" style="font-size: 12px;">${escapeHTML(note.text)}</div>
      </div>
    `).join('');

    container.querySelectorAll('.note-timestamp').forEach(el => {
      el.onclick = () => seekVideo(parseFloat(el.dataset.time), el.dataset.url);
    });

    container.querySelectorAll('.delete-note').forEach(btn => {
      btn.onclick = () => {
        deleteUnifiedNote(btn.dataset.id);
        // We need to re-render THIS list specifically
        setTimeout(() => renderVideoNotes(videoId, container), 100);
      };
    });
  });
}


window.seekVideo = function (time, videoUrl) {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const activeTab = tabs[0];
    const targetId = extractVideoId(videoUrl);
    const currentId = activeTab ? extractVideoId(activeTab.url) : null;

    const isSameVideo = targetId && currentId === targetId;

    if (isSameVideo) {
      log("🎯 Seeking in active video: " + formatTime(time), "info");
      chrome.tabs.sendMessage(activeTab.id, {
        type: "VIDEO_SEEK",
        time: time
      }, (response) => {
        if (chrome.runtime.lastError) {
          console.error("Seeking failed:", chrome.runtime.lastError.message);
          log("❌ Communication error with YouTube", "error");
        }
      });
    } else {
      // Open in new tab with timestamp
      try {
        const url = new URL(videoUrl);
        url.searchParams.set('t', Math.floor(time) + 's');
        log("🚀 Opening video in new tab with timestamp", "info");
        chrome.runtime.sendMessage({
          type: "OPEN_TAB",
          url: url.href
        });
      } catch (e) {
        console.error("Error formatting video URL:", e);
      }
    }
  });
};

function formatTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// ==================================================
// 🆕 HISTORY MANAGEMENT
// ==================================================

// 🆕 Save chat history is now handled by backend
function saveChatToHistory(prompt) {
  // Logic migrated to backend. 
  // This function is kept to avoid breaking calls but does nothing locally.
}

function showChatHistory() {
  const messagesArea = document.getElementById('messages');
  const chatHistoryArea = document.getElementById('chatHistoryView');
  const notesArea = document.getElementById('notesTab');

  if (messagesArea) messagesArea.style.display = 'none';
  if (notesArea) notesArea.style.display = 'none';
  if (chatHistoryArea) {
    chatHistoryArea.style.display = 'flex';
    renderChatHistory();
  }

  // Update nav tabs
  DOM.navTabs.forEach(tab => tab.classList.remove('active'));
  if (DOM.btnHistory) DOM.btnHistory.classList.add('active');
}

async function renderChatHistory() {
  const container = document.getElementById('chatHistoryList');
  if (!container) return;

  // Show skeleton loader
  container.innerHTML = `
    <div class="history-skeleton">
      ${Array(5).fill(0).map(() => `
        <div class="skeleton-history-item">
          <div class="skeleton skeleton-history-title"></div>
          <div class="skeleton-history-meta">
            <div class="skeleton skeleton-history-date"></div>
            <div class="skeleton skeleton-history-time"></div>
          </div>
        </div>
      `).join('')}
    </div>
  `;


  try {
    const auth = await new Promise(resolve => chrome.storage.local.get(['access_token'], resolve));
    const token = auth.access_token;

    const response = await fetch(API.CONVERSATIONS, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${token}`
      }
    });

    const data = await response.json();
    const history = data.conversations || [];

    if (history.length === 0) {
      container.innerHTML = `<div class="empty-history"><span class="empty-icon"><i data-lucide="message-square-off"></i></span><p>No chat history yet.</p></div>`;
      if (window.lucide) window.lucide.createIcons();
      return;
    }

    container.innerHTML = history.map(item => `
      <div class="history-item" data-id="${item.id}">
        <div class="history-item-title">${escapeHTML(item.title)}</div>
        <div class="history-item-meta">
          <span>${new Date(item.updated_at).toLocaleDateString()}</span>
          <span>${new Date(item.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
      </div>
    `).join('');

    // Add click listeners to load
    container.querySelectorAll('.history-item').forEach(el => {
      el.onclick = async () => {
        const id = el.dataset.id;
        const title = el.querySelector('.history-item-title').textContent;

        console.log(`Open chat ${id}`);

        // Load messages
        await loadConversationMessages(id, title);

        switchTab('btnChats');
      };
    });

  } catch (error) {
    console.error("Failed to load history:", error);
    container.innerHTML = `<div class="error-history">Failed to load history</div>`;
  }
}

// 🆕 Load Conversation Messages
async function loadConversationMessages(id, title) {
  try {
    const auth = await new Promise(resolve => chrome.storage.local.get(['access_token'], resolve));
    const token = auth.access_token;

    // 1. Set State
    store.setConversationId(id);

    // 2. Fetch Messages
    addSystemBotMessage(`🔄 Loading chat: "${title}"...`);

    const response = await fetch(`${API.CONVERSATIONS}/${id}/messages`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${token}`
      }
    });

    const data = await response.json();

    if (data.status === "success") {
      // 3. Clear Chat
      DOM.messages.innerHTML = '';

      // 4. Render Messages
      // Sort by creation time if needed, but backend sends ordered
      data.messages.forEach(msg => {
        addMessage(msg.content, msg.role === 'user' ? 'user' : 'bot');
      });

      log(`✅ Loaded ${data.messages.length} messages`, "success");
      scrollToBottom();

    } else {
      addSystemBotMessage("❌ Failed to load messages.");
    }

  } catch (error) {
    console.error("Error loading chat:", error);
    addSystemBotMessage("❌ Error loading chat.");
  }
}

// ==================================================
// MEDIA GALLERY FUNCTIONS
// ==================================================

function showMediaGallery() {
  if (window.switchTabInternal) {
    window.switchTabInternal('btnMedia');
  } else {
    const mediaArea = document.getElementById('mediaTab');
    if (mediaArea) {
      mediaArea.style.display = 'flex';
      renderMediaGallery();
    }
  }
}

async function renderMediaGallery(filterType = 'all') {
  const container = document.getElementById('mediaGrid');
  if (!container) return;

  // Show skeleton loader
  container.innerHTML = `
    <div class="media-skeleton">
      ${Array(6).fill(0).map(() => `
        <div class="skeleton-media-item">
          <div class="skeleton skeleton-media-thumb"></div>
          <div class="skeleton skeleton-media-name"></div>
          <div class="skeleton skeleton-media-meta"></div>
        </div>
      `).join('')}
    </div>
  `;

  try {
    const auth = await new Promise(resolve => chrome.storage.local.get(['access_token'], resolve));
    const token = auth.access_token;

    const url = filterType === 'all'
      ? API.MEDIA
      : `${API.MEDIA}?file_type=${filterType}`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${token}`
      }
    });

    const data = await response.json();
    const mediaItems = data.media || [];

    if (mediaItems.length === 0) {
      container.innerHTML = `
        <div class="empty-media">
          <span class="empty-icon"><i data-lucide="image-off"></i></span>
          <p>No media files yet.</p>
        </div>
      `;
      if (window.lucide) window.lucide.createIcons();
      return;
    }

    // Render media grid
    container.innerHTML = mediaItems.map(item => `
      <div class="media-item" data-id="${item.id}" onclick="window.open('${item.file_url}', '_blank')">
        ${item.file_type === 'image'
        ? `<img src="${item.file_url}" alt="${item.original_filename}" loading="lazy" />`
        : `<div class="media-icon-large">${getFileIcon(item.file_type)}</div>`
      }
        <div class="item-overlay">
          <button class="item-action-btn download-btn" data-url="${item.file_url}" data-filename="${item.original_filename}" title="Download">
            <i data-lucide="download"></i>
          </button>
          <button class="item-action-btn delete-btn" data-id="${item.id}" title="Delete">
            <i data-lucide="trash-2"></i>
          </button>
        </div>
        <div class="item-info">
          <div class="item-name">${escapeHTML(item.original_filename)}</div>
        </div>
      </div>
    `).join('');

    // Add event listeners
    container.querySelectorAll('.download-btn').forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        downloadMedia(btn.dataset.url, btn.dataset.filename);
      };
    });

    container.querySelectorAll('.delete-btn').forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        deleteMedia(btn.dataset.id);
      };
    });

    if (window.lucide) window.lucide.createIcons();

  } catch (error) {
    console.error("Load media error:", error);
    container.innerHTML = `<div class="error-media">Failed to load media</div>`;
  }
}

function getFileIcon(fileType) {
  const icons = {
    'pdf': '📄',
    'docx': '📝',
    'image': '🖼️',
    'video': '🎥'
  };
  return icons[fileType] || '📎';
}

function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function downloadMedia(url, filename) {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
}

async function deleteMedia(id) {
  if (!confirm('Delete this media file?')) return;

  try {
    const auth = await new Promise(resolve => chrome.storage.local.get(['access_token'], resolve));
    const token = auth.access_token;

    const response = await fetch(`${API.MEDIA}/${id}`, {
      method: "DELETE",
      headers: {
        "Authorization": `Bearer ${token}`
      }
    });

    const data = await response.json();
    if (data.status === "success") {
      renderMediaGallery(); // Refresh
      log("✅ Media deleted", "success");
    }
  } catch (error) {
    console.error("Delete media error:", error);
    log("❌ Delete failed", "error");
  }
}


function showNotesHistory() {
  // In this app, "Notes" tab is already a list of notes.
  // But the user asked for a "back navigation arrow to go back to my current chats" 
  // and "same with notes".
  // This implies the Notes tab might have multiple views?
  // If the Notes tab currently shows "input + list", maybe history is just the list?
  // Let's assume the user wants the Back button to appear when they are in "History" mode.

  const notesArea = document.getElementById('notesTab');
  if (notesArea) {
    notesArea.style.display = 'flex';
    renderGeneralNotes();

    // Show back button
    const backBtn = document.getElementById('btnBackToNotes');
    if (backBtn) backBtn.style.display = 'flex';
  }
}

// Function to escape HTML
function escapeHTML(str) {
  const p = document.createElement('p');
  p.textContent = str;
  return p.innerHTML;
}

// Helper to switch tab from outside (exposed globally if needed)
window.switchTab = (id) => {
  if (typeof window.switchTabInternal === 'function') {
    window.switchTabInternal(id);
  } else {
    console.error("switchTab function not yet initialized");
  }
};

// ==================================================
// 🆕 WEBSITE THEME TOGGLE
// ==================================================

async function toggleWebsiteTheme() {
  log("🌗 Toggling website theme...", "info");

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) return;

    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        const id = 'google-sidebar-theme-override';
        let style = document.getElementById(id);

        if (style) {
          style.remove();
          console.log("🌞 Website theme restored");
        } else {
          style = document.createElement('style');
          style.id = id;
          // Premium Apple-style Dark Mode Filter
          style.textContent = `
            html {
              filter: invert(1) hue-rotate(180deg) !important;
            }
            /* Don't invert images, videos, and backgrounds */
            img, video, iframe, canvas, [style*="background-image"] {
              filter: invert(1) hue-rotate(180deg) !important;
            }
            /* Adjust contrast and brightness for a more natural look */
            html {
              background-color: #000 !important;
            }
          `;
          document.documentElement.appendChild(style);
          console.log("🌙 Website theme inverted (Dark Mode)");
        }
      }
    });

    log("✅ Website theme toggled", "success");
  } catch (error) {
    console.error("Error toggling website theme:", error);
    log("❌ Failed to toggle website theme", "error");
  }
}

function renderTabsCarousel(tabs) {
  // Group tabs by domain
  const grouped = groupTabsByDomain(tabs);

  // Create carousel container
  const carouselWrapper = document.createElement("div");
  carouselWrapper.className = "tabs-carousel-wrapper";

  // Add header
  const header = document.createElement("div");
  header.className = "tabs-carousel-header";
  header.innerHTML = `
    <h3>🗂️ All Open Tabs (${tabs.length})</h3>
    <button class="close-carousel">✕</button>
  `;
  carouselWrapper.appendChild(header);

  // Add groups
  const groupsContainer = document.createElement("div");
  groupsContainer.className = "tabs-groups-container";

  Object.entries(grouped).forEach(([domain, domainTabs]) => {
    const group = createTabGroup(domain, domainTabs);
    groupsContainer.appendChild(group);
  });

  carouselWrapper.appendChild(groupsContainer);

  // Add to messages
  DOM.messages.appendChild(carouselWrapper);
  scrollToBottom();


  // Setup close button
  header.querySelector('.close-carousel').onclick = () => {
    carouselWrapper.remove();
  };
}

function groupTabsByDomain(tabs) {
  const groups = {};

  tabs.forEach(tab => {
    try {
      const url = new URL(tab.url);
      const domain = url.hostname.replace(/^www\./, '');

      if (!groups[domain]) {
        groups[domain] = [];
      }

      groups[domain].push(tab);
    } catch (error) {
      // Invalid URL, skip
    }
  });

  return groups;
}

function createTabGroup(domain, tabs) {
  const group = document.createElement("div");
  group.className = "tab-group";

  // Group header
  const header = document.createElement("div");
  header.className = "tab-group-header";
  header.innerHTML = `
    <div class="tab-group-info">
      <span class="tab-group-favicon">${getFaviconForDomain(domain)}</span>
      <span class="tab-group-domain">${domain}</span>
      <span class="tab-group-count">${tabs.length} tab${tabs.length > 1 ? 's' : ''}</span>
    </div>
    <button class="tab-group-toggle">▼</button>
  `;

  // Tabs list
  const tabsList = document.createElement("div");
  tabsList.className = "tab-group-tabs";

  tabs.forEach(tab => {
    const tabCard = createTabCard(tab);
    tabsList.appendChild(tabCard);
  });

  group.appendChild(header);
  group.appendChild(tabsList);

  // Toggle collapse/expand
  const toggleBtn = header.querySelector('.tab-group-toggle');
  toggleBtn.onclick = (e) => {
    e.stopPropagation();
    group.classList.toggle('collapsed');
    toggleBtn.textContent = group.classList.contains('collapsed') ? '▶' : '▼';
  };

  // Click header to expand/collapse
  header.onclick = () => {
    toggleBtn.click();
  };

  return group;
}

function createTabCard(tab) {
  const card = document.createElement("div");
  card.className = "tab-card";

  const favicon = tab.favIconUrl || getFaviconForUrl(tab.url);
  const title = tab.title || 'Untitled';
  const url = truncateUrl(tab.url);

  card.innerHTML = `
    <img src="${favicon}" class="tab-favicon">
    <div class="tab-info">
      <div class="tab-title">${escapeHTML(title)}</div>
      <div class="tab-url">${escapeHTML(url)}</div>
    </div>
    <div class="tab-actions">
      <button class="tab-action-btn tab-switch" title="Switch to tab">👁️</button>
      <button class="tab-action-btn tab-close" title="Close tab">✕</button>
    </div>
  `;

  // Favicon error handler
  const favImg = card.querySelector('.tab-favicon');
  if (favImg) {
    favImg.onerror = () => {
      favImg.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><text y="18" font-size="18">🌐</text></svg>';
    };
  }

  // Switch to tab
  card.querySelector('.tab-switch').onclick = async (e) => {
    e.stopPropagation();
    try {
      await chrome.runtime.sendMessage({
        type: "SWITCH_TO_TAB",
        tabId: tab.id
      });
    } catch (error) {
      console.error("Error switching tab:", error);
    }
  };

  // Close tab
  card.querySelector('.tab-close').onclick = async (e) => {
    e.stopPropagation();
    try {
      await chrome.runtime.sendMessage({
        type: "CLOSE_TAB",
        tabId: tab.id
      });
      card.style.opacity = '0.5';
      card.style.transform = 'scale(0.95)';
      setTimeout(() => card.remove(), 200);
    } catch (error) {
      console.error("Error closing tab:", error);
    }
  };

  // Click card to switch
  card.onclick = () => {
    card.querySelector('.tab-switch').click();
  };

  return card;
}

function getFaviconForDomain(domain) {
  const emojis = {
    'youtube.com': '▶️',
    'google.com': '🔍',
    'github.com': '🐙',
    'twitter.com': '🐦',
    'x.com': '✖️',
    'facebook.com': '👥',
    'linkedin.com': '💼',
    'instagram.com': '📷',
    'reddit.com': '🤖',
    'amazon.com': '📦',
    'amazon.in': '📦',
    'flipkart.com': '🛒',
    'netflix.com': '🎬',
    'spotify.com': '🎵',
    'stackoverflow.com': '📚',
    'wikipedia.org': '📖',
    'gmail.com': '✉️',
    'outlook.com': '📧',
    'drive.google.com': '📁',
    'docs.google.com': '📄',
  };

  return emojis[domain] || '🌐';
}

function getFaviconForUrl(url) {
  try {
    const urlObj = new URL(url);
    return `https://www.google.com/s2/favicons?domain=${urlObj.hostname}&sz=32`;
  } catch {
    return 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22><text y=%2218%22 font-size=%2218%22>🌐</text></svg>';
  }
}

function truncateUrl(url) {
  try {
    const urlObj = new URL(url);
    let path = urlObj.pathname + urlObj.search;
    if (path.length > 50) {
      path = path.substring(0, 47) + '...';
    }
    return path === '/' ? urlObj.hostname : path;
  } catch {
    return url;
  }
}


// ==================================================
// EVENT HANDLERS
// ==================================================

function handleScroll() {
  const state = store.getState();

  if (state.isUserScrolling) {
    store.setState({ isUserScrolling: false });
    return;
  }

  if (isScrolledToBottom()) {
    store.setAutoScroll(true);
  } else {
    store.setAutoScroll(false);
    log("Auto-scroll paused - user scrolling up", "info");
  }
}

function handleAgentToggle() {
  const state = store.getState();
  const newActive = !state.agentMode;
  store.setAgentMode(newActive);

  log(`🤖 Agent Mode: ${newActive ? 'ACTIVE' : 'INACTIVE'}`, newActive ? "success" : "info");

  // Update UI Class
  if (newActive) {
    document.body.classList.add('agent-mode-active');
    if (DOM.btnAgent) DOM.btnAgent.classList.add('active');
    // Ensure other tabs are not "active" visually
    if (DOM.btnChats) DOM.btnChats.classList.remove('active');
    if (DOM.btnNotes) DOM.btnNotes.classList.remove('active');

    addSystemBotMessage("🚀 Agent Mode Activated! I'm now monitoring your actions to help automate tasks.");
  } else {
    document.body.classList.remove('agent-mode-active');
    if (DOM.btnAgent) DOM.btnAgent.classList.remove('active');
    // Default back to chats visuals when agent is off
    if (DOM.btnChats) DOM.btnChats.classList.add('active');

    addSystemBotMessage("⏹ Agent Mode Deactivated.");
  }

  // Broadcast to background
  chrome.runtime.sendMessage({
    type: "TOGGLE_AGENT_MODE",
    active: newActive
  });
}


function handleSendClick() {
  const state = store.getState();

  if (state.isStreaming && state.currentAbortController) {
    log("⏹ Stream aborted by user", "warning");
    state.currentAbortController.abort();
    return;
  }
  sendMessage();
}

function handleInputKeydown(e) {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
}

// ==================================================
// MESSAGE LISTENERS
// ==================================================

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  console.log("📨 Sidebar received message:", msg.type);

  if (msg.type === "PREFILL_INPUT") {
    handlePrefillInput(msg);
    sendResponse({ success: true });
    return true;
  }

  if (msg.type === "SEND_AND_EXECUTE") {
    handleSendAndExecute(msg);
    sendResponse({ success: true });
    return true;
  }

  if (msg.type === "EXPLAIN_SELECTION") {
    handleExplainSelection(msg);
    sendResponse({ success: true });
    return true;
  }

  if (msg.type === "CHAT_MESSAGE") {
    handleChatMessage(msg);
    sendResponse({ success: true });
    return true;
  }

  if (msg.type === "EXECUTE_ACTION") {
    handleExecuteAction(msg);
    sendResponse({ success: true });
    return true;
  }

  if (msg.type === "SYSTEM_STATUS") {
    handleSystemStatus(msg);
    sendResponse({ success: true });
    return true;
  }

  if (msg.type === 'RECORDING_DATA') {
    console.log("✅ RECORDING_DATA received in sidebar!");
    console.log(`📹 Video data length: ${msg.video?.length || 0}`);
    handleRecordingData(msg, store);
    sendResponse({ success: true });
    return true;
  }

  return true;
});

console.log("✅ Sidebar message listeners registered");

// ==================================================
// MESSAGE HANDLER FUNCTIONS
// ==================================================

function handlePrefillInput(msg) {
  console.log("✍️ Prefill input request:", msg.message);

  const fillInput = () => {
    const input = DOM.input;
    console.log("Input element found:", !!input);

    if (input) {
      input.value = msg.message;
      input.style.height = 'auto';
      input.style.height = Math.min(input.scrollHeight, 120) + 'px';

      console.log("✅ Input value set to:", input.value);

      input.focus();

      const detailsIndex = msg.message.indexOf('{details}');
      if (detailsIndex !== -1) {
        input.setSelectionRange(detailsIndex, detailsIndex + 9);
        console.log("✅ Selected {details} portion");
      }

      addSystemBotMessage("💡 Replace {details} with your information and press Enter");
    } else {
      console.error("❌ Input element not found, retrying...");
      setTimeout(fillInput, 500);
    }
  };

  setTimeout(fillInput, 100);
}

function handleSendAndExecute(msg) {
  console.log("🚀 Send and execute request:", msg.message);

  const executeMessage = () => {
    if (typeof sendMessage === 'function') {
      console.log("✅ Calling sendMessage with:", msg.message);
      sendMessage(msg.message);
    } else {
      console.error("❌ sendMessage not available, retrying...");
      setTimeout(executeMessage, 500);
    }
  };

  setTimeout(executeMessage, 100);
}

function handleExplainSelection(msg) {
  console.log("📝 Selected text received:", msg.text.substring(0, 100) + "...");

  setTimeout(() => {
    try {
      log("📝 Processing selected text from context menu", "info");

      addMessage(`Explain this:\n\n"${msg.text}"`, "user");

      const state = store.getState();
      if (state.agentMode) {
        streamAgentResponse(`Explain this clearly:\n\n"${msg.text}"`);
      } else {
        streamChatResponse(`Explain this clearly:\n\n"${msg.text}"`);
      }
    } catch (error) {
      console.error("❌ Error processing selection:", error);
    }
  }, 100);
}

function handleChatMessage(msg) {
  console.log("💬 Chat message received:", msg.text);

  setTimeout(() => {
    try {
      addMessage(msg.text, "user");

      const state = store.getState();
      if (state.agentMode) {
        streamAgentResponse(msg.text);
      } else {
        streamChatResponse(msg.text);
      }
    } catch (err) {
      console.error("❌ CHAT_MESSAGE handling failed:", err);
    }
  }, 100);
}

function handleExecuteAction(msg) {
  console.log("🎯 EXECUTE_ACTION received:", msg.action);

  const actionPrompts = {
    SUMMARIZE_VIDEO: "Summarize this video",
    SUMMARIZE_PAGE: "Summarize this page",
    ANALYZE_PAGE: "Analyze this page",
    EXTRACT_POINTS: "Extract key points from this page",
    IMPROVE_TEXT: "Improve this text",
    CHECK_GRAMMAR: "Check grammar of this text"
  };

  const prompt = actionPrompts[msg.action];

  if (prompt) {
    setTimeout(() => {
      if (typeof sendMessage === 'function') {
        sendMessage(prompt);
      } else {
        addMessage(prompt, "user");
        const state = store.getState();
        if (state.agentMode) streamAgentResponse(prompt);
        else streamChatResponse(prompt);
      }
    }, 100);
  }
}

// ==================================================
// UTILITY FUNCTIONS
// ==================================================

async function getCurrentTabUrl() {
  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true
    });
    return tab?.url || null;
  } catch (error) {
    console.error("Failed to get current URL:", error);
    return null;
  }
}

function hasContextKeywords(query) {
  const contextKeywords = [
    'this page', 'current page', 'this site', 'this website',
    'summarize', 'summary', 'summarise', 'tldr', 'tl;dr',
    'what\'s on', 'what is on', 'what\'s here', 'whats here',
    'what does this', 'tell me about this', 'tell me more',
    'page content', 'contents', 'content',
    'product', 'item', 'price', 'buy this',
    'article', 'post', 'read this',
    'on this page', 'in this page', 'this video',
    'what is this', 'explain this', 'viewing', 'current view',
    'about this', 'about it', 'tell me about'
  ];

  const lowerQuery = query.toLowerCase();
  return contextKeywords.some(keyword => lowerQuery.includes(keyword));
}


function extractUrls(text) {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  return text.match(urlRegex) || [];
}

async function fetchUrlPreview(url) {
  try {
    const res = await fetch(API.PREVIEW, {
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

  DOM.messages.appendChild(card);
  scrollToBottom();
}

// ==================================================
// MESSAGE UI FUNCTIONS
// ==================================================

function addMessage(text, type) {
  const wrapper = document.createElement("div");
  wrapper.className = type === "user" ? "user-msg" : "bot-msg";

  if (type === "user") wrapper.textContent = text;

  if (type === "bot") {
    const textDiv = document.createElement("div");
    textDiv.className = "bot-text";
    if (text) {
      renderMarkdownStream(textDiv, text);
    }
    wrapper.appendChild(textDiv);
  }

  DOM.messages.appendChild(wrapper);
  scrollToBottom();
  return wrapper;
}

function addSystemBotMessage(text) {
  const wrapper = document.createElement("div");
  wrapper.className = "bot-msg";
  const textDiv = document.createElement("div");
  textDiv.className = "bot-text";
  textDiv.textContent = text;
  wrapper.appendChild(textDiv);
  DOM.messages.appendChild(wrapper);
  scrollToBottom();
}

function addTypingLoader(parent) {
  const loader = document.createElement("div");
  loader.className = "typing";
  loader.innerHTML = "<span></span><span></span><span></span>";
  parent.appendChild(loader);
  scrollToBottom();
  return loader;
}

function removeTypingLoader(loader) {
  if (loader && loader.parentNode) {
    loader.remove();
  }
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

function addContentHeader(parent, text) {
  const header = document.createElement("div");
  header.className = "content-section-header";
  header.textContent = text;
  parent.appendChild(header);
  scrollToBottom();
}

function renderMarkdownStream(el, fullText) {
  const marked = window.marked || {};
  const parsed = (typeof marked.parse === 'function') ? marked.parse(fullText) : (typeof marked === 'function' ? marked(fullText) : fullText);
  el.innerHTML = parsed;
}

function addContextIndicator(parent, analysis) {
  const indicator = document.createElement("div");
  indicator.className = "context-indicator";
  indicator.innerHTML = `
    <div class="context-badge ${analysis.needs_context ? 'active' : 'inactive'}">
      ${analysis.needs_context ? '📄 Using Page Context' : 'ℹ️ General Response'}
    </div>
    <div class="context-reason">${analysis.reason}</div>
  `;
  parent.appendChild(indicator);
  scrollToBottom();
}

function addIntentIndicator(parent, intentData) {
  const indicator = document.createElement("div");
  indicator.className = "intent-indicator";

  const needsActions = intentData.needs_actions;
  const actionType = intentData.action_type || "content_analysis";

  const icons = {
    navigation: "🚀",
    content_analysis: "📄",
    mixed: "🔀"
  };

  const labels = {
    navigation: "Browser Actions Mode",
    content_analysis: "Content Analysis Mode",
    mixed: "Mixed Mode"
  };

  indicator.innerHTML = `
    <div class="intent-badge ${needsActions ? 'actions-enabled' : 'actions-disabled'}">
      ${icons[actionType]} ${labels[actionType]}
    </div>
    <div class="intent-reason">${intentData.reason}</div>
  `;

  parent.appendChild(indicator);
  scrollToBottom();
}

// ==================================================
// VIDEO TRANSCRIPTION UI
// ==================================================

function addVideoTranscriptionStatus(parent) {
  const statusContainer = document.createElement("div");
  statusContainer.className = "video-transcription-status";
  statusContainer.innerHTML = `
    <div class="video-status-header">
      <span class="video-status-icon">🎥</span>
      <span class="video-status-title">Video Transcription</span>
    </div>
    <div class="video-steps-list"></div>
  `;
  parent.appendChild(statusContainer);
  scrollToBottom();
  return statusContainer.querySelector(".video-steps-list");
}

function addVideoStep(stepsList, stepText, status = "processing") {
  const step = document.createElement("div");
  step.className = `video-step video-step-${status}`;

  const statusIcons = {
    processing: '<div class="video-step-spinner"></div>',
    success: '<div class="video-step-icon">✓</div>',
    error: '<div class="video-step-icon">✗</div>'
  };

  step.innerHTML = `
    ${statusIcons[status]}
    <span class="video-step-text">${stepText}</span>
  `;

  stepsList.appendChild(step);
  scrollToBottom();
  return step;
}

function updateVideoStep(step, status, newText = null) {
  step.className = `video-step video-step-${status}`;

  const statusIcons = {
    success: '<div class="video-step-icon">✓</div>',
    error: '<div class="video-step-icon">✗</div>'
  };

  step.querySelector('.video-step-spinner, .video-step-icon')?.remove();
  step.insertAdjacentHTML('afterbegin', statusIcons[status]);

  if (newText) {
    step.querySelector('.video-step-text').textContent = newText;
  }

  scrollToBottom();
}

// ==================================================
// AGENT UI FUNCTIONS
// ==================================================

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

// ==================================================
// CONTINUE IN PART 3 WITH CHAT/AGENT STREAMING...
// ==================================================
// ==================================================
// SIDEBAR.JS - PART 3: CHAT/AGENT STREAMING & ACTIONS
// This continues from Part 2
// ==================================================

// ==================================================
// MAIN SEND MESSAGE FUNCTION
// ==================================================

async function sendMessage(textOverride) {
  const text = typeof textOverride === "string" ? textOverride : DOM.input.value.trim();
  const imageUrl = attachedImageUrl; // Capture current attached image

  if (!text && !imageUrl) return;

  store.setAutoScroll(true);

  // If there's an image, we might want to show it in the user message
  let userMessageText = text;
  if (imageUrl) {
    // Show a small thumbnail or just a note in the user message
    // For now, let's keep it simple
    userMessageText = (text ? text + "\n\n" : "") + "[Image Attached]";
  }

  addMessage(userMessageText, "user");
  DOM.input.value = "";
  DOM.input.style.height = "auto";
  window.clearInputPreview(); // Clear preview after sending

  // Switch to Chat tab if not already there
  if (typeof switchTabInternal === 'function') {
    const messagesArea = document.getElementById('messages');
    if (messagesArea && !messagesArea.classList.contains('active')) {
      console.log("🔄 Auto-switching to Chat tab for message send");
      switchTabInternal('btnChats');
    }
  }

  // Check for form fill intent first
  if (detectFormFillIntent(text)) {
    const handled = await handleFormFillRequest(text);
    if (handled) {
      return;
    }
  }

  // Handle URL previews
  const urls = extractUrls(text);
  if (urls.length > 0) {
    urls.forEach(url => fetchUrlPreview(url));
  }

  // Combined prompt if image exists
  let finalPrompt = text;
  if (imageUrl) {
    // We send the image URL to the backend. The backend currently expects 
    // image_data (base64) for vision endpoints, or we might need a new 
    // endpoint that accepts a file_url.
    // For Circle Search, it was already sending base64.
    // Let's assume the backend 'generate' or 'agent' endpoints can handle an image_url 
    // in the context or we might need to fetch the image and send as base64.
    // However, the user said "first it would be uploaded to the r2... then I can type my prompt".
    // This implies the backend should receive the R2 URL.
    finalPrompt = (text ? text : "Analyze this image") + `\nAttached Image: ${imageUrl}`;
  }

  // Attach Tab Context if selected
  if (activeContextContent) {
    // We append it to the prompt as context, or send it in the 'page_context' field
    // The current backend logic prioritizes 'page_context' if sent.
    // Let's modify the 'pageContext' variable sent in fetch
    log(`📎 Attaching context from: ${activeContextContent.title}`, "info");
  }

  // Regular chat/agent/dom flow
  const state = store.getState();
  let responsePromise;
  if (state.domMode) {
    responsePromise = handleDomCustomization(finalPrompt);
  } else if (state.agentMode) {
    responsePromise = streamAgentManifest(finalPrompt);
  } else {
    // Update: streamChatResponse might need to know about the image
    responsePromise = streamChatResponse(finalPrompt);
  }
}

async function handleDomCustomization(requirements) {
  const bot = addMessage("", "bot");
  const textEl = bot.querySelector(".bot-text");
  const typing = addTypingLoader(textEl);

  try {
    log("🔍 Extracting page elements with selectors...", "info");
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || isRestrictedPage(tab.url)) {
      throw new Error("Cannot customize components on restricted system pages.");
    }
    const tabId = activeContextTabId || tab.id;

    // Call content script to get elements with selectors
    const results = await chrome.scripting.executeScript({
      target: { tabId: tabId },
      func: () => window.getUsefulElements()
    });

    const elements = results?.[0]?.result;
    if (!elements || elements.length === 0) {
      throw new Error("No elements found on the page.");
    }

    log(`✨ Sending ${elements.length} elements to AI for customization...`, "info");

    chrome.runtime.sendMessage({
      type: "CUSTOMIZE_DOM",
      elements: elements,
      requirements: requirements
    }, async (response) => {
      if (response && response.success) {
        // New format: response.modifications
        const modifications = response.modifications || response.elements || [];

        if (!modifications || modifications.length === 0) {
          removeTypingLoader(typing);
          textEl.textContent = "⚠️ AI didn't suggest any changes for this request.";
          return;
        }

        log(`✅ AI returned ${modifications.length} modifications. Applying...`, "success");

        // Apply customized elements via content script
        const applyResults = await chrome.scripting.executeScript({
          target: { tabId: tabId },
          func: (mods) => window.applyCustomizedElements(mods),
          args: [modifications]
        });

        const result = applyResults?.[0]?.result;

        removeTypingLoader(typing);

        if (result && result.success > 0) {
          textEl.textContent = `🎨 Successfully customized ${result.success} element(s) on the page!`;
          if (result.failed > 0) {
            textEl.textContent += ` (${result.failed} changes couldn't be applied)`;
          }
        } else {
          textEl.textContent = "🎨 Page customization applied!";
        }
      } else {
        const errorMsg = response?.error || "Failed to customize DOM";
        log(`❌ DOM Customization failed: ${errorMsg}`, "error");
        removeTypingLoader(typing);
        textEl.textContent = `⚠️ Sorry, I couldn't customize the page: ${errorMsg}`;
      }
    });

  } catch (error) {
    log(`❌ DOM Customization failed: ${error.message}`, "error");
    removeTypingLoader(typing);
    textEl.textContent = `⚠️ Sorry, I couldn't customize the page: ${error.message}`;
  }
}

// ==================================================
// CHAT MODE STREAMING
// ==================================================

async function streamChatResponse(text) {
  let fullText = "";
  const bot = addMessage("", "bot");
  const textEl = bot.querySelector(".bot-text");
  const typing = addTypingLoader(textEl);

  let richContentLoaders = {};
  let pageContext = null;
  let videoStepsList = null;
  let currentVideoStep = null;

  const abortController = new AbortController();
  store.setAbortController(abortController);
  store.setStreaming(true);
  setSendButtonToStop();

  const currentUrl = (activeContextContent && activeContextContent.url) ? activeContextContent.url : await getCurrentTabUrl();
  log(`📍 Current URL: ${currentUrl}`, "info");

  /*
  const needsContext = hasContextKeywords(text);

  if (needsContext) {
    log("📄 Query suggests page context needed - fetching...", "info");

    try {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true
      });

      if (tab && isRestrictedPage(tab.url)) {
        log("ℹ️ Restricted page - skipping DOM extraction", "info");
        pageContext = null;
      } else if (tab) {
        const results = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: extractDOMTree
        });

        pageContext = results?.[0]?.result ?? null;
      }
      // console.log("pageContext", pageContext);
      if (pageContext && pageContext.error) {

        log("❌ Page context extraction failed: " + pageContext.error, "error");
        addSystemBotMessage("⚠️ I had trouble reading the page: " + pageContext.error);
        pageContext = null;
      } else if (pageContext) {
        log("✅ Page context captured", "success");
        // addSystemBotMessage("📄 I've analyzed the page content and sent it to the AI.");
      } else {
        log("⚠️ No page context returned", "warning");
      }

    } catch (error) {
      log("❌ Page context extraction failed: " + error.message, "error");
    }

  } else {
    log("ℹ️ General query - no page context needed", "info");
  }
  */

  // Override if manual context is selected
  if (activeContextContent) {
    log("📎 Using manual tab context", "info");
    // We purposely skip re-fetching context if user manually selected one
    pageContext = activeContextContent;
  }

  // 🆕 Ensure Conversation ID Exists
  const state = store.getState();
  let conversationId = state.conversationId;

  if (!conversationId) {
    try {
      const auth = await new Promise(resolve => chrome.storage.local.get(['access_token'], resolve));
      const token = auth.access_token;

      const convResp = await fetch(API.CONVERSATIONS, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        }
      });
      const convData = await convResp.json();
      if (convData.status === "success") {
        conversationId = convData.conversation_id;
        store.setConversationId(conversationId);
        log(`🆔 New Conversation Created: ${conversationId}`, "info");
      }
    } catch (e) {
      console.error("Failed to create conversation:", e);
    }
  }

  // Save to history now that we have an ID
  saveChatToHistory(text);

  try {
    const auth = await new Promise(resolve => chrome.storage.local.get(['access_token'], resolve));
    const token = auth.access_token;

    const response = await fetch(API.CHAT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({
        prompt: text,
        imageUrl: attachedImageUrl,
        currentUrl: currentUrl,
        conversationId: conversationId
      }),
      signal: abortController.signal
    });

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let textStarted = false;

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (!store.getState().isStreaming) break;

      buffer += decoder.decode(value, { stream: true });
      const frames = buffer.split("\n\n");
      buffer = frames.pop();

      for (const frame of frames) {
        if (!frame.trim()) continue;

        try {
          const event = JSON.parse(frame);

          if (event.type === "context_analysis") {
            addContextIndicator(bot, event.data);
            log(`🔍 Context decision: ${event.data.needs_context ? 'USING' : 'NOT USING'}`,
              event.data.needs_context ? "success" : "info");
          }

          if (event.type === "video_analysis") {
            log(`🎥 Video analysis: ${event.data.needs_video_context ? 'WILL TRANSCRIBE' : 'NOT NEEDED'}`,
              event.data.needs_video_context ? "success" : "info");

            if (event.data.needs_video_context) {
              typing.remove();
              videoStepsList = addVideoTranscriptionStatus(bot);
            }
          }

          if (event.type === "status") {
            const statusText = event.data;
            log(statusText, "info");

            if (videoStepsList) {
              if (statusText.includes("Downloading and transcribing video")) {
                currentVideoStep = addVideoStep(videoStepsList, "Downloading video audio...", "processing");
              } else if (statusText.includes("transcribed successfully")) {
                if (currentVideoStep) {
                  updateVideoStep(currentVideoStep, "success", "Audio downloaded successfully");
                }
                currentVideoStep = addVideoStep(videoStepsList, "Transcribing with OpenAI Whisper...", "processing");

                setTimeout(() => {
                  if (currentVideoStep) {
                    updateVideoStep(currentVideoStep, "success", "Video transcribed successfully");
                  }
                }, 500);
              } else if (statusText.includes("Could not transcribe") || statusText.includes("failed")) {
                if (currentVideoStep) {
                  updateVideoStep(currentVideoStep, "error", statusText);
                } else {
                  addVideoStep(videoStepsList, statusText, "error");
                }
              }
            }
          }

          if (event.type === "text") {
            typing.remove();

            fullText += event.data;
            renderMarkdownStream(textEl, fullText);

            textStarted = true;
            scrollToBottom();

            // if (textStarted && Object.keys(richContentLoaders).length === 0 && !videoStepsList) {
            //   richContentLoaders.products = addLoadingSection(bot, "products");
            //   richContentLoaders.videos = addLoadingSection(bot, "videos");
            //   richContentLoaders.images = addLoadingSection(bot, "images");
            // }
          }

          if (event.type === "rich_blocks") {
            log("🎨 Rich content received", "success");

            Object.values(richContentLoaders).forEach(loader => loader.remove());
            richContentLoaders = {};

            if (event.data.products?.length) {
              addContentHeader(bot, "🛍️ Product Recommendations");
              renderProducts(bot, event.data.products);
            }

            if (event.data.youtube_videos?.length) {
              addContentHeader(bot, "🎥 Related Videos");
              renderYouTubeVideos(bot, event.data.youtube_videos);
            }

            if (event.data.images?.length) {
              addContentHeader(bot, "🖼️ Visual Gallery");
              renderImages(bot, event.data.images);
            }

            scrollToBottom();
          }

          if (event.type === "error") {
            typing.remove();
            Object.values(richContentLoaders).forEach(loader => loader.remove());
            textEl.textContent = "⚠️ " + event.data;
            log("❌ Error: " + event.data, "error");
            scrollToBottom();
          }

          if (event.type === "done") {
            typing.remove();
            Object.values(richContentLoaders).forEach(loader => loader.remove());
            log("✅ Stream completed", "success");
            scrollToBottom();
          }
        } catch (parseError) {
          log("⚠️ Parse error: " + parseError.message, "error");
        }
      }
    }
  } catch (error) {
    typing.remove();
    Object.values(richContentLoaders).forEach(loader => loader.remove());
    textEl.textContent = "⚠️ Connection error";
    log("❌ Fetch error: " + error.message, "error");
    scrollToBottom();
  } finally {
    store.setStreaming(false);
    setSendButtonToSend();
  }
}

// ==================================================
// AGENT MODE STREAMING
// ==================================================

// ==================================================
// AGENT MANIFEST STREAMING (NEW)
// ==================================================

async function streamAgentManifest(text) {
  const bot = addMessage("", "bot");
  const textEl = bot.querySelector(".bot-text");
  const typing = addTypingLoader(textEl);

  store.setStreaming(true);
  setSendButtonToStop();

  log("🤖 Agent Loop Request Started", "info");

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || isRestrictedPage(tab.url)) {
      throw new Error("Cannot act on restricted system pages.");
    }
    const tabId = activeContextTabId || tab.id;

    // Add status container
    const statusContainer = document.createElement("div");
    statusContainer.className = "agent-planning-status";
    statusContainer.innerHTML = `<div class="agent-planning-header">🧠 Acting on Page...</div>`;
    const statusList = document.createElement("div");
    statusList.className = "agent-planning-steps";
    statusContainer.appendChild(statusList);
    bot.appendChild(statusContainer);

    // We listen to SYSTEM_STATUS messages to update the UI
    // But we also need to handle the final result

    const response = await chrome.runtime.sendMessage({
      type: "START_AGENT_LOOP",
      tabId: tabId,
      goal: text
    });

    typing.remove();

    if (response && response.success) {
      log("✅ Agent Finished", "success");
      textEl.textContent = "✅ Task Completed: " + (response.summary || "Success");
    } else {
      const err = response?.error || "Unknown error";
      log("❌ Agent Failed: " + err, "error");
      textEl.textContent = "❌ Task Failed: " + err;
    }

  } catch (error) {
    typing.remove();
    log("❌ Error starting agent: " + error.message, "error");
    textEl.textContent = "Error: " + error.message;
  } finally {
    store.setStreaming(false);
    setSendButtonToSend();
  }
}

// ==================================================
// AGENT MODE STREAMING (LEGACY - KEPT FOR REFERENCE)
// ==================================================

async function streamAgentResponse(text) {
  let fullText = "";
  const bot = addMessage("", "bot");
  const textEl = bot.querySelector(".bot-text");
  const typing = addTypingLoader(textEl);

  let agentList = null;
  let richContentLoaders = {};
  let pageContext = null;
  let videoStepsList = null;
  let currentVideoStep = null;
  let intentShown = false;

  log("🤖 Agent request started");

  const currentUrl = (activeContextContent && activeContextContent.url) ? activeContextContent.url : await getCurrentTabUrl();
  log(`📍 Current URL: ${currentUrl}`, "info");

  const needsContext = hasContextKeywords(text);

  if (needsContext) {
    log("📄 Agent query needs page context - fetching...", "info");

    try {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true
      });

      if (tab && isRestrictedPage(tab.url)) {
        log("ℹ️ Restricted page - skipping DOM extraction for agent", "info");
        pageContext = null;
      } else if (tab) {
        const results = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: extractDOMTree
        });

        pageContext = results?.[0]?.result ?? null;
      }

      if (pageContext) {
        log("✅ Page context captured for agent", "success");
      }
    } catch (error) {
      log("❌ Page context extraction failed: " + error.message, "error");
    }
  }

  // 🆕 Ensure Conversation ID Exists
  const state = store.getState();
  let conversationId = state.conversationId;

  if (!conversationId) {
    try {
      const auth = await new Promise(resolve => chrome.storage.local.get(['access_token'], resolve));
      const token = auth.access_token;

      const convResp = await fetch(API.CONVERSATIONS, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        }
      });
      const convData = await convResp.json();
      if (convData.status === "success") {
        conversationId = convData.conversation_id;
        store.setConversationId(conversationId);
        log(`🆔 New Conversation Created: ${conversationId}`, "info");
      }
    } catch (e) {
      console.error("Failed to create conversation:", e);
    }
  }

  // Save to history now that we have an ID
  saveChatToHistory(text);

  try {
    const response = await fetch(API.AGENT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: text,
        context: pageContext,
        current_url: currentUrl,
        conversationId: conversationId
      })
    });

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let textStarted = false;

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

          if (event.type === "intent_analysis") {
            addIntentIndicator(bot, event.data);
            intentShown = true;

            const needsActions = event.data.needs_actions;
            log(`🎯 Intent: ${needsActions ? 'WILL EXECUTE ACTIONS' : 'CONTENT ONLY'}`,
              needsActions ? "success" : "info");

            if (needsActions) {
              agentList = addAgentStatus(bot);
            }
          }

          if (event.type === "video_analysis") {
            log(`🎥 Video analysis: ${event.data.needs_video_context ? 'WILL TRANSCRIBE' : 'NOT NEEDED'}`,
              event.data.needs_video_context ? "success" : "info");

            if (event.data.needs_video_context) {
              typing.remove();
              videoStepsList = addVideoTranscriptionStatus(bot);
            }
          }

          if (event.type === "status") {
            const statusText = event.data;
            log(statusText, "info");

            if (videoStepsList) {
              if (statusText.includes("Downloading and transcribing video")) {
                currentVideoStep = addVideoStep(videoStepsList, "Downloading video audio...", "processing");
              } else if (statusText.includes("transcribed successfully")) {
                if (currentVideoStep) {
                  updateVideoStep(currentVideoStep, "success", "Audio downloaded successfully");
                }
                currentVideoStep = addVideoStep(videoStepsList, "Transcribing with OpenAI Whisper...", "processing");

                setTimeout(() => {
                  if (currentVideoStep) {
                    updateVideoStep(currentVideoStep, "success", "Video transcribed successfully");
                  }
                }, 500);
              } else if (statusText.includes("Could not transcribe") || statusText.includes("failed")) {
                if (currentVideoStep) {
                  updateVideoStep(currentVideoStep, "error", statusText);
                } else {
                  addVideoStep(videoStepsList, statusText, "error");
                }
              }
            }
          }

          if (event.type === "actions") {
            const actions = event.data;

            if (agentList) {
              log("🎯 Actions received from agent", "success");

              const autoActions = actions.filter(a => a.auto);

              if (autoActions.length > 0) {
                log(`⚡ Auto-executing ${autoActions.length} action(s)`, "success");

                autoActions.forEach(action => {
                  executeAction(action, agentList);
                });
              }
            } else {
              log("ℹ️ Actions received but not needed for this query", "info");
            }

            renderAgentActions(bot, actions);
            scrollToBottom();
          }

          if (event.type === "text") {
            typing.remove();

            fullText += event.data;
            renderMarkdownStream(textEl, fullText);

            textStarted = true;
            scrollToBottom();

            if (textStarted && Object.keys(richContentLoaders).length === 0 && !videoStepsList) {
              richContentLoaders.products = addLoadingSection(bot, "products");
              richContentLoaders.videos = addLoadingSection(bot, "videos");
              richContentLoaders.images = addLoadingSection(bot, "images");
            }
          }

          if (event.type === "rich_blocks") {
            log("🎨 Rich content received", "success");

            Object.values(richContentLoaders).forEach(loader => loader.remove());
            richContentLoaders = {};

            if (event.data.products?.length) {
              addContentHeader(bot, "🛍️ Product Recommendations");
              renderProducts(bot, event.data.products);
            }

            if (event.data.youtube_videos?.length) {
              addContentHeader(bot, "🎥 Related Videos");
              renderYouTubeVideos(bot, event.data.youtube_videos);
            }

            if (event.data.images?.length) {
              addContentHeader(bot, "🖼️ Visual Gallery");
              renderImages(bot, event.data.images);
            }

            scrollToBottom();
          }

          if (event.type === "error") {
            typing.remove();
            Object.values(richContentLoaders).forEach(loader => loader.remove());
            textEl.textContent = "⚠️ " + event.data;
            log("❌ Error: " + event.data, "error");
            scrollToBottom();
          }

          if (event.type === "done") {
            typing.remove();
            Object.values(richContentLoaders).forEach(loader => loader.remove());
            log("✅ Stream completed", "success");
            scrollToBottom();
          }
        } catch (parseError) {
          log("⚠️ Parse error: " + parseError.message, "error");
        }
      }
    }
  } catch (error) {
    typing.remove();
    Object.values(richContentLoaders).forEach(loader => loader.remove());
    textEl.textContent = "⚠️ Connection error";
    log("❌ Fetch error: " + error.message, "error");
    scrollToBottom();
  }
}

// ==================================================
// CONTINUE IN PART 4 WITH ACTION EXECUTION & RENDERERS...
// ==================================================

// ==================================================
// SIDEBAR.JS - PART 4: ACTIONS & CONTENT RENDERERS
// This continues from Part 3
// ==================================================

// ==================================================
// ACTION EXECUTION
// ==================================================

function getActionDescription(action) {
  const descriptions = {
    "open_url": `🌐 Opening ${action.url}`,
    "open_web_search": `🔍 Searching Google for "${action.query}"`,
    "open_youtube_search": `▶️ Searching YouTube for "${action.query}"`,
    "open_youtube_playlist": `📺 Opening YouTube playlist for "${action.query}"`,
    "search_suggestion": `🔗 Opening ${action.target || "web"} search for "${action.query}"`,
    "dom_actions": `🎯 ${action.label}`
  };

  return descriptions[action.type] || `⚡ Executing ${action.label || action.type}`;
}

async function executeAction(action, agentList = null) {
  const description = getActionDescription(action);
  log(`⚡ Executing: ${description}`, "success");

  if (agentList) {
    addAgentAction(agentList, description);
  }

  if (action.type === "dom_actions") {
    await executeDOMActions(action.actions, action.label);
    return;
  }

  switch (action.type) {
    case "open_url":
      if (action.url) {
        openTab(action.url);
      }
      break;

    case "open_web_search":
      if (action.query) {
        openTab("https://www.google.com/search?q=" + encodeURIComponent(action.query));
      }
      break;

    case "open_youtube_search":
      if (action.query) {
        openTab("https://www.youtube.com/results?search_query=" + encodeURIComponent(action.query));
      }
      break;

    case "open_youtube_playlist":
      if (action.query) {
        openTab("https://www.youtube.com/results?search_query=" + encodeURIComponent(action.query) + "&sp=EgIQAw%253D%253D");
      }
      break;

    case "search_suggestion":
      if (action.query) {
        const urls = {
          youtube: `https://www.youtube.com/results?search_query=${encodeURIComponent(action.query)}`,
          amazon: `https://www.amazon.in/s?k=${encodeURIComponent(action.query)}`,
          flipkart: `https://www.flipkart.com/search?q=${encodeURIComponent(action.query)}`,
          spotify: `https://open.spotify.com/search/${encodeURIComponent(action.query)}`,
          netflix: `https://www.netflix.com/search?q=${encodeURIComponent(action.query)}`,
          wikipedia: `https://en.wikipedia.org/wiki/${encodeURIComponent(action.query.replace(/\s+/g, "_"))}`,
          images: `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(action.query)}`,
          indeed: `https://www.indeed.com/jobs?q=${encodeURIComponent(action.query)}`,
          linkedin: `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(action.query)}`,
          web: `https://www.google.com/search?q=${encodeURIComponent(action.query)}`
        };

        openTab(urls[action.target] || urls.web);
      }
      break;

    default:
      log(`⚠️ Unknown action type: ${action.type}`, "warning");
  }
}

async function executeDOMActions(actions, label) {
  log(`🎯 Executing DOM actions: ${label}`, "info");

  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true
    });

    const response = await chrome.tabs.sendMessage(tab.id, {
      action: "EXECUTE_DOM_ACTIONS",
      actions: actions
    });

    if (response.success) {
      log(`✅ DOM actions completed: ${response.result.results.length} actions`, "success");
      return response.result;
    } else {
      log(`❌ DOM actions failed: ${response.error}`, "error");
      return null;
    }
  } catch (error) {
    log(`❌ DOM action error: ${error.message}`, "error");
    return null;
  }
}

function renderAgentActions(wrapper, actions) {
  if (!actions?.length) return;

  const box = document.createElement("div");
  box.className = "agent-actions";

  actions.forEach(action => {
    const btn = document.createElement("button");
    btn.className = "agent-action-btn";

    if (action.auto) {
      btn.textContent = `✓ ${action.label}`;
      btn.style.opacity = "0.75";
      btn.style.fontStyle = "italic";
      btn.style.background = "linear-gradient(135deg, #667eea 0%, #764ba2 100%)";
      btn.style.color = "white";
      btn.style.cursor = "default";
      btn.onclick = null;
    } else {
      btn.textContent = action.label;
      btn.onclick = () => executeAction(action);
    }

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

    el.src = img.url || img.src;
    el.alt = img.caption || img.alt || "Image";
    el.loading = "lazy";

    el.onerror = () => {
      wrapper.remove();

      if (container.children.length === 0) {
        const header = container.previousElementSibling;
        if (header && header.classList.contains('content-section-header')) {
          header.remove();
        }
        container.remove();
      }
    };

    const caption = document.createElement("div");
    caption.className = "image-caption";
    caption.textContent = img.caption || img.alt || "Image";

    wrapper.appendChild(el);
    wrapper.appendChild(caption);
    container.appendChild(wrapper);
  });

  parent.appendChild(container);
  scrollToBottom();
}

// ==================================================
// 🆕 INPUT TABS CAROUSEL & CONTEXT
// ==================================================

let activeContextTabId = null;
let activeContextContent = null;
let isManualContext = false;
let browserFocusedTabId = null; // 🆕 Track which tab is currently focused in the browser

async function initializeDefaultContext() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
      browserFocusedTabId = tab.id; // Initial focus
    }
    if (tab && tab.url && tab.url.startsWith('http') && !isRestrictedPage(tab.url)) {
      console.log("🎯 Initializing default context:", tab.title);
      updateDefaultContext(tab);
    }
  } catch (err) {
    console.error("Failed to initialize default context:", err);
  }
}

async function updateDefaultContext(tab) {
  if (isManualContext) return;

  activeContextTabId = tab.id;
  if (isRestrictedPage(tab.url)) return;
  console.log(`📍 Auto-tracking active tab: "${tab.title}"`);

  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: extractMainContent
    });

    if (results && results[0] && results[0].result) {
      activeContextContent = results[0].result;
      console.log("✅ Default context extracted:", activeContextContent.title);

      // Update UI if carousel is open
      refreshTabCarousel();
    }
  } catch (err) {
    console.error("Default context extraction failed:", err);
  }
}

/**
 * 🆕 Helper to refresh the carousel UI
 */
async function refreshTabCarousel() {
  const carousel = document.getElementById('tabsCarousel');
  if (carousel && !carousel.classList.contains('hidden')) {
    const tabs = await new Promise(resolve => {
      chrome.runtime.sendMessage({ type: "GET_ALL_TABS", currentWindow: true }, (response) => {
        resolve(response?.tabs || []);
      });
    });
    renderInputTabCarousel(tabs);
  }
}

async function toggleInputTabsCarousel() {
  const customCarousel = document.getElementById('tabsCarousel');
  if (!customCarousel) return;

  const isHidden = customCarousel.classList.contains('hidden');

  if (isHidden) {
    // Show
    customCarousel.classList.remove('hidden');
    refreshTabCarousel();
  } else {
    // Hide
    customCarousel.classList.add('hidden');
    // Clear context if hidden? Maybe not, keep it until explicitly cleared or sent.
    // For now, let's keep context but hide UI.
  }
}

function renderInputTabCarousel(tabs) {
  const container = document.getElementById('tabsCarousel');
  if (!container) return;

  container.innerHTML = '';

  // 🆕 Group tabs by domain + FILTERING
  const groups = {};
  tabs.forEach(tab => {
    try {
      if (!tab.url || isRestrictedPage(tab.url)) return;
      if (tab.title === "New Tab" || tab.url === "chrome://newtab/") return; // Filter out blank tabs

      let domain = "Other";
      if (tab.url) {
        const url = new URL(tab.url);
        domain = url.hostname.replace('www.', '');
      }
      if (!groups[domain]) groups[domain] = [];
      groups[domain].push(tab);
    } catch (e) {
      // Skip if URL is completely invalid
    }
  });

  // Sort domains by number of tabs
  const sortedDomains = Object.keys(groups).sort((a, b) => groups[b].length - groups[a].length);

  sortedDomains.forEach(domain => {
    const domainTabs = groups[domain];
    const domainGroup = document.createElement('div');

    // 🆕 Highlight logic for group header
    const hasManualSelection = domainTabs.some(t => t.id === activeContextTabId);
    const hasBrowserFocus = domainTabs.some(t => t.id === browserFocusedTabId);

    domainGroup.className = `tab-carousel-group ${hasManualSelection ? 'selected' : ''} ${hasBrowserFocus ? 'active' : ''}`;

    // Header for the group
    const header = document.createElement('div');
    header.className = 'tab-carousel-group-header';

    // 🆕 Use first tab's favicon with emoji fallback
    const firstTab = domainTabs[0];
    const favicon = firstTab.favIconUrl || '';
    const emojiIcon = typeof getDomainIcon === 'function' ? getDomainIcon(domain) : '🌐';
    const fallbackIcon = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Ctext y='20' font-size='20'%3E${emojiIcon}%3C/text%3E%3C/svg%3E`;

    header.innerHTML = `
      <span class="group-icon">
        <img src="${favicon}" onerror="this.onerror=null;this.src='${fallbackIcon}';" class="group-favicon">
      </span>
      <span class="group-domain" title="${domain}">${domain}</span>
      <span class="group-count">${domainTabs.length}</span>
    `;
    domainGroup.appendChild(header);

    // 🆕 Click handler: Single tab -> select directly, Multiple tabs -> show drawer
    if (domainTabs.length === 1) {
      domainGroup.onclick = () => handleInputTabSelection(domainTabs[0], domainGroup);
    } else {
      domainGroup.onclick = () => showTabsDrawer(domain, domainTabs, emojiIcon);
    }

    container.appendChild(domainGroup);
  });

  if (window.lucide) window.lucide.createIcons();
}

/**
 * 🆕 Show the tab selection drawer for a domain group
 */
function showTabsDrawer(domain, tabs, icon) {
  const drawer = document.getElementById('tabsDrawer');
  const list = document.getElementById('tabsDrawerList');
  const groupName = document.getElementById('drawerGroupName');
  const groupIcon = document.getElementById('drawerGroupIcon');

  if (!drawer || !list) return;

  groupName.textContent = domain;
  groupIcon.textContent = icon;
  list.innerHTML = '';

  tabs.forEach(tab => {
    const isSelected = activeContextTabId === tab.id;
    const isActive = browserFocusedTabId === tab.id;

    const card = document.createElement('div');
    card.className = `drawer-tab-card ${isSelected ? 'selected' : ''} ${isActive ? 'active' : ''}`;

    const favicon = tab.favIconUrl || '';
    const fallbackIcon = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Ctext y='20' font-size='20'%3E🌐%3C/text%3E%3C/svg%3E";

    card.innerHTML = `
      <img src="${favicon || fallbackIcon}" class="drawer-tab-favicon" onerror="this.onerror=null;this.src='${fallbackIcon}';">
      <div class="drawer-tab-info">
        <div class="drawer-tab-title" title="${escapeHTML(tab.title)}">${escapeHTML(tab.title)}</div>
        <div class="drawer-tab-url">${new URL(tab.url).hostname}</div>
      </div>
      <div class="drawer-indicators">
        ${isSelected ? '<div class="drawer-selection-indicator" title="Manual Context"><i data-lucide="check-circle-2"></i></div>' : ''}
        ${isActive ? '<div class="drawer-active-indicator" title="Currently Focused"><i data-lucide="eye"></i></div>' : ''}
      </div>
    `;

    card.onclick = () => {
      handleInputTabSelection(tab, card);
      // Close drawer on selection for better UX?
      // User said "i cant select them if there is only one tab" - that's handled in render.
      // For multiple, let's keep it open but update UI.
      showTabsDrawer(domain, tabs, icon);
    };

    list.appendChild(card);
  });

  drawer.classList.remove('hidden');
  if (window.lucide) window.lucide.createIcons();
}

/**
 * 🆕 Hide the tab selection drawer
 */
function hideTabsDrawer() {
  const drawer = document.getElementById('tabsDrawer');
  if (drawer) drawer.classList.add('hidden');
}

// Drawer Event Listeners
document.addEventListener('click', (e) => {
  const drawer = document.getElementById('tabsDrawer');
  const backdrop = document.getElementById('tabsDrawerBackdrop');
  const closeBtn = document.getElementById('closeTabsDrawer');

  if (drawer && !drawer.classList.contains('hidden')) {
    if (e.target === backdrop || e.target === closeBtn || closeBtn?.contains(e.target)) {
      hideTabsDrawer();
    }
  }
});

async function handleInputTabSelection(tab, cardElement) {
  // Toggle selection
  const isSelected = activeContextTabId === tab.id;

  // 1. Clear ALL existing selection highlights (groups and cards)
  document.querySelectorAll('.tab-carousel-group, .tab-card, .drawer-tab-card').forEach(el => {
    el.classList.remove('selected');
  });

  if (isSelected && isManualContext) {
    // Deselect manual context and revert to auto-tracking
    isManualContext = false;
    activeContextTabId = null;
    activeContextContent = null;
    log("Manual context cleared, reverting to auto-track", "info");

    // Re-initialize with current active tab
    await initializeDefaultContext();
  } else {
    // Select new manual context
    isManualContext = true;
    activeContextTabId = tab.id;
    if (cardElement) cardElement.classList.add('selected');

    // Extract content
    log(`📄 Extracting context from "${tab.title}"...`, "info");

    try {
      if (isRestrictedPage(tab.url)) {
        log("ℹ️ Cannot extract context from restricted page", "info");
        activeContextContent = {
          url: tab.url,
          title: tab.title,
          content: "System page content restricted."
        };
      } else {
        const results = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: extractMainContent
        });

        if (results && results[0] && results[0].result) {
          activeContextContent = results[0].result;
          log("✅ Context extracted: " + activeContextContent.title, "success");
          saveContext(tab);
        } else {
          log("⚠️ Could not extract content", "warning");
        }
      }
    } catch (err) {
      console.error("Context extraction failed:", err);
      log("❌ Extraction failed: " + err.message, "error");
    }
  }

  // 2. Sync UI across carousel and drawer
  refreshTabCarousel();

  // If drawer is open, we might need to refresh it too to show indicators correctly
  // This is handled by the caller of handleInputTabSelection in showTabsDrawer
}
console.log("hellloooo")
function extractMainContent() {
  console.log("🚀 extractMainContent() called - Enhanced Amazon-friendly version");

  try {
    // Step 1: Create a working copy
    const bodyClone = document.body.cloneNode(true);
    console.log("✅ Body cloned successfully");

    // Step 2: Remove ONLY true junk (NOT buttons, inputs, or structural elements)
    const strictJunkSelectors = [
      // Scripts & styles only
      "script", "style", "noscript", "link[rel='stylesheet']",

      // Media that's not useful as text
      "svg:not(.a-icon)", // Keep icon SVGs
      "canvas",

      // Ads & popups
      ".ad", ".ads", ".advertisement", "[id*='ad-']", "[class*='ad-']",
      ".popup:not(.a-popover)", // Keep Amazon popovers
      ".modal:not(.a-modal)", // Keep Amazon modals

      // Cookie/consent banners
      "[id*='cookie']", "[class*='cookie']",
      "[id*='consent']", "[class*='consent']",

      // Navigation (but keep breadcrumbs!)
      "nav:not([aria-label*='breadcrumb'])",
      "footer",
      ".footer",

      // Social/share buttons
      ".social-share", ".share-buttons",

      // Comments (not reviews!)
      ".comments:not(.review)", ".comment-section:not(.review)"
    ];

    let removedCount = 0;
    strictJunkSelectors.forEach(selector => {
      try {
        const elements = bodyClone.querySelectorAll(selector);
        elements.forEach(el => {
          el.remove();
          removedCount++;
        });
      } catch (e) {
        console.warn(`Failed to remove selector: ${selector} `, e);
      }
    });

    console.log(`✅ Removed ${removedCount} junk elements(keeping content - rich elements)`);

    // Step 3: Find main content area (more lenient)
    const contentCandidates = bodyClone.querySelectorAll(
      "main, [role='main'], article, section, div[id*='content'], div[class*='content'], " +
      "div[id*='product'], div[class*='product'], " + // Amazon product containers
      "div[id*='detail'], div[class*='detail']" // Detail pages
    );

    console.log(`🔍 Found ${contentCandidates.length} candidate containers`);

    let bestNode = null;
    let bestScore = 0;

    contentCandidates.forEach((node, index) => {
      const text = node.innerText || node.textContent || "";
      const textLength = text.trim().length;

      if (textLength < 100) return; // Less strict minimum

      // Count ALL semantic elements (including buttons, inputs)
      const paragraphs = node.querySelectorAll("p").length;
      const headings = node.querySelectorAll("h1, h2, h3, h4, h5, h6").length;
      const lists = node.querySelectorAll("ul, ol").length;
      const spans = node.querySelectorAll("span").length; // Prices often in spans!
      const divs = node.querySelectorAll("div").length;
      const buttons = node.querySelectorAll("button").length; // Add to cart, etc.
      const inputs = node.querySelectorAll("input, select").length; // Quantity, options
      const links = node.querySelectorAll("a").length;

      // Calculate content score (MORE INCLUSIVE)
      const score =
        textLength +
        (paragraphs * 200) +
        (headings * 300) +
        (lists * 150) +
        (spans * 10) +      // Spans are important for prices/ratings
        (divs * 5) +        // Structural divs
        (buttons * 50) +    // Interactive elements matter
        (inputs * 100) +    // Form elements are valuable
        (links * 20);       // Links to related products

      // Bonus for main/article
      if (node.tagName === "MAIN") score += 1000;
      if (node.tagName === "ARTICLE") score += 800;
      if (node.getAttribute("role") === "main") score += 800;

      // Bonus for product-related IDs/classes
      const id = (node.getAttribute("id") || "").toLowerCase();
      const className = (node.getAttribute("class") || "").toLowerCase();
      if (id.includes("product") || className.includes("product")) score += 500;
      if (id.includes("detail") || className.includes("detail")) score += 500;

      if (score > bestScore) {
        bestScore = score;
        bestNode = node;
        console.log(`🎯 New best candidate #${index}: ${node.tagName} #${node.id || 'no-id'}, score: ${score} `);
      }
    });

    // Fallback: use body
    if (!bestNode) {
      console.log("⚠️ No strong candidate found, using entire body");
      bestNode = bodyClone;
    } else {
      console.log(`✅ Best content node selected with score: ${bestScore} `);
    }

    // Step 4: SMART EXTRACTION - Get ALL useful elements
    const contentElements = bestNode.querySelectorAll(
      "h1, h2, h3, h4, h5, h6, " +        // Headings
      "p, " +                              // Paragraphs
      "li, " +                             // List items
      "span, " +                           // Prices, ratings, labels
      "div.price, div[class*='price'], " + // Price containers
      "div.rating, div[class*='rating'], div[class*='star'], " + // Ratings
      "button, " +                         // Action buttons
      "input, select, option, " +          // Form elements
      "a, " +                              // Links
      "label, " +                          // Form labels
      "dl, dt, dd, " +                     // Description lists (specs!)
      "table, tr, td, th, " +              // Tables (specs, comparisons)
      "strong, b, em, i"                   // Emphasized text
    );

    console.log(`📝 Found ${contentElements.length} content elements to extract`);

    let extractedContent = "";
    let elementCount = 0;
    const seenTexts = new Set(); // Avoid duplicates

    contentElements.forEach(el => {
      let text = (el.innerText || el.textContent || "").trim();

      // Skip if empty or too short
      if (text.length < 2) return;

      // Skip duplicates
      if (seenTexts.has(text)) return;
      seenTexts.add(text);

      // Get element metadata
      const tag = el.tagName.toLowerCase();
      const className = el.getAttribute("class") || "";
      const id = el.getAttribute("id") || "";

      // Check if it's a price
      const isPriceElement =
        className.includes("price") ||
        id.includes("price") ||
        className.includes("cost") ||
        text.match(/^\$[\d,]+\.?\d*/) || // Starts with $
        text.match(/^₹[\d,]+\.?\d*/) || // Starts with ₹
        text.match(/^£[\d,]+\.?\d*/) || // Starts with £
        text.match(/^€[\d,]+\.?\d*/);   // Starts with €

      // Check if it's a rating
      const isRatingElement =
        className.includes("rating") ||
        className.includes("star") ||
        id.includes("rating") ||
        text.includes("out of 5") ||
        text.match(/\d\.\d\s*(stars?|★)/i);

      // Check if it's a button/action
      const isActionElement = tag === "button" || className.includes("button");

      // Check if it's a spec/attribute
      const isSpecElement =
        tag === "dt" || tag === "dd" ||
        className.includes("spec") ||
        className.includes("attribute") ||
        className.includes("feature");

      // DON'T skip common noise patterns - keep everything!
      // We want prices, buttons, etc.

      // Format based on element type
      if (tag.startsWith('h')) {
        // Headings
        const level = tag.charAt(1);
        const prefix = "#".repeat(parseInt(level));
        extractedContent += `\n${prefix} ${text} \n\n`;

      } else if (isPriceElement) {
        // Prices get special formatting
        extractedContent += `💰 PRICE: ${text} \n`;

      } else if (isRatingElement) {
        // Ratings get special formatting
        extractedContent += `⭐ RATING: ${text} \n`;

      } else if (isActionElement) {
        // Buttons/actions
        extractedContent += `🔘 ACTION: ${text} \n`;

      } else if (isSpecElement) {
        // Specifications
        extractedContent += `📋 ${text} \n`;

      } else if (tag === 'li') {
        // List items
        extractedContent += `• ${text} \n`;

      } else if (tag === 'a' && text.length > 5) {
        // Links (only if meaningful)
        extractedContent += `🔗 ${text} \n`;

      } else if (tag === 'td' || tag === 'th') {
        // Table cells
        extractedContent += `| ${text} `;

      } else if (tag === 'label') {
        // Form labels
        extractedContent += `🏷️ ${text}: `;

      } else if (tag === 'option') {
        // Dropdown options
        extractedContent += `  - ${text} \n`;

      } else {
        // Everything else
        extractedContent += `${text} \n`;
      }

      elementCount++;
    });

    console.log(`✅ Extracted content from ${elementCount} elements`);

    // Step 5: Light cleanup (preserve structure)
    extractedContent = extractedContent
      .replace(/\n{4,}/g, '\n\n\n')  // Max 3 newlines
      .trim();

    // Step 6: More generous character limit for e-commerce
    const MAX_CHARS = 20000; // Increased from 12000
    const originalLength = extractedContent.length;

    if (extractedContent.length > MAX_CHARS) {
      extractedContent = extractedContent.slice(0, MAX_CHARS) + "\n\n[Content truncated to fit limits...]";
      console.log(`✂️ Content truncated from ${originalLength} to ${MAX_CHARS} chars`);
    }

    // Step 7: Enhanced fallback
    if (extractedContent.length < 200) {
      console.log("⚠️ Extracted content too short, using aggressive fallback");

      // Get EVERYTHING from body
      const fallbackText = Array.from(bodyClone.querySelectorAll("*"))
        .map(el => (el.innerText || el.textContent || "").trim())
        .filter(text => text.length > 3)
        .filter((text, index, self) => self.indexOf(text) === index) // Unique only
        .join("\n")
        .slice(0, MAX_CHARS);

      if (fallbackText.length > extractedContent.length) {
        extractedContent = fallbackText;
        console.log(`✅ Fallback method extracted ${fallbackText.length} chars`);
      }
    }

    // Step 8: Build result
    const result = {
      title: document.title || "Untitled Page",
      url: window.location.href,
      content: extractedContent,
      stats: {
        totalChars: extractedContent.length,
        wasClipped: originalLength > MAX_CHARS,
        elementsProcessed: elementCount,
        uniqueTexts: seenTexts.size
      }
    };

    console.log("✅ Extraction complete:");
    console.log(`   - Title: ${result.title} `);
    console.log(`   - URL: ${result.url} `);
    console.log(`   - Content length: ${result.content.length} chars`);
    console.log(`   - Elements processed: ${elementCount} `);
    console.log(`   - Unique text blocks: ${seenTexts.size} `);
    console.log(`📄 Content preview: \n${result.content.substring(0, 500)}...`);

    return result;

  } catch (error) {
    console.error("❌ extractMainContent() failed:", error);
    console.error("Stack trace:", error.stack);

    // Emergency fallback - just grab everything
    return {
      title: document.title || "Error",
      url: window.location.href,
      content: document.body.innerText || document.body.textContent || `Error: ${error.message} `,
      error: true,
      errorMessage: error.message
    };
  }
}

// ==================================================
// PAGE CONTEXT EXTRACTION (runs in page context)
// ==================================================

function extractRawHTML() {
  return document.documentElement.outerHTML;
}

function extractDOMTree() {
  try {
    console.log("🚀 Starting comprehensive page extraction...");

    const IMPORTANT_ATTRS = [
      "name", "role", "type", "aria-label",
      "href", "src", "placeholder", "value", "action", "for",
      "checked", "selected", "disabled", "alt", "title"
    ];

    const SKIP_TAGS = [
      "SCRIPT", "STYLE", "NOSCRIPT", "LINK", "META", "SVG", "PATH",
      "SYMBOL", "DEFS", "CLIPPATH", "G", "RECT", "CIRCLE", "POLYGON", "USE",
      "IFRAME", "AD", "INS", "ASIDE", "PICTURE", "SOURCE",
      "CANVAS", "OBJECT", "EMBED"
    ];

    const NOISE_ID_CLASS_PATTERNS = [
      /footer/i, /advert/i, /banner/i, /social/i,
      /modal/i, /popup/i, /promo/i, /share/i, /comment/i, /breadcrumb/i,
      /cookie/i, /consent/i, /login/i, /signup/i, /auth/i, /debug/i, /tool/i,
      /related/i, /suggested/i, /recommend/i, /player-ads/i, /accessibility/i,
      /bottom/i, /skip-to/i, /search-form/i
    ];

    const CONTENT_PATTERNS = [
      /question/i, /answer/i, /option/i, /choice/i, /quiz/i, /assessment/i,
      /assignment/i, /radio/i, /checkbox/i, /input/i, /form/i, /mc-/i, /qt-/i,
      /correct/i, /incorrect/i, /product/i, /price/i, /rating/i, /review/i,
      /cart/i, /buy/i, /article/i, /post/i, /comment/i, /content/i, /main/i
    ];

    const NOISE_PATTERNS = [
      /^MathJax/i, /^_/, /butterbar/i, /invisible/i
    ];

    function isContentElement(node) {
      const id = (node.getAttribute?.("id") || "").toLowerCase();
      const className = (node.getAttribute?.("class") || "").toLowerCase();
      const combined = id + " " + className;
      return CONTENT_PATTERNS.some(pattern => pattern.test(combined));
    }

    function isNoiseElement(node) {
      if (isContentElement(node)) return false;
      const id = node.getAttribute?.("id") || "";
      const className = node.getAttribute?.("class") || "";
      const combined = (id + " " + className).toLowerCase();
      if (NOISE_PATTERNS.some(pattern => pattern.test(combined))) return true;
      if (NOISE_ID_CLASS_PATTERNS.some(pattern => pattern.test(combined))) return true;
      return false;
    }

    function getDirectText(node) {
      if (!node) return "";
      let text = "";
      for (const child of node.childNodes || []) {
        if (child.nodeType === 3) { // Node.TEXT_NODE
          text += child.textContent;
        }
      }
      return text.replace(/\s+/g, " ").trim();
    }

    // Dynamic word counting to stay under budget
    let totalWords = 0;
    const WORD_BUDGET = 5000;

    function serialize(node, depth = 0, maxDepth = 20) {
      if (!node || depth > maxDepth || totalWords >= WORD_BUDGET) return null;
      if (node.nodeType !== 1) return null;

      const tag = node.tagName;
      if (SKIP_TAGS.includes(tag)) return null;

      // Limit depth for non-core layout elements (HEADER, NAV, etc.)
      const isLayout = ["HEADER", "NAV", "FOOTER", "ASIDE"].includes(tag);
      if (isLayout && depth > 5) return null;

      if (isNoiseElement(node)) return null;

      const tagLower = tag.toLowerCase();
      const attrs = {};

      for (const attr of IMPORTANT_ATTRS) {
        if (node.hasAttribute?.(attr)) {
          const value = node.getAttribute(attr);
          if (value && value.length < 500) {
            attrs[attr] = value;
          }
        }
      }

      const DATA_ATTR_SKIP = [/ved/i, /hveid/i, /lhcontainer/i, /mcp/i, /mg-cp/i, /abe/i, /st-cnt/i, /st-tgt/i];
      if (node.attributes) {
        for (let i = 0; i < node.attributes.length; i++) {
          const attr = node.attributes[i];
          if (attr.name.startsWith('data-')) {
            const isNoisy = DATA_ATTR_SKIP.some(p => p.test(attr.name));
            if (!isNoisy && attr.name.length < 20 && attr.value.length < 200) {
              attrs[attr.name] = attr.value;
            }
          }
        }
      }

      let directText = getDirectText(node);
      const nodeWords = directText.split(/\s+/).filter(w => w.length > 0).length;

      if (totalWords + nodeWords > WORD_BUDGET) {
        // Partial text if near budget
        const words = directText.split(/\s+/);
        const remaining = WORD_BUDGET - totalWords;
        directText = words.slice(0, remaining).join(" ");
        totalWords = WORD_BUDGET;
      } else {
        totalWords += nodeWords;
      }

      let value = null;
      let checked = null;

      if (["INPUT", "TEXTAREA", "SELECT"].includes(tag)) {
        value = (node.value || "").slice(0, 500);
        if (tag === "INPUT") {
          checked = node.checked || null;
        }
      }

      const children = [];
      if (node.children && totalWords < WORD_BUDGET) {
        const maxChildren = depth < 10 ? 100 : 30;
        for (let i = 0; i < Math.min(node.children.length, maxChildren); i++) {
          const child = serialize(node.children[i], depth + 1, maxDepth);
          if (child) children.push(child);
          if (totalWords >= WORD_BUDGET) break;
        }
      }

      const hasText = directText && directText.length > 0;
      const hasValue = value !== null && value.length > 0;
      const hasAttrs = Object.keys(attrs).length > 0;
      const hasChildren = children.length > 0;

      const importantTags = ["INPUT", "BUTTON", "A", "LABEL", "SELECT", "OPTION", "FORM", "H1", "H2", "H3", "H4", "H5", "H6", "LI", "ARTICLE", "SECTION", "P", "MAIN"];
      const isImportant = importantTags.includes(tag) || isContentElement(node);

      if (!hasText && !hasValue && !hasChildren && !isImportant) return null;

      if (["DIV", "SPAN"].includes(tag) &&
        !hasText && !hasValue && !hasAttrs &&
        children.length === 1 && !isImportant) {
        return children[0];
      }

      return {
        tag: tagLower,
        ...(hasAttrs && { attrs }),
        ...(hasText && { text: directText }),
        ...(value !== null && { value }),
        ...(checked !== null && { checked }),
        ...(hasChildren && { children })
      };
    }

    const mainContent = document.querySelector(
      'main, [role="main"], #main, #content, .main, .content, article, .article, .post'
    );
    const startNode = mainContent || document.body;

    if (!startNode) return { error: "No starting node found" };

    const domTree = serialize(startNode, 0);

    let text = document.body?.innerText || "";
    const noiseHeaders = [
      /^Accessibility links\s+Skip to main content\s+Accessibility help\s+Accessibility feedback/i,
      /^Skip to main content/i
    ];
    for (const pattern of noiseHeaders) {
      text = text.replace(pattern, "").trim();
    }

    // Calculate final word count from textContent
    const finalWords = text.split(/\s+/).filter(w => w.length > 0).slice(0, WORD_BUDGET);
    console.log("finalWords", finalWords.join(" "));
    return {
      title: document.title,
      url: location.href,
      word_count: Math.min(totalWords, WORD_BUDGET),
      extractedAt: new Date().toISOString(),
      domTree,
      textContent: finalWords.join(" ")
    };




  } catch (error) {
    console.error("❌ Extraction error:", error);
    return { error: error.message, stack: error.stack };
  }
}

// ==================================================
// 🆕 IMAGE PREVIEW & UPLOAD HELPERS
// ==================================================

let attachedImageUrl = null;

window.showInputPreview = function (url) {
  const container = document.getElementById('inputPreviewArea');
  const img = document.getElementById('previewImage');
  const previewLabel = document.getElementById('previewLabel');
  if (!container || !img) return;

  // Show a "Loading preview..." initially if the image is big
  if (previewLabel) previewLabel.innerText = "Loading preview...";

  // Use a unique query param to bypass potential caching/browser extension proxy issues
  const browserSafeUrl = url + (url.includes('?') ? '&' : '?') + 't=' + Date.now();

  img.onload = () => {
    if (previewLabel) previewLabel.innerText = "Image attached - Type your query below";
    container.classList.remove('hidden');
    focusInput();
    console.log("✅ Preview image loaded successfully");
  };

  img.onerror = () => {
    if (previewLabel) previewLabel.innerText = "❌ Failed to load preview";
    console.error("❌ Failed to load preview image:", browserSafeUrl);
  };

  img.src = browserSafeUrl;
  attachedImageUrl = url; // Keep original URL for backend
};

window.clearInputPreview = function () {
  const container = document.getElementById('inputPreviewArea');
  if (!container) return;

  container.classList.add('hidden');
  attachedImageUrl = null;
};

// Initialize preview remove button
const previewRemoveBtn = document.getElementById('previewRemoveBtn');
if (previewRemoveBtn) {
  previewRemoveBtn.onclick = () => window.clearInputPreview();
}

async function uploadMediaToR2(base64Data, filename, fileType, source) {
  const progressContainer = document.getElementById('uploadProgressContainer');
  const progressBar = document.getElementById('uploadProgressBar');
  const previewArea = document.getElementById('inputPreviewArea');
  const previewLabel = document.getElementById('previewLabel');

  try {
    const auth = await new Promise(resolve => chrome.storage.local.get(['access_token'], resolve));
    const token = auth.access_token;
    if (!token) throw new Error("Please log in first");

    // Show preview area and loading bar
    if (previewArea) previewArea.classList.remove('hidden');
    if (progressContainer) progressContainer.classList.remove('hidden');
    if (previewLabel) previewLabel.innerText = "Uploading to cloud...";

    // Start simulation
    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.random() * 15;
      if (progress > 90) progress = 90;
      if (progressBar) progressBar.style.width = `${progress}% `;
    }, 200);

    // Remove data:image/png;base64, prefix if present
    const cleanBase64 = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;

    const response = await fetch("http://localhost:8000/media/upload", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token} `
      },
      body: JSON.stringify({
        file_data: cleanBase64,
        filename: filename,
        file_type: fileType,
        source: source
      })
    });

    const result = await response.json();

    clearInterval(interval);
    if (progressBar) progressBar.style.width = '100%';

    if (result.status === "success") {
      setTimeout(() => {
        if (progressContainer) progressContainer.classList.add('hidden');
        if (progressBar) progressBar.style.width = '0%';
      }, 500);
      return result;
    } else {
      throw new Error(result.message || "Upload failed");
    }

  } catch (error) {
    if (progressContainer) progressContainer.classList.add('hidden');
    if (previewLabel) previewLabel.innerText = "❌ Upload failed";
    return { status: "error", message: error.message };
  }
}

window.uploadMediaToR2 = uploadMediaToR2;

// ==================================================
// EXPORTS (if using modules, otherwise these are global)
// ==================================================

// Make sendMessage globally available
window.sendMessage = sendMessage;

console.log("✅ Sidebar fully initialized");

function handleSystemStatus(msg) {
  log("📝 System Status: " + msg.text, "info");

  // Use a specialized system message style
  const wrapper = document.createElement("div");
  wrapper.className = "system-status-msg";

  // Add icon based on content
  let icon = "⚙️";
  if (msg.text.includes("✅")) icon = "✅";
  if (msg.text.includes("❌")) icon = "❌";
  if (msg.text.includes("🚀")) icon = "🚀";
  if (msg.text.includes("🔍")) icon = "🔍";
  if (msg.text.includes("🔗")) icon = "🔗";
  if (msg.text.includes("📄")) icon = "📄";
  if (msg.text.includes("🎥")) icon = "";

  wrapper.innerHTML = `
    < div class="system-status-text" > ${msg.text}</div >
      `;

  DOM.messages.appendChild(wrapper);
  scrollToBottom();
}


// ==================================================
// GOOGLE OAUTH LOGIC
// ==================================================

async function initAuth() {
  const profileToggle = document.getElementById('profileToggle');
  const profileDropdown = document.getElementById('profileDropdown');
  const btnAuth = document.getElementById('btnAuth');
  const btnMedia = document.getElementById('btnMedia');

  if (profileToggle && profileDropdown) {
    profileToggle.onclick = (e) => {
      e.stopPropagation();
      profileDropdown.classList.toggle('hidden');
    };

    document.addEventListener('click', (e) => {
      if (!profileDropdown.contains(e.target) && !profileToggle.contains(e.target)) {
        profileDropdown.classList.add('hidden');
      }
    });
  }

  // Media Gallery Button
  if (btnMedia) {
    btnMedia.onclick = () => {
      profileDropdown.classList.add('hidden');
      showMediaGallery();
    };
  }

  // Auth Button (Dropdown and Primary)
  const btnLoginPrimary = document.getElementById('btnLoginPrimary');
  if (btnLoginPrimary) btnLoginPrimary.onclick = loginWithGoogle;
  if (btnAuth) {
    btnAuth.onclick = () => {
      const authText = document.getElementById('authText');
      const isLoggedOut = authText && authText.innerText.includes('Login');
      if (isLoggedOut) {
        loginWithGoogle();
      } else {
        logoutGoogle();
      }
    };
  }

  // Check current auth status
  checkAuthStatus();
}

// 🚀 Updated Check Auth Status (Redirect to Login if needed)
function checkAuthStatus() {
  // chrome.storage.local.get(['userData', 'access_token', 'userLoggedOut'], (result) => {
  //   const loginView = document.getElementById('loginView');
  //   const mainView = document.getElementById('mainView');

  //   if (result.access_token) {
  //     console.log("✅ User authenticated with JWT.");
  //     if (loginView) loginView.classList.add('hidden');
  //     if (mainView) mainView.classList.remove('hidden');
  //     updateAuthUI(result.userData);
  //   } else {
  //     console.log("🔒 User not authenticated. Showing login view.");
  //     if (loginView) loginView.classList.remove('hidden');
  //     if (mainView) mainView.classList.add('hidden');

  //     // Only attempt background auth if the user hasn't explicitly logged out
  //     if (!result.userLoggedOut) {
  //       console.log("🔄 Attempting background auth...");
  //       chrome.identity.getAuthToken({ interactive: false }, (token) => {
  //         if (token) fetchUserInfo(token);
  //       });
  //     } else {
  //       console.log("🚫 Background auth skipped (User explicitly logged out).");
  //     }
  //   }
  // });
  return true
}

async function loginWithGoogle() {
  console.log("🔑 Initiating Google Login...");
  try {
    // Clear the logged out flag first
    chrome.storage.local.set({ userLoggedOut: false });
    chrome.identity.getAuthToken({ interactive: true }, (token) => {
      if (chrome.runtime.lastError) {
        console.error("❌ Auth error:", chrome.runtime.lastError.message);
        log(`❌ Auth error: ${chrome.runtime.lastError.message} `, "error");
        return;
      }
      if (!token) {
        console.error("❌ No token received");
        log("❌ No token received", "error");
        return;
      }
      console.log("✅ Token received, fetching user info...");
      fetchUserInfo(token);
    });
  } catch (err) {
    console.error("❌ Login catch error:", err);
    log(`❌ Login failed: ${err.message} `, "error");
  }
}

async function logoutGoogle() {
  log("🚪 Logging out...", "info");
  try {
    // 1. Fetch, Revoke and then Remove identity token
    chrome.identity.getAuthToken({ interactive: false }, async (token) => {
      if (token) {
        // Revoke the token with Google to force account selection next time
        try {
          await fetch(`https://accounts.google.com/o/oauth2/revoke?token=${token}`);
          console.log("✅ Google token revoked.");
        } catch (revokeErr) {
          console.warn("⚠️ Failed to revoke token at Google:", revokeErr);
        }

        chrome.identity.removeCachedAuthToken({ token }, () => {
          console.log("✅ Cached identity token removed.");
        });
      }
    });

    // 2. Clear backend cookie using chrome.cookies API
    try {
      if (chrome.cookies) {
        chrome.cookies.remove({
          url: 'http://localhost:8000',
          name: 'session_token'
        });
        console.log("✅ Backend session cookie cleared.");
      }
    } catch (cookieErr) {
      console.warn("⚠️ Failed to clear session cookie:", cookieErr);
    }

    // 3. Inform backend
    fetch('http://localhost:8000/auth/logout', { method: 'POST' }).catch(() => { });

    // 4. Clear storage and UI
    chrome.storage.local.remove(['userData', 'access_token'], () => {
      chrome.storage.local.set({ userLoggedOut: true }, () => {
        checkAuthStatus(); // Show login view
        log("✅ Logged out successfully.", "success");
      });
    });
  } catch (err) {
    console.error("❌ Logout failed:", err);
  }
}

async function fetchUserInfo(token) {
  try {
    const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const userData = await response.json();

    // 🆕 Synchronize with FastAPI backend for JWT
    try {
      console.log("🚀 Fetching JWT from backend /login...");
      const backendResponse = await fetch('http://localhost:8000/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: userData.name,
          email: userData.email,
          userDp: userData.picture
        })
      });
      const backendData = await backendResponse.json();

      if (backendData.status === "success") {
        console.log("✅ JWT obtained successfully.");
        // Store both user data and JWT
        const mergedData = { ...userData, backend: backendData.user || {} };
        chrome.storage.local.set({
          userData: mergedData,
          access_token: backendData.access_token
        }, () => {
          checkAuthStatus(); // Toggle to main view
        });
      } else {
        throw new Error(backendData.message || "Failed to get JWT");
      }
    } catch (backendErr) {
      console.error("❌ Backend sync failed:", backendErr);
      log(`❌ Backend sync failed: ${backendErr.message}`, "error");
    }

    log(`✅ Welcome, ${userData.name}!`, "success");
  } catch (err) {
    console.error("❌ Failed to fetch profile:", err);
    log(`❌ Failed to fetch user profile: ${err.message}`, "error");
  }
}

function updateAuthUI(userData) {
  const avatar = document.getElementById('userAvatar');
  const emailDisplay = document.getElementById('displayEmail');
  const authText = document.getElementById('authText');
  const authIcon = document.getElementById('authIcon');
  const profileSection = document.getElementById('userProfile');

  if (userData) {
    if (avatar) avatar.src = userData.picture || avatar.src;
    if (emailDisplay) emailDisplay.innerText = userData.email;
    if (authText) authText.innerText = "Logout";
    if (authIcon) {
      authIcon.setAttribute('class', ''); // Safely reset classes for SVG
      authIcon.setAttribute('data-lucide', 'log-out');
      if (window.lucide) window.lucide.createIcons();
    }
    if (profileSection) profileSection.title = userData.name;
    console.log("👤 Profile UI updated for user:", userData.email);
  } else {
    if (avatar) avatar.src = "https://www.gstatic.com/images/branding/product/1x/avatar_circle_blue_512dp.png";
    if (emailDisplay) emailDisplay.innerText = "Not logged in";
    if (authText) authText.innerText = "Login with Google";
    if (authIcon) {
      authIcon.setAttribute('class', ''); // Safely reset classes for SVG
      authIcon.setAttribute('data-lucide', 'log-in');
      if (window.lucide) window.lucide.createIcons();
    }
  }
}
// ==================================================
// TAB MANAGEMENT - PREVIEWS & GROUPING
// ==================================================

let openedTabCount = 0;
let groupingSuggestionShown = false;

// Listen for tab preview events
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "TAB_PREVIEW") {
    renderTabPreviewCard(msg.tab);
    openedTabCount++;

    // Check if we should suggest grouping (4+ tabs)
    if (openedTabCount >= 4 && !groupingSuggestionShown) {
      renderGroupingSuggestion();
      groupingSuggestionShown = true;
    }
  }

  if (msg.type === "TABS_GROUPED") {
    renderGroupedTabsMessage(msg.groups);
    groupingSuggestionShown = false; // Reset for next session
    openedTabCount = 0;
  }
});

function renderTabPreviewCard(tab) {
  const messagesContainer = document.getElementById('messages');
  if (!messagesContainer) return;

  const card = document.createElement('div');
  card.className = 'tab-preview-card';
  card.dataset.tabId = tab.id;

  const thumbnail = tab.thumbnail ?
    `<img src="${tab.thumbnail}" class="tab-preview-thumbnail" alt="${tab.title}" />` :
    '<div class="tab-preview-thumbnail" style="background: var(--input-bg); display: flex; align-items: center; justify-content: center; font-size: 24px;">🌐</div>';

  card.innerHTML = `
    ${thumbnail}
    <div class="tab-preview-content">
      <div class="tab-preview-title">${tab.title}</div>
      <div class="tab-preview-url">${new URL(tab.url).hostname}</div>
    </div>
    <i data-lucide="external-link" class="tab-preview-icon"></i>
  `;

  card.onclick = () => {
    chrome.runtime.sendMessage({
      type: "SWITCH_TO_TAB",
      tabId: tab.id
    });
  };

  messagesContainer.appendChild(card);
  scrollToBottom();

  // Initialize Lucide icons
  if (window.lucide) window.lucide.createIcons();
}

function renderGroupingSuggestion() {
  const messagesContainer = document.getElementById('messages');
  if (!messagesContainer) return;

  const suggestion = document.createElement('div');
  suggestion.className = 'grouping-suggestion';
  suggestion.id = 'grouping-suggestion';

  suggestion.innerHTML = `
    <div class="grouping-suggestion-text">
      <span class="grouping-suggestion-icon">📂</span>
      <span>I've opened several tabs for you. Would you like me to group them by topic to keep things organized?</span>
    </div>
    <button class="grouping-suggestion-button" id="groupNowBtn">
      Group Now
    </button>
  `;

  messagesContainer.appendChild(suggestion);
  scrollToBottom();

  const groupNowBtn = document.getElementById('groupNowBtn');
  if (groupNowBtn) {
    groupNowBtn.onclick = () => {
      groupTabs();
      suggestion.remove();
    };
  }
}

function renderGroupedTabsMessage(groups) {
  const messagesContainer = document.getElementById('messages');
  if (!messagesContainer) return;

  const container = document.createElement('div');
  container.className = 'bot-msg';

  const textDiv = document.createElement('div');
  textDiv.className = 'bot-text';
  textDiv.textContent = `✨ I've organized your ${groups.reduce((sum, g) => sum + g.tabs.length, 0)} tabs into ${groups.length} topic groups:`;
  container.appendChild(textDiv);

  groups.forEach((group, index) => {
    const groupContainer = document.createElement('div');
    groupContainer.className = 'grouped-tabs-container';
    groupContainer.dataset.groupIndex = index;

    groupContainer.innerHTML = `
      <div class="tab-group-header" onclick="this.classList.toggle('expanded'); this.nextElementSibling.classList.toggle('expanded')">
        <div class="tab-group-title">
          <span class="tab-group-emoji">${getGroupEmoji(group.topic)}</span>
          <span>${group.topic}</span>
        </div>
        <div style="display: flex; align-items: center; gap: 8px;">
          <span class="tab-group-count">${group.tabs.length} tabs</span>
          <i data-lucide="chevron-down" class="tab-group-expand-icon"></i>
        </div>
      </div>
      <div class="tab-group-content">
        <div class="tab-group-items">
          ${group.tabs.map(tab => `
            <div class="tab-group-item" data-tab-id="${tab.id}" onclick="switchToTabById(${tab.id})">
              <img src="${tab.favIconUrl || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><text y="20" font-size="20">🌐</text></svg>'}" class="tab-group-item-favicon" alt="" />
              <div class="tab-group-item-content">
                <div class="tab-group-item-title">${tab.title}</div>
                <div class="tab-group-item-url">${new URL(tab.url).hostname}</div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    container.appendChild(groupContainer);
  });

  messagesContainer.appendChild(container);
  scrollToBottom();

  // Initialize Lucide icons
  if (window.lucide) window.lucide.createIcons();
}

function getGroupEmoji(topic) {
  const topicLower = topic.toLowerCase();
  if (topicLower.includes('shop') || topicLower.includes('buy') || topicLower.includes('product')) return '🛍️';
  if (topicLower.includes('news') || topicLower.includes('article')) return '📰';
  if (topicLower.includes('video') || topicLower.includes('youtube')) return '🎬';
  if (topicLower.includes('social') || topicLower.includes('media')) return '💬';
  if (topicLower.includes('doc') || topicLower.includes('read')) return '📚';
  if (topicLower.includes('code') || topicLower.includes('dev')) return '💻';
  if (topicLower.includes('music') || topicLower.includes('audio')) return '🎵';
  if (topicLower.includes('travel') || topicLower.includes('trip')) return '✈️';
  return '📂';
}

window.switchToTabById = async function (tabId) {
  console.log("🖱️ Tab clicked in carousel:", tabId);
  chrome.runtime.sendMessage({
    type: "SWITCH_TO_TAB",
    tabId: tabId
  });

  // 🆕 Explicitly save context when selecting from carousel
  try {
    const tab = await chrome.tabs.get(tabId);
    if (tab && tab.url && tab.url.startsWith('http')) {
      saveContext(tab);
    }
  } catch (err) {
    console.error("❌ Error saving context for selected tab:", err);
  }
};

function groupTabs() {
  const messagesContainer = document.getElementById('messages');

  // Show loading indicator
  const loading = document.createElement('div');
  loading.className = 'grouping-loading';
  loading.id = 'grouping-loading';
  loading.innerHTML = `
    <div class="grouping-loading-spinner"></div>
    <div class="grouping-loading-text">Analyzing tabs and grouping by topic...</div>
  `;
  messagesContainer.appendChild(loading);
  scrollToBottom();

  chrome.runtime.sendMessage({ type: "GROUP_TABS" }, (response) => {
    const loadingEl = document.getElementById('grouping-loading');
    if (loadingEl) loadingEl.remove();

    if (response && response.success) {
      log("✅ Tabs grouped successfully", "success");
    } else {
      log("❌ Grouping failed: " + (response?.error || "Unknown error"), "error");

      const errorMsg = document.createElement('div');
      errorMsg.className = 'bot-msg';
      errorMsg.innerHTML = `<div class="bot-text">❌ Failed to group tabs: ${response?.error || "Unknown error"}</div>`;
      messagesContainer.appendChild(errorMsg);
      scrollToBottom();
    }
  });
}

// ==================================================
// SHOW ALL TABS CAROUSEL
// ==================================================

async function showTabsCarousel() {
  log("🗂️ Fetching tabs for current window...", "info");

  chrome.runtime.sendMessage({ type: "GET_ALL_TABS", currentWindow: true }, (response) => {
    if (!response || !response.success) {
      addSystemBotMessage("❌ Failed to fetch tabs");
      return;
    }

    const tabs = response.tabs;
    if (!tabs || tabs.length === 0) {
      addSystemBotMessage("📭 No tabs open in this window");
      return;
    }

    log(`✅ Found ${tabs.length} tabs in this window`, "success");

    // Group tabs by domain
    const groupedByDomain = {};
    tabs.forEach(tab => {
      try {
        let domain = "Other";
        if (tab.url) {
          const url = new URL(tab.url);
          domain = url.hostname.replace('www.', '');
        }

        if (!groupedByDomain[domain]) {
          groupedByDomain[domain] = {
            domain: domain,
            tabs: []
          };
        }

        groupedByDomain[domain].tabs.push(tab);
      } catch (e) {
        console.warn("Failed to parse URL:", tab.url);
      }
    });

    // Convert to array and sort by number of tabs
    const groups = Object.values(groupedByDomain).sort((a, b) => b.tabs.length - a.tabs.length);

    // Render in chat
    renderAllTabsGrouped(groups, tabs.length);
  });
}

function renderAllTabsGrouped(groups, totalCount) {
  const messagesContainer = document.getElementById('messages');
  if (!messagesContainer) return;

  const container = document.createElement('div');
  container.className = 'bot-msg native-tabs-container';

  const textDiv = document.createElement('div');
  textDiv.className = 'bot-text';
  textDiv.style.marginBottom = '16px';
  textDiv.textContent = `📂 This Window (${totalCount} tabs)`;
  container.appendChild(textDiv);

  groups.forEach((group, index) => {
    const groupSection = document.createElement('div');
    groupSection.className = 'native-group-section';
    groupSection.dataset.groupIndex = index;

    const domainIcon = getDomainIcon(group.domain);

    groupSection.innerHTML = `
      <div class="native-group-header">
        <div class="native-group-title">
          <span class="native-group-icon">${domainIcon}</span>
          <span>${group.domain}</span>
          <span class="native-group-count">${group.tabs.length}</span>
        </div>
      </div>
      <div class="native-scroll-row">
        ${group.tabs.map(tab => `
          <div class="native-tab-card minimal ${tab.active ? 'active-tab' : ''}" data-tab-id="${tab.id}" onclick="switchToTabById(${tab.id})">
             <div class="native-tab-info minimal">
                <img src="${tab.favIconUrl || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><text y="20" font-size="20">🌐</text></svg>'}" class="native-tab-favicon" />
                <div class="native-tab-text">
                    <div class="native-tab-title" title="${tab.title}">${tab.title}</div>
                </div>
             </div>
             <button class="native-tab-close-btn" onclick="event.stopPropagation(); closeTabById(this, ${tab.id})" title="Close Tab">✕</button>
          </div>
        `).join('')}
      </div>
    `;

    container.appendChild(groupSection);
  });

  messagesContainer.appendChild(container);
  scrollToBottom();

  // Initialize Lucide icons
  if (window.lucide) window.lucide.createIcons();
}

// 🆕 Close Tab Function
window.closeTabById = function (btnElement, tabId) {
  chrome.runtime.sendMessage({ type: "CLOSE_TAB", tabId: tabId }, (response) => {
    if (response && response.success) {
      // Animate removal
      const card = btnElement.closest('.native-tab-card');
      if (card) {
        card.style.transform = 'scale(0.8) opacity(0)';
        setTimeout(() => {
          card.remove();
          // Optional: Update counts or remove empty groups
        }, 200);
      }
    } else {
      console.error("Failed to close tab");
    }
  });
};

function getDomainIcon(domain) {
  const domainLower = domain.toLowerCase();

  // Social Media
  if (domainLower.includes('youtube')) return '🎬';
  if (domainLower.includes('twitter') || domainLower.includes('x.com')) return '🐦';
  if (domainLower.includes('facebook')) return '👥';
  if (domainLower.includes('instagram')) return '📷';
  if (domainLower.includes('linkedin')) return '💼';
  if (domainLower.includes('reddit')) return '🤖';

  // Developer
  if (domainLower.includes('github')) return '💻';
  if (domainLower.includes('stackoverflow')) return '📚';
  if (domainLower.includes('gitlab')) return '🦊';

  // Shopping
  if (domainLower.includes('amazon')) return '🛒';
  if (domainLower.includes('ebay')) return '🏪';
  if (domainLower.includes('etsy')) return '🎨';

  // News
  if (domainLower.includes('news') || domainLower.includes('bbc') || domainLower.includes('cnn')) return '📰';
  if (domainLower.includes('nytimes') || domainLower.includes('washingtonpost')) return '📰';

  // Search & Tools
  if (domainLower.includes('google')) return '🔍';
  if (domainLower.includes('bing')) return '🔍';
  if (domainLower.includes('chatgpt') || domainLower.includes('openai')) return '🧠';
  if (domainLower.includes('claude') || domainLower.includes('anthropic')) return '🧠';

  // Productivity
  if (domainLower.includes('gmail') || domainLower.includes('mail')) return '✉️';
  if (domainLower.includes('docs.google') || domainLower.includes('drive')) return '📄';
  if (domainLower.includes('notion')) return '📝';
  if (domainLower.includes('trello') || domainLower.includes('jira')) return '📋';

  // Default
  if (domainLower.includes('localhost') || domainLower.includes('127.0.0.1')) return '🏠';

  return '🌐';
}

// Helper to check for restricted Chrome/system pages
function isRestrictedPage(url) {
  if (!url || typeof url !== "string") return true;

  const restrictedSchemes = [
    "chrome://",
    "chrome-extension://",
    "edge://",
    "about:",
    "view-source:",
    "devtools://",
    "brave://",
    "opera://",
    "vivaldi://"
  ];

  return restrictedSchemes.some(scheme => url.startsWith(scheme));
}

// Initialize Group Tabs button
function initGroupTabsButton() {
  const btnGroupTabs = document.getElementById('btnGroupTabs');
  if (btnGroupTabs) {
    btnGroupTabs.onclick = () => {
      groupTabs();
    };
  }
}

// Call this during initialization
setTimeout(initGroupTabsButton, 500);
