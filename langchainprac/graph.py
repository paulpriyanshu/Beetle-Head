# # graph.py - CORRECTED
# from typing import TypedDict, List, Optional
# from langgraph.graph import StateGraph, END

# class AgentState(TypedDict):
#     prompt: str
#     context: Optional[dict]
#     route: Optional[str]
#     explanation: Optional[str]
#     actions: Optional[list]
#     rich_blocks: Optional[dict]

# def route_agent(state: AgentState):
#     """Decides what to do next."""
#     q = state["prompt"].lower()
    
#     if any(k in q for k in ["click", "open", "search", "buy", "go to"]):
#         return {"route": "dom"}
    
#     return {"route": "general"}

# def general_agent(state: AgentState):
#     """Returns full explanation (streaming handled at API level)"""
#     from runnable import explain_chain
    
#     full_response = ""
#     for msg in explain_chain.stream({"question": state["prompt"]}):
#         if msg.content:
#             full_response += msg.content
    
#     return {"explanation": full_response}

# def dom_agent(state: AgentState):
#     """Returns DOM actions"""
#     from runnable import agent_chain
    
#     try:
#         result = agent_chain.invoke({
#             "question": state["prompt"],
#             "primary_intent": "action"
#         })
#         return {"actions": result.get("actions", [])}
#     except Exception as e:
#         print(f"DOM agent error: {e}")
#         return {"actions": []}

# def build_graph():
#     graph = StateGraph(AgentState)
    
#     graph.add_node("router", route_agent)
#     graph.add_node("general", general_agent)
#     graph.add_node("dom", dom_agent)
    
#     graph.set_entry_point("router")
    
#     graph.add_conditional_edges(
#         "router",
#         lambda s: s["route"],
#         {
#             "general": "general",
#             "dom": "dom"
#         }
#     )
    
#     graph.add_edge("general", END)
#     graph.add_edge("dom", END)
    
#     return graph.compile()