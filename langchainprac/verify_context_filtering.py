import sys
import os
import json

# Add current directory to path so we can import main
sys.path.append(os.getcwd())

from main import parse_html

def test_filtering():
    print("🚀 Starting Context Filtering Test...")

    # Mock DOM Tree (Universal Extractor Format)
    mock_dom = {
        "tag": "BODY",
        "children": [
            {
                "tag": "NAV", # Should be skipped by backend if in SKIP_TAGS or if frontend sent it
                "children": [{"type": "text", "content": "Home"}, {"type": "text", "content": "About"}]
            },
            {
                "tag": "MAIN",
                "children": [
                    {
                        "tag": "H1",
                        "children": [{"type": "text", "content": "The Future of AI"}]
                    },
                    {
                        "tag": "DIV",
                        "attrs": {"class": "author"},
                        "children": [{"type": "text", "content": "By John Doe"}]
                    },
                    {
                        "tag": "P",
                        "children": [{"type": "text", "content": "Artificial Intelligence is transforming the world. " * 50}]
                    },
                    {
                        "tag": "SECTION",
                        "children": [
                            {
                                "tag": "H2", 
                                "children": [{"type": "text", "content": "Key Benefits"}]
                            },
                            {
                                "tag": "UL",
                                "children": [
                                    {"tag": "LI", "children": [{"type": "text", "content": "Automation"}]},
                                    {"tag": "LI", "children": [{"type": "text", "content": "Efficiency"}]},
                                    {"tag": "LI", "children": [{"type": "text", "content": "Innovation"}]}
                                ]
                            }
                        ]
                    },
                    {
                        "tag": "FOOTER", 
                        "children": [{"type": "text", "content": "Copyright 2024"}]
                    }
                ]
            }
        ]
    }

    # Mock State
    state = {
        "needs_context": True,
        "raw_html": {
            "title": "Test Page",
            "domTree": mock_dom,
            "url": "http://test.com"
        }
    }

    print("running parse_html...")
    result = parse_html(state)
    
    page_context = result.get("page_context", {})
    content = page_context.get("content", "")
    
    print("-" * 50)
    print("EXTRACTED CONTENT:")
    print("-" * 50)
    print(content)
    print("-" * 50)
    
    # Assertions
    if "# The Future of AI" in content:
        print("✅ H1 extracted correctly")
    else:
        print("❌ H1 missing")
        
    if "transforming the world" in content:
        print("✅ Paragraph extracted")
    else:
        print("❌ Paragraph missing")
        
    if "Home" not in content and "About" not in content:
        print("✅ Navigation skipped")
    else:
        print("❌ Navigation Leaked")
        
    if "Copyright 2024" not in content:
        print("✅ Footer skipped")
    else:
        print("❌ Footer Leaked")

    # Length check (we repeated the paragraph so it should be visible but truncated if huge, 
    # but here it's small enough to fit in one chunk)
    print(f"Content Length: {len(content)} chars")

if __name__ == "__main__":
    test_filtering()
