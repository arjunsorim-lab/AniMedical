"""
VOXA Backend — Main Entry Point
Initializes FastAPI app, mounts routers, and manages service startup.
"""

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import asyncio
import logging
import sys
import os
from pathlib import Path

# ── Dynamic Path Shim for Local/Render Compatibility ──
# This allows 'from backend...' imports to work whether run from the root or the backend folder.
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
PARENT_DIR = os.path.dirname(CURRENT_DIR)
if PARENT_DIR not in sys.path:
    sys.path.append(PARENT_DIR)
if CURRENT_DIR not in sys.path:
    sys.path.append(CURRENT_DIR)

try:
    from backend.config import HOST, PORT, CORS_ORIGINS, DATA_DIR
    from backend.services.data_service import init_data_service
    from backend.services.stt_service import init_stt_service
    from backend.routers import health, speech, chat, query, history, auth, documents
except ImportError:
    from config import HOST, PORT, CORS_ORIGINS, DATA_DIR
    from services.data_service import init_data_service
    from services.stt_service import init_stt_service
    from routers import health, speech, chat, query, history, auth, documents

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger("voxa.main")

# ── Service Initialization ──

async def run_background_initialization():
    """
    Handles heavy data loading and service setup without blocking the main event loop.
    """
    logger.info("🚀 Background Initialization started...")
    
    # 1. Initialize Data Service (DuckDB + Excel)
    try:
        init_data_service(DATA_DIR)
        logger.info("✅ Data service initialized")
    except Exception as e:
        logger.error(f"❌ Failed to initialize data service: {e}")
    
    # 2. Initialize STT Service (Unified Groq API)
    try:
        init_stt_service()
        logger.info("✅ STT service initialized (Groq API mode)")
    except Exception as e:
        logger.error(f"❌ Failed to initialize STT service: {e}")
    
    app.state.ready = True
    logger.info("🌟 VOXA Backend is FULLY READY and data is loaded.")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("VOXA Backend starting... (Initialization moved to background)")
    app.state.ready = False
    asyncio.create_task(run_background_initialization())
    yield
    # Shutdown (cleanup if needed)
    logger.info("VOXA Backend shutting down...")

app = FastAPI(
    title="VOXA — Voice-Enabled AI Automotive Assistant",
    description="Backend API for VOXA, serving automotive plant data insights via voice/text.",
    version="1.0.0",
    lifespan=lifespan,
)

# ── Middleware ──
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from fastapi.staticfiles import StaticFiles

# Create uploads directory if it doesn't exist
uploads_dir = DATA_DIR / "uploads"
uploads_dir.mkdir(parents=True, exist_ok=True)

# ── Router Mounting ──
# Prefix all routes with /api as expected by the frontend
app.include_router(health.router, prefix="/api", tags=["Health"])
# Also include health router without prefix for load balancer compatibility
app.include_router(health.router, tags=["Health - No Prefix"])
app.include_router(speech.router, prefix="/api", tags=["Speech"])
app.include_router(chat.router, prefix="/api", tags=["Chat"])
app.include_router(query.router, prefix="/api", tags=["Query"])
app.include_router(history.router, prefix="/api", tags=["History"])
app.include_router(auth.router, prefix="/api/auth", tags=["Auth"])
app.include_router(documents.router, prefix="/api/documents", tags=["Documents"])

# Serve static files from the uploads directory
app.mount("/uploads", StaticFiles(directory=str(uploads_dir)), name="uploads")

@app.get("/")
async def root():
    return {
        "message": "VOXA Backend is running",
        "ready": getattr(app.state, "ready", False),
        "docs": "/docs",
        "health": "/api/health"
    }

if __name__ == "__main__":
    uvicorn.run("main:app", host=HOST, port=PORT, reload=True)
