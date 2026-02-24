import json
from langchain_text_splitters import RecursiveCharacterTextSplitter

def extract_clean_text_from_dom(dom_node, depth=0, max_depth=50):
    """
    Recursively extracts clean text from a DOM tree structure.
    Compatible with the Universal Extractor from sidebar.js.
    """
    if not dom_node or depth > max_depth:
        return ""

    # 1. Handle Text Nodes (Universal Extractor format)
    if dom_node.get("type") == "text":
        return dom_node.get("content", "").strip()

    # 2. Handle Strings (Legacy/Fallback)
    if isinstance(dom_node, str):
        return dom_node.strip()

    tag = dom_node.get("tag", "").upper()
    
    # Skip noise tags (Double check, though frontend filters most)
    SKIP_TAGS = {"SCRIPT", "STYLE", "NOSCRIPT", "IFRAME", "SVG", "NAV", "FOOTER", "HEADER", "ASIDE", "BUTTON", "INPUT", "FORM", "AD", "INS"}
    if tag in SKIP_TAGS:
        return ""

    text_parts = []
    
    # 3. Recurse children
    children = dom_node.get("children", [])
    child_texts = []
    
    for child in children:
        text = extract_clean_text_from_dom(child, depth + 1, max_depth)
        if text:
            child_texts.append(text)

    # 4. Formatting based on Tag
    full_text = " ".join(child_texts)
    
    if not full_text:
        return ""

    if tag in ["H1", "H2", "H3"]:
        return f"\n\n# {full_text}\n"
    elif tag in ["H4", "H5", "H6"]:
        return f"\n## {full_text}\n"
    elif tag == "LI":
        return f"- {full_text}"
    elif tag in ["P", "DIV", "SECTION", "ARTICLE"]:
        return f"{full_text}\n"
    elif tag == "CODE":
        return f"`{full_text}`"
    elif tag == "TR":
        return f"| {full_text} |"
    elif tag in ["TD", "TH"]:
        return getattr(dom_node, "text", full_text) # Simple cell join
        
    return full_text


def limit_context(text: str, chunk_size: int = 4000, overlap: int = 200, max_chunks: int = 3) -> str:
    """
    Splits text into chunks and returns the first N chunks to fit context window.
    Using RecursiveCharacterTextSplitter for intelligent splitting.
    """
    if not text:
        return ""
        
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=overlap,
        separators=["\n\n", "\n", " ", ""]
    )
    
    chunks = splitter.split_text(text)
    
    # Return limited chunks joined
    selected_chunks = chunks[:max_chunks]
    
    # Add an indicator if truncated
    result = "\n\n".join(selected_chunks)
    if len(chunks) > max_chunks:
        result += "\n\n...[Content Truncated]..."
        
    return result
