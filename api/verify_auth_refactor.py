import sys
import os
import asyncio

# Add current dir to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

async def verify_backend():
    print("Verifying backend auth changes...")
    try:
        from main import app, LoginRequest, user_login, create_access_token
        from sync_schemas import get_current_user, SECRET_KEY, ALGORITHM
        print("✅ Backend imports successful (No circular dependencies).")
        
        # Test token creation
        token = create_access_token({"sub": "test@example.com"})
        print(f"✅ Token creation successful: {token[:20]}...")
        
        # Test basic request schema
        req = LoginRequest(googleToken="mock-token")
        print(f"✅ LoginRequest schema valid.")
        
        print("\nBackend verification PASSED.")
    except Exception as e:
        print(f"\n❌ Backend verification FAILED: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(verify_backend())
