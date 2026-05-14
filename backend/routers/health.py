"""
VOXA Backend — Health Router
"""

from fastapi import APIRouter
try:
    from backend.services.llm_service import check_llm_health
except ImportError:
    from services.llm_service import check_llm_health

router = APIRouter()

from fastapi import APIRouter, Request

@router.get("/health")
async def health_check(request: Request):
    """
    Instant health check for Render/Load Balancers.
    Should always respond fast and never block.
    """
    is_ready = getattr(request.app.state, "ready", False)
    return {
        "status": "ok", 
        "ready": is_ready,
        "message": "VOXA Backend is alive" if is_ready else "VOXA Backend is initializing..."
    }

@router.get("/health/detailed")
async def detailed_health_check():
    """
    Check the health of the backend and its external services (Groq).
    """
    llm_health = check_llm_health()
    
    return {
        "status": "healthy",
        "version": "1.0.0",
        "services": {
            "llm": llm_health
        }
    }
