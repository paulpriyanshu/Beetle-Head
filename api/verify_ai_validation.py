import requests
import json
import time

def test_ai_validation():
    url = "http://localhost:8000/agent/validate"
    
    payload = {
        "goal": "Search for latest AI news",
        "context": "Start Page. Search Input field available with id='search'. Button with class='search-btn'.",
        "url": "https://www.google.com",
        "title": "Google"
    }
    
    print(f"🚀 Sending request to {url}...")
    try:
        response = requests.post(url, json=payload)
        response.raise_for_status()
        data = response.json()
        
        print("\n✅ Response received:")
        print(json.dumps(data, indent=2))
        
        if data.get("status") == "success" and "micro_manifest" in data:
            print("\n🎉 Validation Successful! Micro-manifest generated.")
            actions = data["micro_manifest"].get("actions", [])
            print(f"Found {len(actions)} actions.")
        else:
            print("\n❌ Validation Failed: Invalid response format")
            
    except Exception as e:
        print(f"\n❌ Request failed: {e}")

if __name__ == "__main__":
    # Wait a bit for server reload if needed
    time.sleep(2)
    test_ai_validation()
