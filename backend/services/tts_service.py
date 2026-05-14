"""
VOXA Backend — TTS Service (Layer 11: Text-to-Speech)
Uses edge-tts (Microsoft Edge TTS) for high-quality, free English speech synthesis.
"""

import logging
import tempfile
import os

logger = logging.getLogger("voxa.tts")


async def synthesize_speech(text: str, voice: str = "en-US-GuyNeural") -> bytes | None:
    """
    Convert text to speech using edge-tts.

    Args:
        text: Text to synthesize
        voice: Voice ID (default: en-US-GuyNeural — professional male voice)
              Other options: en-US-JennyNeural, en-GB-RyanNeural

    Returns:
        Audio bytes (MP3 format) or None on failure
    """
    try:
        import edge_tts

        # Limit text length to avoid huge audio files
        if len(text) > 2000:
            text = text[:2000] + "... Please refer to the text response for complete details."

        # Strip markdown formatting for cleaner speech
        clean_text = _strip_markdown(text)

        if not clean_text.strip():
            return None

        communicate = edge_tts.Communicate(clean_text, voice)

        # Write to temp file and read back
        tmp_path = None
        try:
            with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as tmp:
                tmp_path = tmp.name

            await communicate.save(tmp_path)

            with open(tmp_path, "rb") as f:
                audio_bytes = f.read()

            logger.info(f"TTS generated: {len(audio_bytes)} bytes")
            return audio_bytes

        finally:
            if tmp_path and os.path.exists(tmp_path):
                os.unlink(tmp_path)

    except Exception as e:
        logger.error(f"TTS synthesis failed: {e}")
        return None


def _strip_markdown(text: str) -> str:
    """Remove markdown formatting for cleaner speech synthesis."""
    import re

    # Remove table formatting
    text = re.sub(r'\|[^\n]*\|', '', text)
    text = re.sub(r'[-|]+\s*\n', '', text)

    # Remove markdown syntax
    text = re.sub(r'#{1,6}\s+', '', text)       # Headers
    text = re.sub(r'\*\*([^*]+)\*\*', r'\1', text)  # Bold
    text = re.sub(r'\*([^*]+)\*', r'\1', text)      # Italic
    text = re.sub(r'`[^`]+`', '', text)              # Inline code
    text = re.sub(r'```[\s\S]*?```', '', text)       # Code blocks
    text = re.sub(r'^\s*[-*+]\s+', '', text, flags=re.MULTILINE)  # List items
    text = re.sub(r'^\s*\d+\.\s+', '', text, flags=re.MULTILINE)  # Numbered lists
    text = re.sub(r'\[([^\]]+)\]\([^)]+\)', r'\1', text)  # Links

    # Clean up extra whitespace
    text = re.sub(r'\n{3,}', '\n\n', text)
    text = re.sub(r'  +', ' ', text)

    return text.strip()
