from langchain_openai import ChatOpenAI
from langchain_core.output_parsers import JsonOutputParser
from navigator_prompt import navigator_prompt
import os

llm = ChatOpenAI(
    model="gpt-4o-mini",
    temperature=0,
    api_key=os.getenv("OPENAI_API_KEY")
)

navigator_chain = navigator_prompt | llm | JsonOutputParser()