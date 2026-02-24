// ==================================================
// CIRCLE TO SEARCH FEATURE MODULE
// ==================================================

import { log, DOM } from '../dom/elements.js';

let isProcessing = false;

export function initCircleSearch() {
    if (DOM.btnCircleSearch) {
        DOM.btnCircleSearch.onclick = () => {
            if (isProcessing) {
                log("⏳ Circle search already in progress", "warn");
                return;
            }
            log("🔍 Circle Search activated", "info");
            isProcessing = true;

            // Show immediate loading skeleton
            showLoadingSkeleton();

            activateDrawingMode();
        };
    }
}

function showLoadingSkeleton() {
    if (!DOM.messages) return;

    const skeleton = document.createElement("div");
    skeleton.className = "bot-msg circle-search-skeleton";
    skeleton.id = "circle-search-loading";
    skeleton.innerHTML = `
    <div class="skeleton-status">🔍 <strong>Draw on the page to select content...</strong></div>
    <div class="skeleton-box"></div>
  `;
    DOM.messages.appendChild(skeleton);
    DOM.messages.scrollTop = DOM.messages.scrollHeight;
}

function activateDrawingMode() {
    // Send message to content script to inject canvas
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
            chrome.tabs.sendMessage(
                tabs[0].id,
                { type: "ACTIVATE_CIRCLE_SEARCH" },
                (response) => {
                    if (response?.success) {
                        log("✅ Drawing mode activated", "success");
                    }
                }
            );
        }
    });
}

export async function handleCircleSearchResult(imageData, pageUrl, pageTitle) {
    log("📸 Circle search image captured. Uploading...", "info");

    // Remove loading skeleton
    const skeleton = document.getElementById("circle-search-loading");
    if (skeleton) skeleton.remove();

    try {
        // Upload to R2 via the sidebar helper
        // We use window.uploadMediaToR2 which we added to sidebar.js
        if (typeof window.uploadMediaToR2 !== 'function') {
            throw new Error("Cloud upload helper not found");
        }

        const result = await window.uploadMediaToR2(imageData, `circle-search-${Date.now()}.png`, 'image', 'circle_search');

        if (result.status === "success" && result.file_url) {
            log("✅ Selection uploaded to cloud", "success");

            // Show preview in message input
            if (typeof window.showInputPreview === 'function') {
                window.showInputPreview(result.file_url);
            }

            // Helpful prompt in chat
            if (DOM.messages) {
                const tip = document.createElement("div");
                tip.className = "bot-msg system-tip";
                tip.style.textAlign = "center";
                tip.style.padding = "10px";
                tip.style.fontSize = "12px";
                tip.style.background = "var(--bg-secondary)";
                tip.style.borderRadius = "8px";
                tip.style.margin = "8px 0";
                tip.innerHTML = '🔍 <strong>Selection captured!</strong> Type your query below to analyze it.';
                DOM.messages.appendChild(tip);
                DOM.messages.scrollTop = DOM.messages.scrollHeight;
            }
        } else {
            throw new Error(result.message || "Upload failed");
        }
    } catch (error) {
        log(`❌ Circle Search Error: ${error.message}`, "error");
        if (DOM.messages) {
            const err = document.createElement("div");
            err.className = "bot-msg error";
            err.style.color = "var(--error)";
            err.style.padding = "10px";
            err.innerText = "❌ Failed to upload selection. Please try again.";
            DOM.messages.appendChild(err);
        }
    } finally {
        isProcessing = false;
    }
}

// Simple markdown formatter
function formatMarkdown(text) {
    return text
        // Bold
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        // Italic
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        // Code inline
        .replace(/`(.+?)`/g, '<code>$1</code>')
        // Line breaks
        .replace(/\n/g, '<br>')
        // Links
        .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank">$1</a>');
}

