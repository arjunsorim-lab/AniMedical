# VOXA — Voice-Enabled AI Healthcare Analytics Assistant

<p align="center">
  <img src="frontend/public/Blue-and-Green-Modern-Medical-Logo-2-scaled-removebg-preview.png" alt="VOXA Logo" width="250"/>
</p>

**VOXA** is a full-stack, voice-enabled AI assistant purpose-built for healthcare analytics. It combines speech-to-text, large language model intelligence, and an in-memory analytical database (DuckDB) to enable natural-language exploration of healthcare operations data — patients, doctors, billing, vitals, outcomes, and more.

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend (React + Vite)              │
│  ┌──────────┐  ┌──────────┐  ┌────────────┐           │
│  │ Zustand  │  │  MUI     │  │ Tailwind   │           │
│  │ Stores   │  │  Icons   │  │ CSS        │           │
│  └──────────┘  └──────────┘  └────────────┘           │
│  ┌──────────────────────────────────────────────────┐  │
│  │  Pages: VoiceAgentLandingPage, Dashboard, Login, │  │
│  │  Signup, PasswordReset                           │  │
│  └──────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────┐  │
│  │  Components: ChatWindow, Header, Sidebar,        │  │
│  │  MessageBubble, VoiceButton, AudioVisualizer,    │  │
│  │  DualModeResponse, DashboardResponse,            │  │
│  │  PredefinedResponseTemplate, DocumentUpload       │  │
│  └──────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────┐  │
│  │  Services: api.js (REST + WebSocket), cache.js,  │  │
│  │  mockApi.js                                       │  │
│  └──────────────────────────────────────────────────┘  │
└────────────────────┬────────────────────────────────────┘
                     │  REST API / WebSocket
                     ▼
┌─────────────────────────────────────────────────────────┐
│               Backend (FastAPI + Python)                 │
│                                                         │
│  ┌──────────┐  ┌──────────┐  ┌────────────────────┐    │
│  │  Auth    │  │  Chat    │  │  Router Layer       │    │
│  │  Router  │  │  Router  │  │  (health, speech,   │    │
│  │          │  │          │  │   query, history,   │    │
│  │          │  │          │  │   documents)        │    │
│  └──────────┘  └──────────┘  └────────────────────┘    │
│                           │                             │
│  ┌──────────────────────────────────────────────────┐  │
│  │         Contextual Chat Service Layer            │  │
│  │  - Query rewriting (follow-up detection)         │  │
│  │  - Session memory (in-memory / Redis)            │  │
│  │  - Prompt context injection                      │  │
│  └──────────────────────┬───────────────────────────┘  │
│                         │                               │
│  ┌──────────────────────────────────────────────────┐  │
│  │            Automotive Agent (Brain)              │  │
│  │  - Intent detection                              │  │
│  │  - JSON data profiling & selection               │  │
│  │  - Predefined response patterns                  │  │
│  │  - Chart/graph request detection                 │  │
│  │  - Markdown response generation                  │  │
│  └──────┬──────────────┬───────────────────────────┘  │
│         │              │                               │
│         ▼              ▼                               │
│  ┌──────────┐  ┌──────────────────┐                   │
│  │LLMService│  │   Data Service   │                   │
│  │(Groq API)│  │ (DuckDB Engine)  │                   │
│  │  LLaMA   │  │  CSV / Excel /   │                   │
│  │  70B/8B  │  │  JSON Ingestion  │                   │
│  └──────────┘  └──────────────────┘                   │
│                                                         │
│  ┌──────────┐  ┌──────────┐  ┌────────────────────┐    │
│  │ STT      │  │ TTS      │  │ Storage Service    │    │
│  │ (Groq)   │  │(Edge-TTS)│  │ (Local / Supabase) │    │
│  └──────────┘  └──────────┘  └────────────────────┘    │
│                                                         │
│  ┌──────────────────────────────────────────────────┐  │
│  │  Chat Persistence: DuckDB (local) / MongoDB      │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

