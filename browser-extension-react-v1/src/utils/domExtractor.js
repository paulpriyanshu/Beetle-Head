export function extractDOMTree() {
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
