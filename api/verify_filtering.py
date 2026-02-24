import requests
import json
import time

def test_ai_filtering():
    url = "http://localhost:8000/agent/filter-results"
    
    payload = {
        "goal": "Find official react documentation",
        "results": [
            {"title": "React - A JavaScript library for building user interfaces", "url": "https://react.dev/", "description": "The library for web and native user interfaces"},
            {"title": "W3Schools React Tutorial", "url": "https://www.w3schools.com/react/", "description": "React is a JavaScript library for building user interfaces."},
            {"title": "React JS - GeeksforGeeks", "url": "https://www.geeksforgeeks.org/reactjs-tutorials/", "description": "ReactJS Tutorial"},
            {"title": "Top 10 React Courses", "url": "https://udemy.com", "description": "Best courses."}
        ]
    }
    
    print(f"🚀 Sending request to {url}...")
    try:
        response = requests.post(url, json=payload)
        response.raise_for_status()
        data = response.json()
        
        print("\n✅ Response received:")
        print(json.dumps(data, indent=2))
        
        if data.get("status") == "success" and "selection" in data:
            print("\n🎉 Filtering Successful!")
            indices = data["selection"].get("selected_indices", [])
            print(f"Selected Indices: {indices}")
            # Expecting index 0 (official docs) to be selected
            if 0 in indices:
                print("✅ Correctly selected official docs.")
        else:
            print("\n❌ Filtering Failed: Invalid response format")
            
    except Exception as e:
        print(f"\n❌ Request failed: {e}")

if __name__ == "__main__":
    time.sleep(1)
    test_ai_filtering()
