
import sys
import os
import asyncio

# Add current directory to path
sys.path.append(os.getcwd())

async def test_dynamic_manifest(query):
    try:
        from manifest_gen import manifest_chain
        print(f"\n--- Testing Query: '{query}' ---")
        result = manifest_chain.invoke({"query": query})
        print(result.model_dump_json(indent=2))
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    queries = [
        "How has Python evolved over the years?",
        "How to prepare safe tea at home",
        "Mussoorie budget trip plan"
    ]
    for q in queries:
        asyncio.run(test_dynamic_manifest(q))