---

## ✨ Features

### 🎙️ Voice-First Interaction
- **Speech-to-Text** via Groq API (Whisper model)
- **Text-to-Speech** via Microsoft Edge-TTS
- Real-time audio recording with visualizer feedback
- Voice button with keyboard shortcut support

### 🧠 AI-Powered Analytics
- **LLM**: Groq API (free tier) — primary: `llama-3.3-70b-versatile`, fallback: `llama-3.1-8b-instant`
- Natural language queries on healthcare operations data
- Multi-intent detection with entity extraction
- Follow-up query rewriting for context-aware conversations
- Session memory management (in-memory or Redis-backed)
- Response validation with guardrails against hallucination
- Automatic fallback to smaller model on payload errors

### 📊 Data Lake
- **DuckDB** in-memory analytical database
- Auto-ingests CSV, Excel (.xlsx/.xls), and JSON files
- Smart JSON parsing (nested lists become separate tables, dicts become single-row tables)
- Persistent DuckDB database for large datasets (avoids reloading on restart)
- Pre-computed aggregations and KPI metrics
- Full schema introspection (`SHOW TABLES`, `DESCRIBE`)

### 📈 Smart Response System
- Predefined response templates for common queries (dashboard reports, doctor performance, patient distribution, etc.)
- Dual-mode response rendering (tabular + narrative)
- Dynamic response templates with chart/graph detection
- KPI metrics JSON injection for dashboard integration
- Markdown table validation with automatic repair/retry

### 🔐 Auth & User Management
- JWT-based authentication (HS256)
- User registration, login, password reset
- Profile picture upload
- Protected routes on frontend
- Token-based WebSocket authentication

### 💬 Conversation History
- DuckDB-local or MongoDB-backed persistence
- Session tracking with automatic caching
- Chat history sync across sessions
- Local storage cache with `voice-ai-chat:` prefix

---

## 🗂️ Project Structure

