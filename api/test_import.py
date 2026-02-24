
import sys
import os

# Add current directory to path
sys.path.append(os.getcwd())

try:
    from manifest_gen import manifest_chain
    print("Successfully imported manifest_chain")
    
    # Optional: Try a dry run if you want, but import is usually enough to catch syntax/import errors
    # result = manifest_chain.invoke({"query": "test"})
    # print(result)
except Exception as e:
    print(f"Error importing: {e}")
    import traceback
    traceback.print_exc()
