from langchain.tools import tool
from langchain_community.tools import DuckDuckGoSearchRun
from langchain_openai import ChatOpenAI
from langchain.agents import create_agent
from langchain.agents.middleware import wrap_model_call, ModelRequest,ModelResponse

from runnable import OPENAI_API_KEY

# LangChain built-in DuckDuckGo search
_ddg = DuckDuckGoSearchRun()

from duckduckgo_search import DDGS

@tool
def duckduckgo_search(query: str):
    """
    Search DuckDuckGo and return structured results
    """
    results = []
    with DDGS() as ddgs:
        for r in ddgs.text(query, max_results=8):
            results.append({
                "title": r.get("title"),
                "url": r.get("href"),
                "snippet": r.get("body")
            })

    return {
        "query": query,
        "results": results
    }

@tool
def extract_page_content():
    """
    Ask the browser extension to extract visible text from the page.
    """
    return {
        "type": "EXTRACT_PAGE"
    }


@tool
def dom_action(action: dict):
    """
    Perform a browser DOM action.

    Example:
    {
      "type": "CLICK",
      "selector": "#login"
    }
    """
    return action

from langchain.tools import tool
from langchain.agents import create_agent

model=ChatOpenAI(model="gpt-4o-mini",api_key=OPENAI_API_KEY,temperature=0.4)
@tool
def search(query: str) -> str:
    """Search for information."""
    return f"Results for: {query}"

@tool
def get_weather(location: str) -> str:
    """Get weather information for a location."""
    return f"Weather in {location}: Sunny, 72°F"

agent = create_agent(model, tools=[duckduckgo_search, get_weather],system_prompt="You are a weather assistant")

result = agent.invoke({"messages":[{"role":"user","content":"What is the price of iphone 13"}]})
# result = agent.invoke({"input":"What is the weather in delhi"})
from langchain_core.messages import HumanMessage, AIMessage, ToolMessage

def pretty_agent_trace(result):
    for i, msg in enumerate(result["messages"], 1):
        print(f"\n{'='*40}")
        print(f"STEP {i} → {msg.__class__.__name__}")
        print(f"{'='*40}")

        if isinstance(msg, HumanMessage):
            print("👤 User:")
            print(msg.content)

        elif isinstance(msg, AIMessage):
            if msg.tool_calls:
                print("🤖 AI decided to call tool:")
                for tc in msg.tool_calls:
                    print(f"  🔧 Tool name : {tc['name']}")
                    print(f"  📥 Arguments : {tc['args']}")
            else:
                print("🤖 AI Response:")
                print(msg.content)

        elif isinstance(msg, ToolMessage):
            print(f"🔧 Tool Output ({msg.name}):")
            print(msg.content)

# usage
pretty_agent_trace(result)
# print(result["messages"][-1].content)
# print(result)