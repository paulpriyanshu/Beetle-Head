// ==========================================
// DOM OBSERVER - State Extraction for AI Agent
// ==========================================

window.DOMObserver = {

    /**
     * Captures a simplified snapshot of the current DOM state,
     * focusing on interactive elements.
     */
    captureState: function () {
        const interactables = [];
        const elements = document.querySelectorAll('button, a, input, select, textarea, [role="button"], [onclick]');

        let idCounter = 1;

        elements.forEach(el => {
            // Skip invisible elements
            if (!this.isVisible(el)) return;

            const rect = el.getBoundingClientRect();
            const text = el.innerText || el.value || el.placeholder || el.getAttribute('aria-label') || "";

            // Generate a unique selector or use ID
            const selector = this.getSelector(el);

            // Assign a temporary ID for the agent to reference easily if needed
            // (Though usually we use selector)
            el.dataset.agentId = idCounter++;

            interactables.push({
                tag: el.tagName.toLowerCase(),
                text: text.slice(0, 50).replace(/\s+/g, ' ').trim(),
                selector: selector,
                type: el.type || null,
                // location: { x: Math.round(rect.x), y: Math.round(rect.y) }
            });
        });

        // Extract visible page content (summary)
        const contentEl = document.querySelector('article') ||
            document.querySelector('main') ||
            document.querySelector('[role="main"]') ||
            document.body;

        let pageText = contentEl?.innerText || '';
        pageText = pageText.replace(/\s+/g, ' ').trim();

        // Limit to 2000 chars for token efficiency
        if (pageText.length > 2000) {
            pageText = pageText.substring(0, 2000) + '...';
        }

        return {
            url: window.location.href,
            title: document.title,
            width: window.innerWidth,
            height: window.innerHeight,
            pageContent: pageText, // NEW: Include actual page content
            interactables: interactables.slice(0, 100) // Limit to avoid hitting token limits
        };
    },

    /**
     * Read visible text content from the page for content analysis
     */
    readPageContent: function () {
        // Get main content - prioritize article, main, or body
        const contentEl = document.querySelector('article') ||
            document.querySelector('main') ||
            document.querySelector('[role="main"]') ||
            document.body;

        // Extract visible text (simplified approach)
        let textContent = contentEl.innerText || contentEl.textContent || '';

        // Clean up excessive whitespace
        textContent = textContent.replace(/\s+/g, ' ').trim();

        // Limit to first 3000 characters to avoid token limits
        if (textContent.length > 3000) {
            textContent = textContent.substring(0, 3000) + '...';
        }

        return {
            url: window.location.href,
            title: document.title,
            content: textContent,
            wordCount: textContent.split(' ').length
        };
    },

    isVisible: function (el) {
        if (!el.offsetParent && el.tagName !== 'BODY') return false;
        const style = window.getComputedStyle(el);
        if (style.opacity === '0' || style.visibility === 'hidden' || style.display === 'none') return false;
        return true;
    },

    getSelector: function (el) {
        if (el.id) return `#${el.id}`;

        // Try to find a unique class combination
        let className = el.className;
        if (typeof className === 'object' && className.baseVal) {
            className = className.baseVal; // Handle SVGAnimatedString
        }

        if (className && typeof className === 'string') {
            const classes = className.split(' ').filter(c => c.trim().length > 0);
            if (classes.length > 0) {
                const classSelector = '.' + classes.join('.');
                if (document.querySelectorAll(classSelector).length === 1) {
                    return classSelector;
                }
            }
        }

        // Fallback to path
        let path = [];
        while (el.nodeType === Node.ELEMENT_NODE) {
            let selector = el.nodeName.toLowerCase();
            if (el.id) {
                selector = '#' + el.id;
                path.unshift(selector);
                break;
            } else {
                let sib = el, nth = 1;
                while (sib = sib.previousElementSibling) {
                    if (sib.nodeName.toLowerCase() == selector) nth++;
                }
                if (nth != 1) selector += ":nth-of-type(" + nth + ")";
            }
            path.unshift(selector);
            el = el.parentNode;
        }
        return path.join(" > ");
    }
};

console.log("✅ DOM Observer loaded");
