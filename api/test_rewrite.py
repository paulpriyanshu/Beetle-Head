
import requests
import json

def test_rewrite(text, properties):
    url = "http://127.0.0.1:8000/text/rewrite"
    payload = { 
        "text": text,
        "properties": properties
    }
    headers = {"Content-Type": "application/json"}
    
    try:
        response = requests.post(url, json=payload, headers=headers)
        print(f"\n--- Testing Query: '{text}' ---")
        print(f"Properties: {properties}")
        if response.status_code == 200:
            print(json.dumps(response.json(), indent=2))
        else:
            print(f"Error: {response.status_code}")
            print(response.text)
    except Exception as e:
        print(f"Connection Error: {e}")

if __name__ == "__main__":
    test_rewrite(
        "i goes to market for buying some apple", 
        ["corrected", "professional", "concise", "explained"]
    )
    test_rewrite(
        "the project is delayed because of technical debt", 
        ["professional", "concise"]
    )
