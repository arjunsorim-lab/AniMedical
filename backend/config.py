"""
VOXA Backend - Configuration
Loads environment variables and provides typed settings.
"""

import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env from backend directory
BACKEND_DIR = Path(__file__).parent.resolve()
load_dotenv(BACKEND_DIR / ".env")

# -- Groq LLM --
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
PRIMARY_MODEL = os.getenv("PRIMARY_MODEL", "llama-3.3-70b-versatile")
DEBUG_MODE = os.getenv("DEBUG_MODE", "false").lower() == "true"
FALLBACK_MODEL = os.getenv("FALLBACK_MODEL", "llama-3.1-8b-instant")

# -- Server --
HOST = os.getenv("HOST", "0.0.0.0")
PORT = int(os.getenv("PORT", "8000"))
CORS_ORIGINS = [o.strip() for o in os.getenv("CORS_ORIGINS", "http://localhost:5173,http://localhost:5174,http://localhost:5175").split(",")]

# -- Data --
DATA_DIR = Path(os.getenv("DATA_DIR", str(BACKEND_DIR / ".." / "data"))).resolve()
DATA_BACKEND = os.getenv("DATA_BACKEND", "local").lower()

# -- MongoDB (optional cloud backend) --
MONGO_URI = os.getenv("MONGO_URI", "")
MONGO_DB_NAME = os.getenv("MONGO_DB_NAME", "voxa")
MONGO_USERS_COLLECTION = os.getenv("MONGO_USERS_COLLECTION", "users")
MONGO_CHATS_COLLECTION = os.getenv("MONGO_CHATS_COLLECTION", "chats")

# -- Object Storage (optional cloud uploads) --
STORAGE_BACKEND = os.getenv("STORAGE_BACKEND", "local").lower()  # local | supabase

# -- Supabase Storage (optional cloud uploads) --
SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
SUPABASE_STORAGE_BUCKET = os.getenv("SUPABASE_STORAGE_BUCKET", "")
SUPABASE_PUBLIC_BASE_URL = os.getenv("SUPABASE_PUBLIC_BASE_URL", "")

# -- Conversation Memory --
MEMORY_BACKEND = os.getenv("MEMORY_BACKEND", "memory").lower()
REDIS_URL = os.getenv("REDIS_URL", "")
MEMORY_CONTEXT_WINDOW = int(os.getenv("MEMORY_CONTEXT_WINDOW", "4"))
MEMORY_MAX_INTERACTIONS = int(os.getenv("MEMORY_MAX_INTERACTIONS", "40"))
MEMORY_COMPRESSION_THRESHOLD = int(os.getenv("MEMORY_COMPRESSION_THRESHOLD", "20"))

# -- JWT Auth --
JWT_SECRET = os.getenv("JWT_SECRET", "voxa-demo-secret-key-change-in-production")
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
JWT_EXPIRY_HOURS = int(os.getenv("JWT_EXPIRY_HOURS", "168"))

# -- LLM Guardrails --
LLM_GUARDRAILS = [
    "DO NOT invent any numbers, percentages, entities, or medical claims.",
    "Use ONLY values present in provided context, computed results, summaries, or SQL tables.",
    "If information is missing, clearly say 'No data available for this request'.",
    "DO NOT expose internal keys like 'computed_results', 'sql', 'signals', or 'structured_context'.",
    "Keep responses factual, concise, and aligned to healthcare operations data (patients, doctors, services, billing, vitals, outcomes, regions).",
]

# -- Healthcare System Prompt --
SYSTEM_PROMPT = """You are VOXA, a Healthcare Analytics Assistant.

Your job is to generate accurate, data-backed responses using ONLY the provided context.

Scope:
- Patients, doctors, caregivers, services, billing, vitals, outcomes, operations, regions, and related healthcare business data.

Rules:
1. Never invent data.
2. If the query is clear and data is available, provide:
   SUMMARY
   DATA TABLE (if multiple rows/fields are present)
   INSIGHTS
3. If the query is ambiguous, ask a concise clarification question.
4. If out-of-scope, politely explain your healthcare data scope and offer a relevant alternative.
5. Do not mention internal field names or raw JSON keys.

Style:
- Professional, concise, and easy to read.
- Use exact values and precise time references when present.
"""
