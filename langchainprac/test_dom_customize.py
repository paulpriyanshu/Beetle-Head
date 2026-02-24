import requests
import json

def test_dom_customize():
    url = "http://127.0.0.1:8000/dom/customize"
    
    # Sample DOM structure with selectors (new format)
    elements = [
        {
            "selector": "body",
            "tag": "body",
            "attrs": {"id": "", "class": "main-container"},
            "style": {
                "backgroundColor": "rgb(255, 255, 255)",
                "color": "rgb(0, 0, 0)",
                "fontSize": "16px"
            },
            "depth": 0,
            "visible": True
        },
        {
            "selector": "#header",
            "tag": "header",
            "text": "Welcome to My Site",
            "attrs": {"id": "header", "class": "site-header"},
            "style": {
                "backgroundColor": "rgb(240, 240, 240)",
                "color": "rgb(51, 51, 51)",
                "padding": "20px",
                "fontSize": "14px"
            },
            "depth": 1,
            "visible": True
        },
        {
            "selector": "button.primary",
            "tag": "button",
            "text": "Click Me",
            "attrs": {"id": "", "class": "primary btn-main"},
            "style": {
                "backgroundColor": "rgb(200, 200, 200)",
                "color": "rgb(0, 0, 0)",
                "padding": "10px 20px",
                "fontSize": "16px"
            },
            "depth": 2,
            "visible": True
        },
        {
            "selector": "h1:nth-of-type(1)",
            "tag": "h1",
            "text": "Main Heading",
            "attrs": {},
            "style": {
                "color": "rgb(0, 0, 0)",
                "fontSize": "32px",
                "fontWeight": "bold"
            },
            "depth": 2,
            "visible": True
        }
    ]
    
    payload = {
        "elements": elements,
        "requirements": "Make the header blue with white text, change button to green, and make all headings have a dark blue color"
    }
    
    headers = {"Content-Type": "application/json"}
    
    try:
        print("🧪 Testing /dom/customize endpoint...")
        print(f"📤 Sending {len(elements)} elements")
        print(f"📝 Requirements: {payload['requirements']}")
        print()
        
        response = requests.post(url, json=payload, headers=headers)
        
        if response.status_code == 200:
            result = response.json()
            print("✅ API Response received")
            print()
            
            if result.get("success"):
                modifications = result.get("modifications", [])
                print(f"🎨 Generated {len(modifications)} modifications:")
                print()
                
                for idx, mod in enumerate(modifications, 1):
                    print(f"  Modification {idx}:")
                    print(f"    Selector: {mod.get('selector')}")
                    print(f"    Changes: {json.dumps(mod.get('changes', {}), indent=6)}")
                    print()
                
                print("✅ TEST PASSED - Received selector-based modifications")
            else:
                print(f"❌ TEST FAILED - API returned error: {result.get('error')}")
        else:
            print(f"❌ HTTP Error: {response.status_code}")
            print(response.text)
            
    except Exception as e:
        print(f"❌ TEST FAILED - Connection Error: {e}")

if __name__ == "__main__":
    test_dom_customize()