```
MedicalAI/
├── backend/
│   ├── main.py                    # FastAPI entry point
│   ├── config.py                  # Environment configuration
│   ├── dependencies.py            # FastAPI dependency injection
│   ├── requirements.txt           # Python dependencies
│   ├── agents/
│   │   └── automotive_agent.py    # Core AI agent (intent → data → response)
│   ├── routers/
│   │   ├── auth.py                # Authentication endpoints
│   │   ├── chat.py                # Chat & streaming endpoints
│   │   ├── documents.py           # Document upload endpoints
│   │   ├── health.py              # Health check endpoints
│   │   ├── history.py             # Conversation history
│   │   ├── query.py               # Direct data query
│   │   └── speech.py              # Speech-to-text endpoint
│   ├── services/
│   │   ├── chat_service.py        # Chat persistence (DuckDB/MongoDB)
│   │   ├── contextual_chat_service.py  # Context-aware chat orchestration
│   │   ├── data_service.py        # DuckDB data lake
│   │   ├── llm_service.py         # Groq API LLM integration
│   │   ├── memory_manager.py      # Session memory management
│   │   ├── query_rewriter.py      # Follow-up query rewriting
│   │   ├── storage_service.py     # File storage (local/Supabase)
│   │   ├── stt_service.py         # Speech-to-text
│   │   ├── tts_service.py         # Text-to-speech
│   │   └── user_service.py        # User CRUD operations
│   └── scripts/
│       ├── generate_20m_dataset.py     # Large dataset generation
│       └── migrate_local_to_mongo.py   # Data migration utility
├── frontend/
│   ├── public/                    # Static assets, logo, icons
│   ├── src/
│   │   ├── App.jsx                # Root component with routing
│   │   ├── main.jsx               # Entry point
│   │   ├── components/            # Reusable React components
│   │   │   ├── ChatWindow.jsx         # Main chat interface
│   │   │   ├── MessageBubble.jsx      # Individual message display
│   │   │   ├── VoiceButton.jsx        # Voice input button
│   │   │   ├── AudioVisualizer.jsx    # Audio visualization
│   │   │   ├── Header.jsx             # Top navigation bar
│   │   │   ├── Sidebar.jsx            # Side navigation
│   │   │   ├── IconRail.jsx           # Icon toolbar
│   │   │   ├── TextInput.jsx          # Text input field
│   │   │   ├── DualModeResponse.jsx   # Dual-mode response renderer
│   │   │   ├── DashboardResponse.jsx  # Dashboard response component
│   │   │   ├── DynamicResponseTemplate.jsx  # Dynamic template
│   │   │   ├── PredefinedResponseTemplate.jsx # Predefined responses
│   │   │   ├── DocumentUpload.jsx     # File upload component
│   │   │   ├── AppLogo.jsx           # Application logo
│   │   │   ├── UserAvatar.jsx        # User avatar display
│   │   │   ├── CustomDropdown.jsx    # Custom select dropdown
│   │   │   ├── ConfirmModal.jsx      # Confirmation dialog
│   │   │   ├── WelcomeScreen.jsx     # Welcome/landing screen
│   │   │   └── ProtectedRoute.jsx    # Auth guard component
│   │   ├── pages/
│   │   │   ├── VoiceAgentLandingPage.jsx  # Landing page
│   │   │   ├── Dashboard.jsx              # Main dashboard
│   │   │   ├── Login.jsx                  # Login page
│   │   │   ├── Signup.jsx                 # Registration page
│   │   │   └── PasswordReset.jsx          # Password reset page
│   │   ├── hooks/
│   │   │   ├── useAppStatus.js        # App health check hook
│   │   │   └── useVoiceRecorder.js    # Audio recording hook
│   │   ├── services/
│   │   │   ├── api.js             # REST & WebSocket API client
│   │   │   ├── cache.js           # Client-side caching
│   │   │   └── mockApi.js         # Mock API for development
│   │   ├── store/
│   │   │   ├── useAuthStore.js    # Authentication state
│   │   │   ├── useChatStore.js    # Chat state management
│   │   │   ├── useThemeStore.js   # Theme preferences
│   │   │   ├── useUIStore.js      # UI state
│   │   │   ├── useUserStore.js    # User profile state
│   │   │   └── useVoiceStore.js   # Voice recording state
│   │   └── utils/
│   │       └── validation.js     # Input validation utilities
│   ├── index.html
│   ├── tailwind.config.js
│   ├── vite.config.js
│   └── package.json
├── data/                          # Healthcare dataset files (JSON, CSV)
│   ├── patients.json
│   ├── doctors.json
│   ├── billing.json
│   ├── vitals.json
│   ├── appointments.json
│   ├── services.json
│   ├── operations.json
│   ├── hospitals.json
│   ├── insurance_companies.json
│   ├── caregivers.json
│   ├── doctor_load_analytics.json
│   ├── patient_outcome_trends.json
│   ├── billing_revenue_summary.json
│   ├── summary_metrics.json
│   ├── service_usage.json
│   ├── company.json
│   ├── blog.json
│   ├── products.json
│   ├── product.json
│   ├── team.json
│   ├── regions.json
│   ├── categories.csv
│   ├── services.csv
│   ├── products.csv
│   ├── company.csv
│   ├── team.csv
│   └── ... (additional data files)
├── runtime.txt                    # Python runtime specification
├── start.bat                      # Windows startup script
├── sample_queries.txt             # Example queries
└── LICENSE
```

---

## 🚀 Quick Start

### Prerequisites
- Python 3.10+
- Node.js 18+
- npm 9+

### 1. Clone & Install Backend Dependencies

```bash
# Create a virtual environment (recommended)
python -m venv venv
source venv/bin/activate   # macOS/Linux
# venv\Scripts\activate    # Windows

# Install backend dependencies
pip install -r backend/requirements.txt
```

### 2. Set Up Environment Variables

Create `backend/.env`:

