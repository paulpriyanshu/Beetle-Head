// ==================================================
// WRITING TOOL FEATURE MODULE
// Highlighted text AI assistance
// ==================================================

import { API } from '../state/store.js';

export function useHighlightedTextAI() {
  let abortController = null;
  let isStreaming = false;

  async function explainSelection({
    endpoint = API.CHAT,
    selectionText,
    pageUrl,
    onStart,
    onToken,
    onStatus,
    onDone,
    onError
  }) {
    if (!selectionText || isStreaming) return;

    abortController = new AbortController();
    isStreaming = true;
    onStart?.();

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: `Explain this clearly:\n\n"${selectionText}"`,
          context: {
            type: "highlighted_text",
            source: pageUrl
          }
        }),
        signal: abortController.signal
      });

      const reader = res.body.getReader();
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
              onToken?.(event.data);
            }

            if (event.type === "status") {
              onStatus?.(event.data);
            }

            if (event.type === "error") {
              onError?.(event.data);
            }

            if (event.type === "done") {
              onDone?.();
            }
          } catch (e) {
            console.warn("Highlight stream parse error", e);
          }
        }
      }
    } catch (err) {
      if (err.name !== "AbortError") {
        onError?.(err.message);
      }
    } finally {
      isStreaming = false;
    }
  }

  function stop() {
    abortController?.abort();
    isStreaming = false;
  }

  return {
    explainSelection,
    stop,
    isStreaming: () => isStreaming
  };
}

export function applyFixToWebpage(correctedText) {
  chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
    chrome.tabs.sendMessage(tabs[0].id, {
      type: "REPLACE_TEXT",
      text: correctedText
    });
  });
}