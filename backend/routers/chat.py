"""
VOXA Backend — Chat Router
Handles regular chat requests and real-time token streaming via WebSockets.
"""

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, HTTPException
from pydantic import BaseModel
from typing import Optional, List
import json
import logging
try:
    from backend.services.contextual_chat_service import process_contextual_query, stream_contextual_query
except ImportError:
    from services.contextual_chat_service import process_contextual_query, stream_contextual_query

router = APIRouter()
logger = logging.getLogger("voxa.router.chat")

class ChatRequest(BaseModel):
    message: str
    conversation_id: str
    history: Optional[List[dict]] = None

class ChatResponse(BaseModel):
    response: str
    conversation_id: str
    refined_query: Optional[str] = None
    context_used: Optional[dict] = None
    was_rewritten: bool = False

try:
    from backend.dependencies import get_current_user
except ImportError:
    from dependencies import get_current_user
from fastapi import Depends

@router.post("/chat", response_model=ChatResponse)
async def chat_endpoint(request: ChatRequest, current_user: dict = Depends(get_current_user)):
    """
    Standard HTTP POST endpoint for chat (non-streaming).
    """
    try:
        result = await process_contextual_query(
            request.message,
            session_id=request.conversation_id,
            conversation_history=request.history,
        )
        return ChatResponse(
            response=result["response"],
            conversation_id=request.conversation_id,
            refined_query=result.get("refined_query"),
            context_used=result.get("context_used"),
            was_rewritten=result.get("was_rewritten", False),
        )
    except Exception as e:
        logger.error(f"Chat error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.websocket("/stream")
async def websocket_endpoint(websocket: WebSocket, token: str = None):
    """
    WebSocket endpoint for real-time token streaming.
    """
    await websocket.accept()
    
    try:
        # Validate user via token from query param
        try:
            current_user = await get_current_user(token=token)
        except Exception as e:
            await websocket.send_json({"error": "Unauthorized: " + str(e)})
            await websocket.close(code=4001)
            return

        # Initial message from client
        data = await websocket.receive_text()
        request_data = json.loads(data)
        
        message = request_data.get("message")
        conv_id = request_data.get("conversation_id")
        history = request_data.get("history", [])
        
        if not message:
            await websocket.send_json({"error": "No message provided"})
            await websocket.close()
            return

        # Stream tokens from the context-aware agent wrapper
        async for token in stream_contextual_query(message, conv_id, history):
            await websocket.send_json({"token": token})
        
        # Signal completion
        await websocket.send_json({"done": True})
        
    except WebSocketDisconnect:
        logger.info("WebSocket disconnected")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        try:
            await websocket.send_json({"error": str(e)})
        except:
            pass
    finally:
        try:
            await websocket.close()
        except:
            pass
