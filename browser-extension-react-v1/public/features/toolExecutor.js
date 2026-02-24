// ==========================================
// TOOL EXECUTOR - Execute Backend Commands
// ==========================================

window.ToolExecutor = {

    execute: async function (toolCall) {
        console.log("🛠️ Executing Tool:", toolCall.name, toolCall.args);

        try {
            switch (toolCall.name) {
                case "click_element":
                    return await this.clickElement(toolCall.args.selector);

                case "type_text":
                    return await this.typeText(toolCall.args.selector, toolCall.args.text);

                case "scroll":
                    return await this.scroll(toolCall.args.direction, toolCall.args.amount);

                case "read_page_content":
                    return await this.readPageContent();

                case "done":
                    return { done: true, summary: toolCall.args.summary };

                default:
                    throw new Error(`Unknown tool: ${toolCall.name}`);
            }
        } catch (e) {
            console.error("Tool Execution Failed:", e);
            return { success: false, error: e.message };
        }
    },

    clickElement: async function (selector) {
        const el = document.querySelector(selector);
        if (!el) throw new Error(`Element not found: ${selector}`);

        // Highlight before click
        const originalBorder = el.style.border;
        el.style.border = "2px solid red";
        await new Promise(r => setTimeout(r, 500));
        el.style.border = originalBorder;

        el.click();
        return { success: true, action: "clicked" };
    },

    typeText: async function (selector, text) {
        const el = document.querySelector(selector);
        if (!el) throw new Error(`Element not found: ${selector}`);

        el.focus();
        el.value = text;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));

        // Auto-submit for search boxes (type="search" or role="searchbox" or name contains "search"/"q")
        const isSearchBox = el.type === 'search' ||
            el.getAttribute('role') === 'searchbox' ||
            el.name?.toLowerCase().includes('search') ||
            el.name?.toLowerCase() === 'q';

        if (isSearchBox) {
            // Simulate Enter key press
            const enterEvent = new KeyboardEvent('keydown', {
                key: 'Enter',
                code: 'Enter',
                keyCode: 13,
                which: 13,
                bubbles: true
            });
            el.dispatchEvent(enterEvent);
            await new Promise(r => setTimeout(r, 500)); // Wait for form submission
        }

        return { success: true, action: "typed", submitted: isSearchBox };
    },

    scroll: async function (direction, amountStr) {
        let amount = 500;
        if (amountStr === 'page') amount = window.innerHeight;
        else if (parseInt(amountStr)) amount = parseInt(amountStr);

        if (direction === 'up') amount = -amount;

        window.scrollBy({ top: amount, behavior: 'smooth' });
        await new Promise(r => setTimeout(r, 500));

        return { success: true, action: "scrolled" };
    },

    readPageContent: async function () {
        if (!window.DOMObserver || !window.DOMObserver.readPageContent) {
            throw new Error("DOMObserver not available");
        }
        const content = window.DOMObserver.readPageContent();
        log("📄 Page Content:", content);
        return { success: true, action: "read_content", ...content };
    }
};

console.log("✅ Tool Executor loaded");