```env
# REQUIRED: Get a FREE API key at https://console.groq.com
GROQ_API_KEY=your_groq_api_key_here

# Server
HOST=0.0.0.0
PORT=8000
CORS_ORIGINS=http://localhost:5173

# Data backend (local or mongo)
DATA_BACKEND=local

# Optional: MongoDB for chat/user persistence
MONGO_URI=
MONGO_DB_NAME=voxa

# JWT (for local development, defaults work)
JWT_SECRET=voxa-demo-secret-key-change-in-production
```

### 3. Start the Backend

```bash
cd backend
python main.py
```

The API server starts at `http://localhost:8000` with:
- Interactive docs: `http://localhost:8000/docs`
- Health check: `http://localhost:8000/api/health`

### 4. Start the Frontend

In a new terminal:

```bash
cd frontend
npm install
npm run dev
```

The frontend dev server starts at `http://localhost:5173`.

---

## 🔧 Configuration

| Environment Variable | Default | Description |
|---|---|---|
| `GROQ_API_KEY` | `""` | **Required.** Groq API key (free at console.groq.com) |
| `PRIMARY_MODEL` | `llama-3.3-70b-versatile` | Primary LLM model |
| `FALLBACK_MODEL` | `llama-3.1-8b-instant` | Fallback LLM model |
| `HOST` | `0.0.0.0` | Backend server host |
| `PORT` | `8000` | Backend server port |
| `CORS_ORIGINS` | `http://localhost:5173` | Comma-separated allowed origins |
| `DATA_DIR` | `../data` | Path to healthcare data files |
| `DATA_BACKEND` | `local` | Data storage backend (`local` or `mongo`) |
| `MONGO_URI` | `""` | MongoDB connection URI |
| `MEMORY_BACKEND` | `memory` | Session memory backend (`memory` or `redis`) |
| `REDIS_URL` | `""` | Redis connection URL |
| `MEMORY_CONTEXT_WINDOW` | `4` | Number of past interactions for context |
| `STORAGE_BACKEND` | `local` | File storage type (`local` or `supabase`) |
| `JWT_SECRET` | see config.py | JWT signing secret (change in production!) |
| `JWT_EXPIRY_HOURS` | `168` | Token expiry (default 7 days) |
| `SUPABASE_URL` | `""` | Supabase project URL (for cloud storage) |
| `SUPABASE_SERVICE_ROLE_KEY` | `""` | Supabase service role key |

---

## 🧪 Example Queries

Once running, try these example questions:

**Patients & Doctors**
- *"How many active patients are there?"*
- *"Show me patients per doctor with load analytics"*
- *"Doctor performance ranking with ratings"*
- *"How many critical patients are currently being monitored?"*

**Billing & Revenue**
- *"What is the total revenue by service this month?"*
- *"Show me pending payment cases"*
- *"What's the average billing amount?"*

**Vitals & Alerts**
- *"Give me abnormal vitals alerts summary"*
- *"Show vitals with alert flags"*

**Operations & Distribution**
- *"Region-wise patient distribution"*
- *"What's the current patient outcome trend?"*
- *"Give me the healthcare dashboard report"*

**Chart Requests**
- *"Show me a chart of billing by region"*
- *"Graph of patient outcome trends"*

See `sample_queries.txt` for more examples.

---

## 🧱 Technology Stack

### Backend
| Component | Technology |
|---|---|
| **Framework** | FastAPI |
| **Runtime** | Python 3.10+ |
| **LLM API** | Groq Cloud (free tier — LLaMA 3) |
| **Data Lake** | DuckDB (in-memory / persistent) |
| **Speech-to-Text** | Groq API (Whisper) |
| **Text-to-Speech** | Edge-TTS |
| **Auth** | JWT (PyJWT) + bcrypt (Passlib) |
| **Databases** | DuckDB (primary), MongoDB (optional) |
| **Memory** | In-memory dict, Redis (optional) |
| **Storage** | Local filesystem, Supabase (optional) |