function displaySuggestions(analysis, container) {
    if (!container) return;

    // Create results section
    const resultsSection = document.createElement("div");
    resultsSection.className = "circle-search-results-section";

    // Explanation/Description with streaming effect
    if (analysis.explanation || analysis.description) {
        const explanationDiv = document.createElement("div");
        explanationDiv.className = "circle-search-explanation";
        explanationDiv.innerHTML = `
      <div class="explanation-header">${getContentTypeIcon(analysis.content_type)} <strong>${(analysis.content_type || 'general').toUpperCase()} DETECTED</strong></div>
      <div class="explanation-text">${analysis.explanation || analysis.description}</div>
    `;
        resultsSection.appendChild(explanationDiv);
    }

    // Detected text if any
    if (analysis.detected_text) {
        const textCard = document.createElement("div");
        textCard.className = "detected-text-card";
        textCard.innerHTML = `<strong>📝 Detected Text:</strong> "${analysis.detected_text}"`;
        resultsSection.appendChild(textCard);
    }

    // User intent if present
    if (analysis.user_intent) {
        const intentCard = document.createElement("div");
        intentCard.className = "user-intent-card";
        intentCard.innerHTML = `<strong>🎯 You're probably looking to:</strong> ${analysis.user_intent}`;
        resultsSection.appendChild(intentCard);
    }

    // Suggestions header
    if (analysis.suggestions && analysis.suggestions.length > 0) {
        const suggestionsTitle = document.createElement("div");
        suggestionsTitle.className = "suggestions-title";
        suggestionsTitle.innerHTML = `💡 <strong>${analysis.suggestions.length} Helpful Resources:</strong>`;
        resultsSection.appendChild(suggestionsTitle);

        const suggestionsContainer = document.createElement("div");
        suggestionsContainer.className = "suggestions-container";

        analysis.suggestions.forEach((suggestion, idx) => {
            const card = createSuggestionCard(suggestion, idx);
            suggestionsContainer.appendChild(card);
        });

        resultsSection.appendChild(suggestionsContainer);
    }

    container.appendChild(resultsSection);
    DOM.messages.scrollTop = DOM.messages.scrollHeight;
}

function createSuggestionCard(suggestion, index) {
    const card = document.createElement("div");
    card.className = "suggestion-card";

    const icon = getSuggestionIcon(suggestion.type);

    // Extract domain from URL for display
    let domain = '';
    try {
        const url = new URL(suggestion.url);
        domain = url.hostname.replace('www.', '');
    } catch (e) {
        domain = 'Link';
    }

    card.innerHTML = `
    <div class="suggestion-icon">${icon}</div>
    <div class="suggestion-content">
      <div class="suggestion-title">${suggestion.title}</div>
      <div class="suggestion-desc">${suggestion.description}</div>
      <div class="suggestion-url">
        <span class="url-icon">🔗</span>
        <span class="url-text">${domain}</span>
      </div>
    </div>
  `;

    card.onclick = () => {
        window.open(suggestion.url, '_blank');
        log(`🔗 Opened: ${suggestion.title}`, "info");
    };

    return card;
}

function getContentTypeIcon(type) {
    const icons = {
        'product': '🛍️',
        'location': '📍',
        'question': '❓',
        'text': '📄',
        'person': '👤',
        'object': '🎯',
        'general': '🔍'
    };
    return icons[type] || '🔍';
}

function getSuggestionIcon(type) {
    const icons = {
        'shopping': '🛒',
        'map': '🗺️',
        'wiki': '📚',
        'search': '🔍',
        'answer': '💡',
        'info': 'ℹ️'
    };
    return icons[type] || '🔗';
}

function getProductIcon(productName) {
    const name = productName.toLowerCase();
    if (name.includes('glass') || name.includes('sunglass')) return '👓';
    if (name.includes('bag') || name.includes('backpack')) return '👜';
    if (name.includes('shoe') || name.includes('sneaker')) return '👟';
    if (name.includes('shirt') || name.includes('t-shirt')) return '👕';
    if (name.includes('pant') || name.includes('jeans')) return '👖';
    if (name.includes('dress')) return '👗';
    if (name.includes('watch')) return '⌚';
    if (name.includes('hat') || name.includes('cap')) return '🧢';
    if (name.includes('jacket') || name.includes('coat')) return '🧥';
    if (name.includes('phone')) return '📱';
    if (name.includes('laptop') || name.includes('computer')) return '💻';
    if (name.includes('headphone') || name.includes('earbuds')) return '🎧';
    return '🛍️';
}

function displayError(message, container) {
    if (!container) return;

    const errorDiv = document.createElement("div");
    errorDiv.className = "circle-search-error";
    errorDiv.innerHTML = `<div class="bot-text" style="color: var(--error, #ef4444);">❌ ${message}</div>`;
    container.appendChild(errorDiv);
    DOM.messages.scrollTop = DOM.messages.scrollHeight;
    isProcessing = false;
}
