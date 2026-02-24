# html_parser.py
from bs4 import BeautifulSoup, NavigableString
import re

REMOVE_TAGS = {
    "script", "style", "noscript",
    "svg", "canvas", "iframe",
    "nav", "footer", "header", "aside"
}

BLOCK_TAGS = {
    "p", "div", "section", "article", "main",
    "li", "ul", "ol",
    "table", "tr", "td", "th",
    "form", "label",
    "h1", "h2", "h3", "h4"
}

def extract_readable_page(html: str) -> dict:
    soup = BeautifulSoup(html, "html.parser")

    # -------------------------
    # HEAD (small & useful)
    # -------------------------
    def meta(name=None, prop=None):
        if name:
            tag = soup.find("meta", attrs={"name": name})
        else:
            tag = soup.find("meta", property=prop)
        return tag["content"].strip() if tag and tag.get("content") else None

    head = {
        "title": soup.title.string.strip() if soup.title else None,
        "description": meta(name="description") or meta(prop="og:description"),
        "og_title": meta(prop="og:title"),
        "canonical": (
            soup.find("link", rel="canonical")["href"]
            if soup.find("link", rel="canonical")
            else None
        ),
    }

    # -------------------------
    # BODY CLEANUP
    # -------------------------
    for tag in soup.find_all(REMOVE_TAGS):
        tag.decompose()

    main = (
        soup.find("main")
        or soup.find("article")
        or soup.find(attrs={"role": "main"})
        or soup.body
    )

    if not main:
        return {
            "head": head, 
            "content": "",
            "word_count": 0,
            "char_count": 0
        }

    blocks = []

    for el in main.descendants:
        # text blocks
        if el.name in BLOCK_TAGS:
            text = " ".join(el.stripped_strings)
            if len(text) > 40:
                blocks.append(text)

        # form hints (important for agents)
        if el.name == "input":
            label = None
            if el.get("id"):
                l = soup.find("label", attrs={"for": el["id"]})
                label = l.get_text(strip=True) if l else None

            hint = label or el.get("placeholder")
            if hint:
                blocks.append(f"[Input] {hint}")

        if el.name == "textarea" and el.get("placeholder"):
            blocks.append(f"[Textarea] {el['placeholder']}")

    # Deduplicate & clean
    content = "\n\n".join(dict.fromkeys(blocks))
    content = re.sub(r"\n{3,}", "\n\n", content)

    return {
        "head": head,
        "content": content.strip(),
        "word_count": len(content.split()),
        "char_count": len(content)
    }