### Frontend
| Component | Technology |
|---|---|
| **Framework** | React 19 |
| **Bundler** | Vite 8 |
| **State Management** | Zustand |
| **UI Library** | MUI v9 (Material UI) |
| **CSS** | TailwindCSS |
| **Routing** | React Router v7 |
| **HTTP/WS Client** | Native Fetch / WebSocket |
| **Markdown Rendering** | react-markdown + rehype-sanitize + remark-gfm |

---

## 📄 API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/` | Root health check |
| `GET` | `/api/health` | Full system health check |
| `GET` | `/api/health/llm` | LLM service health |
| `POST` | `/api/speech-to-text` | Transcribe audio to text |
| `POST` | `/api/chat` | Send chat message (non-streaming) |
| `WS` | `/api/stream` | WebSocket chat streaming |
| `POST` | `/api/query` | Direct data query |
| `GET` | `/api/history` | Get conversation history |
| `POST` | `/api/sync` | Sync conversation history |
| `POST` | `/api/auth/login` | User login |
| `POST` | `/api/auth/signup` | User registration |
| `GET` | `/api/auth/me` | Get current user |
| `POST` | `/api/auth/request-reset` | Request password reset |
| `POST` | `/api/auth/reset-password` | Reset password |
| `POST` | `/api/auth/profile-pic` | Upload profile picture |
| `POST` | `/api/documents/upload` | Upload document |

---

## 💾 Data Layer Details

The data service automatically loads all supported files from the `data/` directory:

- **CSV files** → DuckDB table (filename = table name)
- **Excel files** (.xlsx/.xls) → DuckDB table
- **JSON lists** → DuckDB table (list of objects)
- **JSON dictionaries with lists** → Multiple DuckDB tables (one per list key)
- **JSON scalars** → Single-row DuckDB table

Column names are normalized: lowercase, stripped of spaces/special chars.

For large datasets (>1M rows), the system uses a persistent DuckDB database (`voxa_system.duckdb`) that caches loaded data to avoid re-ingestion on restart.

---

## 🔒 Security Notes

- JWT secret should be changed in production
- Groq API key should be kept secure
- CORS origins should be limited to known frontend URLs
- MongoDB credentials should use environment variables
- Password reset tokens are sent via request (no email integration built-in)
- Consider rate limiting for production deployments

---

## 🧪 Testing

```bash
# Backend tests (example)
cd backend
python -m pytest tests/
```

Current test coverage: `backend/tests/test_query_rewriter.py`

---

## 🚢 Deployment

### Render (PaaS)
The backend is configured for Render-compatible deployment. Ensure:
- `runtime.txt` specifies Python version
- `requirements.txt` has all dependencies
- Environment variables set via Render dashboard
- `HOST=0.0.0.0` and `PORT=10000` (Render default)

### Docker
```bash
docker build -t voxa-backend -f backend/Dockerfile .
docker run -p 8000:8000 -e GROQ_API_KEY=your_key voxa-backend
```

---

## 📁 Data Files Description

| File | Content |
|---|---|
| `patients.json` | Patient records (demographics, status, region) |
| `doctors.json` | Doctor profiles and specialization |
| `billing.json` | Billing transactions and amounts |
| `vitals.json` | Patient vitals with alert flags |
| `appointments.json` | Appointment scheduling data |
| `services.json` | Healthcare service catalog |
| `operations.json` | Operational metrics and throughput |
| `hospitals.json` | Hospital/facility directory |
| `caregivers.json` | Caregiver/nurse staffing data |
| `doctor_load_analytics.json` | Doctor workload analytics |
| `patient_outcome_trends.json` | Patient outcome trends |
| `billing_revenue_summary.json` | Revenue summaries |
| `summary_metrics.json` | Aggregate KPI metrics |
| `service_usage.json` | Service utilization data |
| `insurance_companies.json` | Insurance provider directory |

---

## 📜 License

See the [LICENSE](LICENSE) file for details.

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request