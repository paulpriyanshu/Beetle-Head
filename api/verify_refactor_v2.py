import urllib.request
import json
import time
import urllib.error

BASE_URL = "http://127.0.0.1:8000"

def post(endpoint, data=None, headers=None):
    if headers is None: headers = {}
    url = f"{BASE_URL}{endpoint}"
    req = urllib.request.Request(url, method="POST", headers=headers)
    if data:
        req.data = json.dumps(data).encode("utf-8")
        req.add_header("Content-Type", "application/json")
    
    try:
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        print(f"HTTPError: {e.code} {e.reason}")
        print(e.read().decode("utf-8"))
        raise

def get(endpoint, headers=None):
    if headers is None: headers = {}
    url = f"{BASE_URL}{endpoint}"
    req = urllib.request.Request(url, method="GET", headers=headers)
    try:
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        print(f"HTTPError: {e.code} {e.reason}")
        print(e.read().decode("utf-8"))
        raise

def run():
    print("--- Starting Verification (urllib) ---")
    
    # 1. Login
    print("\n1. Logging in...")
    user_data = {"name": "Test User", "email": "test@example.com", "userDp": "http://example.com/dp.png"}
    try:
        data = post("/login", user_data)
        token = data["access_token"]
        print(f"Logged in. Token: {token[:10]}...")
    except Exception as e:
        print(f"Login failed: {e}")
        return

    headers = {"Authorization": f"Bearer {token}"}

    # 2. Create
    print("\n2. Create Conversation...")
    try:
        data = post("/conversations", headers=headers)
        conv_id = data["conversation_id"]
        print(f"ID: {conv_id}")
    except Exception as e:
        print(f"Create conversation failed: {e}")
        return

    # 3. Add Message
    print("\n3. Add Message...")
    msg = {"user_query": "What is the capital of France?", "ai_response": "Paris"}
    try:
        post(f"/conversations/{conv_id}/messages", msg, headers)
        print("Message added.")
    except Exception as e:
        print(f"Add Msg failed: {e}")
        return

    # 4. Wait
    print("\n4. Waiting 5s for Auto-Titling...")
    time.sleep(5)

    # 5. Get
    print("\n5. Fetch...")
    try:
        data = get(f"/conversations/{conv_id}/messages", headers)
        print(json.dumps(data, indent=2))
        
        # Check
        title = data["conversation"]["title"]
        print(f"Title: {title}")
        
        if title and title != "New Chat":
            print("SUCCESS: Title Generated")
        else:
            print("WARNING: Title default/missing (might be slow or failed)")
            
        if len(data["messages"]) == 2:
            print("SUCCESS: 2 Messages found")
            if data["messages"][0]["role"] == "user" and data["messages"][1]["role"] == "assistant":
                 print("SUCCESS: Roles are correct")
        else:
            print(f"FAILURE: Expected 2 messages, got {len(data['messages'])}")
            
    except Exception as e:
        print(f"Fetch failed: {e}")

if __name__ == "__main__":
    run()
