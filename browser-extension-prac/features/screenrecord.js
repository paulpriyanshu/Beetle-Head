// ==================================================
// SCREEN RECORDING FEATURE MODULE
// ==================================================

import { log, DOM, scrollToBottom } from '../dom/elements.js';
import { store } from '../state/store.js';

export function initScreenRecord() {
  if (!DOM.btnScreenRecord) return;
  
  DOM.btnScreenRecord.onclick = async () => {
    const state = store.getState();
    
    if (!state.isRecording) {
      log("🎥 Starting screen recording", "info");

      try {
        const response = await chrome.runtime.sendMessage({ 
          type: "START_RECORDING" 
        });
        
        if (response && response.success) {
          store.setRecording(true);
          DOM.btnScreenRecord.classList.add("active");
          DOM.btnScreenRecord.innerHTML = "⏹<span>Stop</span>";
          log("✅ Recording started", "success");
        } else {
          log("❌ Recording failed to start", "error");
        }
      } catch (error) {
        log("❌ Recording error: " + error.message, "error");
      }
    } else {
      log("⏹ Stopping recording", "info");

      try {
        await chrome.runtime.sendMessage({ 
          type: "STOP_RECORDING" 
        });
        
        store.setRecording(false);
        DOM.btnScreenRecord.classList.remove("active");
        DOM.btnScreenRecord.innerHTML = "🎥<span>Record</span>";
      } catch (error) {
        log("❌ Stop error: " + error.message, "error");
      }
    }
  };
}

export function handleRecordingData(message, store) {
  if (message.type === 'RECORDING_DATA') {
    log("✅ Recording received from background", "success");
    
    try {
      if (!message.video) {
        throw new Error("No video data received");
      }
      
      console.log("📹 Converting base64 to blob...");
      const videoBlob = base64ToBlob(message.video, "video/webm");
      console.log("✅ Blob created, size:", videoBlob.size);
      
      showRecordingPreview(videoBlob, store);
      
      // Reset button state
      store.setRecording(false);
      if (DOM.btnScreenRecord) {
        DOM.btnScreenRecord.classList.remove("active");
        DOM.btnScreenRecord.innerHTML = "🎥<span>Record</span>";
      }
    } catch (error) {
      console.error("❌ Preview error details:", error);
      log("❌ Preview error: " + error.message, "error");
      addSystemBotMessage("⚠️ Failed to display recording preview: " + error.message, store);
    }
  }
}

function base64ToBlob(base64, type) {
  try {
    // Remove any whitespace
    const cleanBase64 = base64.replace(/\s/g, '');
    
    // Decode base64
    const binaryString = atob(cleanBase64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    return new Blob([bytes], { type });
  } catch (error) {
    console.error("❌ base64ToBlob error:", error);
    throw new Error("Failed to convert base64 to blob: " + error.message);
  }
}

function showRecordingPreview(blob, store) {
  if (!DOM.messages) {
    throw new Error("Messages container not found");
  }
  
  console.log("📺 Creating video preview...");
  
  const url = URL.createObjectURL(blob);
  console.log("✅ Object URL created:", url);

  const wrapper = document.createElement("div");
  wrapper.className = "bot-msg";

  const caption = document.createElement("div");
  caption.className = "bot-text";
  caption.textContent = "📹 Screen recording completed";

  const video = document.createElement("video");
  video.src = url;
  video.controls = true;
  video.style.width = "100%";
  video.style.borderRadius = "10px";
  video.style.border = "1px solid var(--border)";
  video.style.marginTop = "8px";
  video.style.maxHeight = "400px";

  // Add error handler for video element
  video.onerror = (e) => {
    console.error("❌ Video element error:", e);
    console.error("Video error code:", video.error?.code);
    console.error("Video error message:", video.error?.message);
  };

  // Add loadedmetadata event to confirm video is working
  video.onloadedmetadata = () => {
    console.log("✅ Video metadata loaded successfully");
    console.log("Video duration:", video.duration, "seconds");
  };

  const actions = document.createElement("div");
  actions.style.display = "flex";
  actions.style.gap = "8px";
  actions.style.marginTop = "8px";

  const downloadBtn = document.createElement("a");
  downloadBtn.href = url;
  downloadBtn.download = `screen-recording-${Date.now()}.webm`;
  downloadBtn.className = "agent-action-btn";
  downloadBtn.textContent = "⬇️ Download Recording";
  downloadBtn.style.textDecoration = "none";
  downloadBtn.style.display = "inline-block";

  const playBtn = document.createElement("button");
  playBtn.className = "agent-action-btn";
  playBtn.textContent = "▶️ Play";
  playBtn.onclick = () => {
    if (video.paused) {
      video.play().then(() => {
        playBtn.textContent = "⏸️ Pause";
      }).catch(err => {
        console.error("❌ Play error:", err);
      });
    } else {
      video.pause();
      playBtn.textContent = "▶️ Play";
    }
  };

  actions.appendChild(playBtn);
  actions.appendChild(downloadBtn);

  wrapper.appendChild(caption);
  wrapper.appendChild(video);
  wrapper.appendChild(actions);
  
  DOM.messages.appendChild(wrapper);
  scrollToBottom(store);
  
  log("✅ Video preview displayed", "success");
  console.log("✅ Video preview element added to DOM");
}

function addSystemBotMessage(text, store) {
  if (!DOM.messages) return;
  
  const wrapper = document.createElement("div");
  wrapper.className = "bot-msg";
  const textDiv = document.createElement("div");
  textDiv.className = "bot-text";
  textDiv.textContent = text;
  wrapper.appendChild(textDiv);
  DOM.messages.appendChild(wrapper);
  scrollToBottom(store);
}