from dotenv import load_dotenv
import os
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from manifest_schema import Manifest

load_dotenv()
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

manifest_prompt = ChatPromptTemplate.from_template("""
You are an expert browser automation architect. Your goal is to create a CUSTOMized, dynamic execution manifest for a browser agent.
The agent can perform web searching, page validation, content extraction, direct navigation, and YouTube analysis.

### RULES FOR DYNAMIC PLANNING:
1.  **Optimize Queries**: Do NOT use the raw user prompt for searches. Generate specific, high-intent search queries for Google and YouTube.
2.  **Autonomous Pathing**: Decide the best sequence of actions. 
    - For academic/factual info, prioritize Wikipedia (NAVIGATE_TO) and blogs (SCRAPE_SEARCH_RESULTS).
    - For visual/how-to info, prioritize YouTube (OPEN_YOUTUBE_TAB).
    - For recent news or variety, use a mix.
3.  **Direct Navigation**: If a specific authoritative source is obvious (e.g., Wikipedia for a historical figure), use `NAVIGATE_TO` with the direct URL.
4.  **Logical Dependencies**: Ensure steps that need preceding data (like `AI_VALIDATE_RESULTS` needing `SCRAPE_SEARCH_RESULTS`) have correct dependencies.

### AVAILABLE STEP TYPES:
- SCRAPE_SEARCH_RESULTS: Searches Google (uses `searchQuery` in config).
- AI_VALIDATE_RESULTS: Filters results based on criteria.
- OPEN_VALIDATED_URLS: Opens tabs for filtered URLs.
- ANALYZE_PAGE: Extracts content from open tabs.
- OPEN_YOUTUBE_TAB: Searches YouTube (uses `searchQuery` or `youtubeQuery` in config).
- SCRAPE_YOUTUBE_RESULTS: Extracts video info.
- NAVIGATE_TO: Goes directly to a URL (uses `url` in config).

CRITICAL RULE:
ALWAYS include an `ANALYZE_PAGE` step after `OPEN_VALIDATED_URLS` or `NAVIGATE_TO` to allow the AI to inspect the page and perform deep actions.

User Goal: {query}

Generate a logical, efficient manifest. Return ONLY the JSON.
""")

llm = ChatOpenAI(
    model="gpt-4o-mini",
    temperature=0,
    api_key=os.getenv("OPENAI_API_KEY")
)

# Enforce structured output matching the Pydantic schema
# Enforce structured output matching the Pydantic schema
manifest_chain = manifest_prompt | llm.with_structured_output(Manifest)

# ==========================================
# STREAMING CHAIN (Raw JSON)
# ==========================================
# For streaming, we want raw tokens of the JSON, not the parsed object.
# We inject the schema manually into the prompt.

manifest_stream_prompt = ChatPromptTemplate.from_template("""
You are an expert browser automation architect. 
Create a DYNAMIC execution manifest for a browser agent.

### STRATEGIC PLANNING:
- **Refine Search**: Convert user prompt into OPTIMIZED search queries.
- **Select Sources**: Choose Wikipedia, YouTube, or general blogs dynamically based on the goal.
- **Flow**: Build a logical dependency graph.
- **Direct Control**: Use `NAVIGATE_TO` for specific known URLs.
- **Deep Check**: MANDATORY: Always follow `OPEN_VALIDATED_URLS` or `NAVIGATE_TO` with `ANALYZE_PAGE`. This triggers the AI deep validation loop.

Output the result as a VALID JSON object matching this structure:
{{
  "manifestId": "kebab-case-id",
  "query": "original-query",
  "enableAIValidation": true,
  "steps": [
    {{
      "id": "step_id",
      "type": "SCRAPE_SEARCH_RESULTS" | "AI_VALIDATE_RESULTS" | "OPEN_VALIDATED_URLS" | "ANALYZE_PAGE" | "OPEN_YOUTUBE_TAB" | "SCRAPE_YOUTUBE_RESULTS" | "NAVIGATE_TO",
      "dependencies": ["dep_id"],
      "parallel": boolean,
      "config": {{
        "searchQuery": "optimized search string",
        "url": "direct url for navigate_to",
        ... other configs (batchSize, maxTabs, keywords etc)
      }}
    }}
  ]
}}

User Query: {query}

RETURN ONLY THE JSON. NO MARKDOWN.
""")

manifest_stream_chain = manifest_stream_prompt | llm

