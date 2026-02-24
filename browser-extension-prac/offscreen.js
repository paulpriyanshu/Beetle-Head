let mediaRecorder = null;
let recordedChunks = [];
let stream = null;

console.log('🎥 Offscreen recorder loaded');

chrome.runtime.onMessage.addListener(async (msg, sender, sendResponse) => {
  console.log('📨 Offscreen received:', msg.type);
  
  if (msg.type === "START_RECORDING_OFFSCREEN") {
    try {
      console.log('🎬 Requesting display media...');
      
      stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          frameRate: 30,
          cursor: "always"
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true
        }
      });

      console.log('✅ Display media obtained');

      mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('video/webm;codecs=vp9') 
          ? 'video/webm;codecs=vp9' 
          : 'video/webm'
      });

      recordedChunks = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          recordedChunks.push(e.data);
          console.log(`📦 Chunk recorded: ${e.data.size} bytes`);
        }
      };

      mediaRecorder.onstop = async () => {
        console.log('⏹ MediaRecorder stopped, processing video...');
        
        const blob = new Blob(recordedChunks, { type: "video/webm" });
        console.log(`📹 Total video size: ${blob.size} bytes`);
        
        const buffer = await blob.arrayBuffer();
        const base64 = btoa(
          new Uint8Array(buffer).reduce((data, byte) => 
            data + String.fromCharCode(byte), ""
          )
        );

        console.log('✅ Video encoded to base64');

        // Send to background script
        chrome.runtime.sendMessage({
          type: "RECORDING_COMPLETE",
          video: base64
        });

        // Stop all tracks
        if (stream) {
          stream.getTracks().forEach(track => {
            track.stop();
            console.log(`🛑 Track stopped: ${track.kind}`);
          });
        }
        
        stream = null;
        mediaRecorder = null;
      };

      mediaRecorder.onerror = (e) => {
        console.error('❌ MediaRecorder error:', e);
      };

      mediaRecorder.start(100); // Capture in 100ms chunks
      console.log('✅ Recording started');
      
    } catch (err) {
      console.error("❌ Recording failed:", err);
      
      // User cancelled the screen picker
      if (err.name === 'NotAllowedError') {
        console.log('ℹ️ User cancelled screen selection');
      }
    }
  }

  if (msg.type === "STOP_RECORDING_OFFSCREEN") {
    console.log('⏹ Stop recording requested');
    
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
      console.log("✅ MediaRecorder stopped");
    } else {
      console.log('⚠️ No active recording to stop');
    }
  }
});

// Handle track ended (user stopped sharing)
function handleTrackEnded() {
  console.log('🛑 User stopped sharing screen');
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
  }
}