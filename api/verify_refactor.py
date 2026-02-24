import httpx
import time
import json

BASE_URL = "http://127.0.0.1:8000"

def run_verification():
    print("--- Starting Verification ---")
    
    try:
        with httpx.Client(base_url=BASE_URL, timeout=30.0) as client:
            # 1. Login/Signup to get Token
            print("\n1. Logging in...")
            user_data = {
                "name": "Test User",
                "email": "test@example.com",
                "userDp": "http://example.com/dp.png"
            }
            
            resp = client.post("/login", json=user_data)
            if resp.status_code != 200:
                print(f"Login failed: {resp.text}")
                return
            
            data = resp.json()
            token = data["access_token"]
            user_id = data["user"]["id"]
            print(f"Logged in. ID: {user_id}, Token: {token[:20]}...")

            headers = {"Authorization": f"Bearer {token}"}

            # 2. Create Conversation
            print("\n2. Creating Conversation...")
            resp = client.post("/conversations", headers=headers)
            if resp.status_code != 200:
                print(f"Create failed: {resp.text}")
                return
            
            conv_id = resp.json()["conversation_id"]
            print(f"Conversation Created: ID {conv_id}")

            # 3. Add Message
            print("\n3. Adding Message...")
            msg_data = {
                "user_query": "What is the capital of France?",
                "ai_response": "The capital of France is Paris."
            }
            resp = client.post(f"/conversations/{conv_id}/messages", headers=headers, json=msg_data)
            if resp.status_code != 200:
                print(f"Add Message failed: {resp.text}")
                return
            print("Message added.")

            # 4. Wait for Auto-Titling
            print("\n4. Waiting 5s for Auto-Titling...")
            time.sleep(5)

            # 5. Fetch Messages & Check Title
            print("\n5. Fetching Conversation...")
            resp = client.get(f"/conversations/{conv_id}/messages", headers=headers)
            if resp.status_code != 200:
                print(f"Fetch failed: {resp.text}")
                return
            
            data = resp.json()
            print("Fetch Result:")
            print(json.dumps(data, indent=2))

            # Assertions
            title = data["conversation"]["title"]
            msgs = data["messages"]
            
            print(f"\nTitle: {title}")
            if not title or title == "New Chat":
                print("WARNING: Title might not have been generated (or generated as default).")
            else:
                print("SUCCESS: Title generated.")
                
            if len(msgs) == 2:
                print("SUCCESS: Retrieved 2 messages (User + AI).")
            else:
                print(f"FAILURE: Expected 2 messages, got {len(msgs)}")

            if msgs[0]["role"] == "user" and msgs[1]["role"] == "assistant":
                print("SUCCESS: Correct roles.")
            else:
                print("FAILURE: Incorrect role order.")

    except ImportError:
        print("Error: httpx module not found. Please install it.")
    except Exception as e:
        print(f"An error occurred: {e}")

if __name__ == "__main__":
    run_verification()
