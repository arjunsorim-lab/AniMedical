"""
VOXA Backend — Speech Router
Handles audio transcription requests.
"""

from fastapi import APIRouter, UploadFile, File, HTTPException
try:
    from backend.services.stt_service import transcribe_audio
except ImportError:
    from services.stt_service import transcribe_audio
import logging

router = APIRouter()
logger = logging.getLogger("voxa.router.speech")

@router.post("/speech-to-text")
async def speech_to_text(audio: UploadFile = File(...)):
    """
    Accepts an audio file and returns the transcription.
    """
    try:
        content = await audio.read()
        result = await transcribe_audio(content, audio.filename)
        return result
    except Exception as e:
        logger.error(f"Transcription error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
