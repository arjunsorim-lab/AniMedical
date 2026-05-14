from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import Dict, Any
import logging
try:
    from backend.services.chat_service import get_chat_service
    from backend.dependencies import get_current_user
except ImportError:
    from services.chat_service import get_chat_service
    from dependencies import get_current_user

router = APIRouter()
logger = logging.getLogger("voxa.router.history")

class SyncRequest(BaseModel):
    conversations: Dict[str, Any]

@router.get("/history")
async def get_history(current_user: dict = Depends(get_current_user)):
    """
    Returns the conversation history for the current user.
    """
    chat_service = get_chat_service()
    history = chat_service.get_user_chats(current_user["id"])
    return {"conversations": history}

@router.post("/sync")
async def sync_history(request: SyncRequest, current_user: dict = Depends(get_current_user)):
    """
    Synchronizes conversation data from the frontend for the current user.
    """
    chat_service = get_chat_service()
    chat_service.sync_user_chats(current_user["id"], request.conversations)
    return {"status": "success", "synced_count": len(request.conversations)}
