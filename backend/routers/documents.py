from __future__ import annotations

from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from pathlib import Path
import logging

try:
    from backend.dependencies import get_current_user
    from backend.services.storage_service import get_storage_service
except ImportError:
    from dependencies import get_current_user
    from services.storage_service import get_storage_service

router = APIRouter()
logger = logging.getLogger("voxa.router.documents")

ALLOWED_EXT = {".txt", ".md", ".pdf", ".csv", ".json", ".doc", ".docx"}


@router.get("/")
async def list_documents(current_user: dict = Depends(get_current_user)):
    storage = get_storage_service()
    prefix = f"documents/{current_user['id']}/"
    docs = storage.list_prefix(prefix=prefix)
    response = []
    for d in docs:
        response.append({
            "filename": Path(d.key).name,
            "path": d.key,
            "url": d.url,
            "size": d.size,
            "updated_at": d.updated_at.isoformat() if d.updated_at else None,
        })
    return {"documents": response}


@router.post("/upload")
async def upload_document(file: UploadFile = File(...), current_user: dict = Depends(get_current_user)):
    ext = Path(file.filename or "").suffix.lower()
    if ext not in ALLOWED_EXT:
        raise HTTPException(status_code=400, detail=f"Unsupported file type: {ext}")

    key = f"documents/{current_user['id']}/{Path(file.filename).name}"
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Empty file.")

    storage = get_storage_service()
    stored = storage.save_bytes(key=key, data=content, content_type=file.content_type)
    return {
        "status": "success",
        "document": {
            "filename": Path(stored.key).name,
            "path": stored.key,
            "url": stored.url,
            "size": stored.size,
            "updated_at": stored.updated_at.isoformat() if stored.updated_at else None,
        }
    }

