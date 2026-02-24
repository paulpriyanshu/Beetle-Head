let mediaRecorder;
let recordedChunks = [];

chrome.runtime.onMessage.addListener(async (msg, sender, sendResponse) => {
  if (msg.type === "START_RECORDING") {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          frameRate: 30,
          cursor: "always"
        },
        audio: true // tab + mic (if allowed)
      });

      mediaRecorder = new MediaRecorder(stream, {
        mimeType: "video/webm; codecs=vp9"
      });

      recordedChunks = [];

      mediaRecorder.ondataavailable = e => {
        if (e.data.size > 0) recordedChunks.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        const blob = new Blob(recordedChunks, { type: "video/webm" });
        const buffer = await blob.arrayBuffer();
        const base64 = btoa(
          new Uint8Array(buffer).reduce((d, b) => d + String.fromCharCode(b), "")
        );

        chrome.runtime.sendMessage({
          type: "RECORDING_COMPLETE",
          video: base64
        });
      };

      mediaRecorder.start();
      sendResponse({ success: true });
    } catch (err) {
      sendResponse({ success: false, error: err.message });
    }

    return true;
  }

  if (msg.type === "STOP_RECORDING") {
    mediaRecorder?.stop();
    mediaRecorder?.stream.getTracks().forEach(t => t.stop());
    sendResponse({ success: true });
  }
});