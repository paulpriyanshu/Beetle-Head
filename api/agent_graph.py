from typing import TypedDict, List, Annotated
import operator
from langgraph.graph import StateGraph, END
from langchain_core.messages import BaseMessage, SystemMessage, HumanMessage
from langchain_openai import ChatOpenAI
from langchain_core.tools import tool
from pydantic import BaseModel, Field

# ======================================================
# STATE
# ======================================================

class AgentState(TypedDict):
    messages: Annotated[List[BaseMessage], operator.add]
    dom_state: dict
    goal: str
    current_url: str

# ======================================================
# TOOL SCHEMAS
# ======================================================

class SearchGoogle(BaseModel):
    query: str = Field(description="Search query to look up on Google.")

class SearchYoutube(BaseModel):
    query: str = Field(description="Search query to find videos on YouTube.")

class OpenUrlsInBackground(BaseModel):
    urls: List[str] = Field(description="2-4 URLs to open, read, and summarize before deciding where to go.")
    reason: str = Field(description="Why these URLs are relevant.")

class NavigateTo(BaseModel):
    url: str = Field(description="URL to navigate to in the active tab.")
    reason: str = Field(description="Why navigating here advances the goal.")

class ClickElement(BaseModel):
    selector: str = Field(description="CSS selector or ID of the element to click.")
    reason: str = Field(description="Why clicking this advances the goal.")

class TypeText(BaseModel):
    selector: str = Field(description="CSS selector or ID of the input field.")
    text: str = Field(description="Text to type.")
    reason: str = Field(description="Why typing this advances the goal.")

class Scroll(BaseModel):
    direction: str = Field(description="'up' or 'down'")
    amount: str = Field(description="e.g. '500px' or 'page'")

class ReadPageContent(BaseModel):
    reason: str = Field(description="Why you need to read this page.")

class Done(BaseModel):
    success: bool = Field(description="Whether the goal was achieved.")
    summary: str = Field(description="Markdown summary of everything researched, with URLs as links.")

# ======================================================
# TOOLS
# ======================================================

@tool("search_google", args_schema=SearchGoogle)
def search_google_tool(query: str):
    """Navigate to Google and search for a query. Use this to start web research."""
    return "search_google"

@tool("search_youtube", args_schema=SearchYoutube)
def search_youtube_tool(query: str):
    """Search YouTube for videos related to the query. Opens YouTube search results."""
    return "search_youtube"

@tool("open_urls_in_background", args_schema=OpenUrlsInBackground)
def open_urls_in_background_tool(urls: List[str], reason: str):
    """Open 2-4 URLs in background tabs, read their content, return summaries. Use after seeing search results."""
    return "open_urls_in_background"

@tool("navigate_to", args_schema=NavigateTo)
def navigate_to_tool(url: str, reason: str):
    """Navigate the active tab to a URL."""
    return "navigate_to"

@tool("click_element", args_schema=ClickElement)
def click_element_tool(selector: str, reason: str):
    """Click an element. Only use when clearly needed."""
    return "click_element"

@tool("type_text", args_schema=TypeText)
def type_text_tool(selector: str, text: str, reason: str):
    """Type into an input field."""
    return "type_text"

@tool("scroll", args_schema=Scroll)
def scroll_tool(direction: str, amount: str):
    """Scroll only if content is cut off."""
    return "scroll"

@tool("read_page_content", args_schema=ReadPageContent)
def read_page_content_tool(reason: str):
    """Read the visible text of the current page."""
    return "read_page_content"

@tool("done", args_schema=Done)
def done_tool(success: bool, summary: str):
    """
    Call when the goal is satisfied.
    Write a Markdown summary that includes:
    - What you found
    - All pages visited as clickable links [Title](URL)
    - YouTube results if any
    """
    return "done"

tools = [
    search_google_tool,
    search_youtube_tool,
    open_urls_in_background_tool,
    navigate_to_tool,
    read_page_content_tool,
    click_element_tool,
    type_text_tool,
    scroll_tool,
    done_tool,
]

# ======================================================
# LLM
# ======================================================

llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)
llm_with_tools = llm.bind_tools(tools, tool_choice="any")

# ======================================================
# PROMPTS
# ======================================================

SYSTEM_PROMPT = """You are a browser automation agent. Goal: "{goal}"

CURRENT PAGE:
{dom_state}

## Guidelines:
- You are here to DIRECTLY perform tasks on the browser.
- Use `click_element`, `type_text`, and `scroll` to interact with the current page.
- Preferred way to select elements is via the provided `selector` (e.g., `[data-ai-id="..."]`).
- If the current page doesn't help with the goal, use `search_google` or `navigate_to`.
- You can use tools multiple times as needed to achieve the goal.
- Be precise and efficient. Avoid unnecessary steps.

## Workflow:
1. Examine the `dom_state` for interactive elements that can advance the goal.
2. If an interaction is obvious, call the appropriate tool (`click_element`, `type_text`).
3. If more information is needed from the web, use `search_google` or `open_urls_in_background`.
4. Once the goal is satisfied (content found, action completed), call `done` with a markdown summary.

## Rules:
- Never repeat exactly the same failed action.
- If you seem stuck on a page, try scrolling or navigating elsewhere.
- Always provide a concise reason for each action.
"""

STEP_PROMPT = """Goal: "{goal}"

Current page state:
{dom_state}

What is the single best NEXT action to move closer to the goal?"""

# ======================================================
# AGENT NODE
# ======================================================

def agent_node(state: AgentState):
    history = state["messages"]
    dom_state = state["dom_state"]
    goal = state["goal"]

    # Always: [rules + context] → [what happened] → [current page + decision request]
    # This ensures the LLM sees its rules AND its action history on every step.
    system_msg = SystemMessage(content=SYSTEM_PROMPT.format(goal=goal, dom_state=dom_state))
    step_msg = HumanMessage(content=STEP_PROMPT.format(goal=goal, dom_state=dom_state))

    final_messages = [system_msg] + list(history) + [step_msg]

    response = llm_with_tools.invoke(final_messages)
    return {"messages": [response]}

# ======================================================
# GRAPH
# ======================================================

graph = StateGraph(AgentState)
graph.add_node("agent", agent_node)
graph.set_entry_point("agent")
graph.add_edge("agent", END)

agent_runnable = graph.compile()
