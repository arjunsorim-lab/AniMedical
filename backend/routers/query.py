"""
VOXA Backend — Query Router
Handles direct data query requests.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
try:
    from backend.agents.automotive_agent import process_query
except ImportError:
    from agents.automotive_agent import process_query
import logging

router = APIRouter()
logger = logging.getLogger("voxa.router.query")

class QueryRequest(BaseModel):
    message: str
    query: str
    conversation_id: str

@router.post("/query")
async def execute_query_endpoint(request: QueryRequest):
    """
    Handles direct data queries.
    """
    try:
        # For now, we route this through the agent as it knows how to handle data questions
        response_text = await process_query(request.query)
        return {"response": response_text, "conversation_id": request.conversation_id}
    except Exception as e:
        logger.error(f"Query error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
