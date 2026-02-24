// ==================================================
// SCREENSHOT FEATURE MODULE
// ==================================================

import { log, DOM, scrollToBottom } from '../dom/elements.js';

export function initScreenshot() {
  // Modal controls
  if (DOM.ssClose) {
    DOM.ssClose.onclick = closeSSModal;
  }
  
  const backdrop = DOM.ssModal?.querySelector(".ss-modal-backdrop");
  if (backdrop) {
    backdrop.onclick = closeSSModal;
  }
  
  if (DOM.btnScreenshot) {
    DOM.btnScreenshot.onclick = () => {
      if (DOM.ssModal) {
        DOM.ssModal.classList.remove("hidden");
      }
    };
  }

  if (DOM.ssVisible) {
    DOM.ssVisible.onclick = () => {
      closeSSModal();
      log("📸 Visible screenshot selected", "info");
      takeNormalScreenshot();
    };
  }

  if (DOM.ssFull) {
    DOM.ssFull.onclick = () => {
      closeSSModal();
      log("📜 Full page screenshot selected", "info");
      takeFullPageScreenshot();
    };
  }
}

function closeSSModal() {
  if (DOM.ssModal) {
    DOM.ssModal.classList.add("hidden");
  }
}

function takeNormalScreenshot() {
  log("📸 Taking visible screenshot", "info");

  chrome.runtime.sendMessage(
    { type: "TAKE_SCREENSHOT" },
    (res) => {
      if (!res?.success) {
        log("❌ Screenshot failed", "error");
        return;
      }
      showScreenshotPreview(res.image);
    }
  );
}

async function takeFullPageScreenshot() {
  log("📜 Starting full page screenshot", "info");

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  // Get page dimensions
  const [{ result: page }] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => ({
      height: document.documentElement.scrollHeight,
      viewport: window.innerHeight,
      dpr: window.devicePixelRatio
    })
  });

  const images = [];
  let y = 0;

  while (y < page.height) {
    // Scroll page
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (scrollY) => window.scrollTo(0, scrollY),
      args: [y]
    });

    await new Promise(r => setTimeout(r, 300)); // wait for render

    // Capture viewport
    const img = await new Promise(resolve => {
      chrome.runtime.sendMessage(
        { type: "CAPTURE_VIEWPORT" },
        res => resolve(res.image)
      );
    });

    images.push(img);
    y += page.viewport;
  }

  const stitched = await stitchImages(images, page.viewport, page.dpr);
  showScreenshotPreview(stitched);

  log("✅ Full page screenshot completed", "success");
}

async function stitchImages(images, viewportHeight, dpr) {
  const imgEls = await Promise.all(
    images.map(src => {
      return new Promise(res => {
        const img = new Image();
        img.onload = () => res(img);
        img.src = src;
      });
    })
  );

  const width = imgEls[0].width;
  const height = imgEls.reduce((h, img) => h + img.height, 0);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");

  let y = 0;
  imgEls.forEach(img => {
    ctx.drawImage(img, 0, y);
    y += img.height;
  });

  return canvas.toDataURL("image/png");
}

function showScreenshotPreview(imageDataUrl) {
  if (!DOM.messages) return;
  
  const wrapper = document.createElement("div");
  wrapper.className = "bot-msg";

  const img = document.createElement("img");
  img.src = imageDataUrl;
  img.style.width = "100%";
  img.style.borderRadius = "10px";
  img.style.border = "1px solid var(--border)";
  img.style.marginTop = "8px";

  const caption = document.createElement("div");
  caption.className = "bot-text";
  caption.textContent = "📸 Screenshot captured";

  wrapper.appendChild(caption);
  wrapper.appendChild(img);
  DOM.messages.appendChild(wrapper);
  scrollToBottom(); // No store parameter
}