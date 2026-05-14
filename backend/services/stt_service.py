import io
import logging
from pathlib import Path
try:
    from backend.config import GROQ_API_KEY
except ImportError:
    from config import GROQ_API_KEY

logger = logging.getLogger("voxa.stt")

# Lazy-loaded client
_client = None

def _get_client():
    global _client
    if _client is None:
        from groq import Groq
        _client = Groq(api_key=GROQ_API_KEY)
    return _client

def init_stt_service(model_size: str = "ignored"):
    """
    Initialize the STT service. (Minimal for Groq API)
    """
    logger.info("🎙️ VOXA STT initialized (using Groq Whisper API)")

async def transcribe_audio(audio_bytes: bytes, filename: str = "recording.webm") -> dict:
    """
    Transcribe audio using Groq's Whisper-Large-V3 API.
    Works perfectly for both local and Render.
    """
    client = _get_client()
    
    try:
        # Groq expects a file-like object with a name
        # We use a BytesIO buffer to avoid writing to disk
        audio_file = (filename, audio_bytes)
        
        logger.info(f"Sending {len(audio_bytes)} bytes to Groq for transcription...")
        
        transcription = client.audio.transcriptions.create(
            file=audio_file,
            model="whisper-large-v3",
            prompt="Healthcare operations query: patients, doctors, caregivers, services, billing, vitals, appointments, operations, revenue, alerts.",
            response_format="json",
            language="en",
            temperature=0.0
        )
        
        text = transcription.text.strip()
        
        if not text:
            return {"text": "", "confidence": 0.0, "language": "en"}

        logger.info(f"Groq Transcribed: '{text[:80]}...'")
        return {
            "text": text,
            "confidence": 1.0, # Groq doesn't provide per-segment confidence in basic JSON
            "language": "en",
        }

    except Exception as e:
        logger.error(f"Groq Transcription failed: {e}")
        # Return empty rather than crashing the chat flow
        return {"text": f"[Error: {str(e)}]", "confidence": 0.0, "language": "en"}
