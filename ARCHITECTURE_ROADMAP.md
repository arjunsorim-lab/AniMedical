# AniMedical: Complete Architecture Roadmap

## 🏗️ High-Level Overview

AniMedical is a **Voice-Enabled AI Healthcare Analytics Assistant** with a React frontend and Python FastAPI backend. It processes natural language queries (voice/text) and returns dual-format responses: detailed text summaries + interactive dashboards.

```
┌─────────────────────────────────────────────────────────────────────┐
│                        USER INTERACTION LAYER                        │
├─────────────────────────────────────────────────────────────────────┤
│  Frontend (React) ↔ Backend (FastAPI)  ↔  Data Layer (DuckDB/JSON)  │
│     ▼                      ▼                        ▼                 │
│  UI Components    Chat/Query Routing     Data Retrieval & Analysis   │
│  WebSocket        Intent Detection        LLM Processing             │
│  Voice Input      Memory Management       Dashboard Generation       │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 📱 FRONTEND ARCHITECTURE

### 1. **Entry Point: frontend/src/main.jsx**
```javascript
// React app initialization with routing
- Creates React root
- Wraps app with BrowserRouter for navigation
- Mounts on document.getElementById('root')
```

### 2. **App Router: frontend/src/App.jsx**
```javascript
ROUTING STRUCTURE:
├── "/"                    → VoiceAgentLandingPage (public)
├── "/login"              → Login (public)
├── "/signup"             → Signup (public)
├── "/password-reset"     → PasswordReset (public)
└── "/dashboard"          → Dashboard (protected)

KEY FEATURES:
- Theme loading on mount (useThemeStore)
- Auth check on mount (useAuthStore)
- Toast notifications (react-hot-toast)
```

---

## 🧠 STATE MANAGEMENT

### **useChatStore** - Core Conversation State
**File:** `frontend/src/store/useChatStore.js`

```javascript
STATE STRUCTURE:
{
  conversations: {
    [conversationId]: {
      id: string,                    // Unique conversation ID
      title: string,                 // Auto-generated from first message
      messages: [                    // Array of message objects
        {
          id: string,                // Unique message ID
          role: 'user' | 'assistant', // Who sent it
          content: string,           // Message text
          type: 'text' | 'voice',    // Input method
          isError: boolean,          // Error flag
          isStale: boolean,          // Outdated after edit
          createdAt: number,         // Timestamp (ms)
          parentId: string | null,   // For edited messages
        }
      ],
      createdAt: number,
      updatedAt: number,
    }
  },
  
  // Active conversation
  activeConversationId: string | null,
  
  // Loading/streaming state
  isLoading: boolean,        // Full request in progress
  isStreaming: boolean,      // Token streaming in progress
  streamingText: string,     // Accumulated response tokens
  activeStreamId: string,    // Current stream session ID
  isSyncing: boolean,        // Syncing to backend
}

KEY ACTIONS:
- createConversation()     → New conversation session
- addMessage(convId, msg)  → Add user or assistant message
- startStreaming(streamId) → Begin token reception
- appendToken(token)       → Add token to streamingText
- finalizeStream(streamId) → Complete stream, add message
- syncWithBackend()        → Save to backend (1s debounce)
```

### **useVoiceStore** - Voice Input State
```javascript
STATE:
{
  isRecording: boolean,      // Microphone active
  audioBlob: Blob | null,    // Recorded audio
  isTranscribing: boolean,   // STT in progress
}

ACTIONS:
- startRecording()   → Initialize mic
- stopRecording()    → End recording, set audioBlob
- setTranscribing()  → Toggle transcription status
- reset()            → Clear voice state
```

### **useAuthStore** - Authentication State
```javascript
STATE:
{
  token: string | null,      // JWT token
  user: { id, email } | null,// Current user
  isAuthenticated: boolean,
}

ACTIONS:
- login(email, password)
- signup(email, password)
- logout()
- checkAuth()               → Validate token on mount
```

### **useThemeStore** - Theme State
```javascript
STATE:
{
  isDark: boolean,
  theme: 'light' | 'dark',
}

ACTIONS:
- setTheme(theme)
- loadTheme()              → Load from localStorage
```

---

## 🌐 API SERVICE LAYER

**File:** `frontend/src/services/api.js`

### **Endpoints & Methods**

| Method | Endpoint | Purpose | Request | Response |
|--------|----------|---------|---------|----------|
| GET | `/health` | Health check | - | `{ status: "ok" }` |
| POST | `/speech-to-text` | Audio transcription | `FormData(audio)` | `{ text, confidence, language }` |
| POST | `/chat` | Non-streaming response | ChatRequest | ChatResponse |
| WS | `/stream` | Token streaming | Message data | `{ token: string }` |
| GET | `/history` | Fetch conversations | - | `[Conversation]` |
| POST | `/query` | Direct data query | QueryRequest | QueryResponse |

### **Key Functions**

```javascript
streamMessage(message, conversationId, onToken, onComplete, onError, history)
├─ Creates WebSocket connection to /stream
├─ Sends: { message, conversation_id, history }
├─ Receives tokens: { token: "text chunk" }
├─ Calls onToken() for each chunk (buffered every 80ms)
├─ Calls onComplete() when { done: true } received
├─ Returns: { close() } handle to cancel stream
└─ Auto-closes previous stream on new request

transcribeAudio(audioBlob)
├─ POST to /speech-to-text
├─ Returns: { text, confidence, language }
└─ Handles errors gracefully

sendMessage(message, conversationId, history)
├─ POST to /chat (non-streaming fallback)
├─ Returns full ChatResponse immediately
└─ Used when streaming fails

checkHealth()
├─ GET /health
└─ Verifies backend is alive

syncHistory(conversations)
├─ POST to /history
├─ Saves all conversations to backend
└─ Called with 1s debounce
```

---

## 🎨 FRONTEND COMPONENTS FLOW

### **ChatWindow.jsx** - Main Chat Container
```
COMPONENT HIERARCHY:
ChatWindow
├─ Shows WelcomeScreen (when no messages)
├─ Renders MessageBubble for each message
│   ├─ User bubble (right-aligned)
│   └─ Assistant bubble (left-aligned)
│        ├─ Text rendering (ReactMarkdown)
│        ├─ DualModeResponse (both sections)
│        ├─ SplitResponseView (text + dashboard)
│        ├─ PredefinedResponseTemplate
│        ├─ DynamicResponseTemplate (charts)
│        └─ IframeResizer (embedded HTML)
├─ VoiceButton (microphone input)
└─ TextInput (text query input)

LIFECYCLE:
1. User speaks or types query
2. addMessage() stores user message
3. startStreaming() initializes stream
4. WebSocket opens, backend starts streaming
5. appendToken() accumulates tokens in state
6. MessageBubble renders streaming text in real-time
7. finalizeStream() when done, converts to complete message
8. syncWithBackend() saves conversation (debounced)
```

### **MessageBubble.jsx** - Response Rendering
```javascript
RESPONSE TYPE DETECTION:

const hasDualSectionResponse = 
  content.includes('SECTION 1') && 
  content.includes('SECTION 2') && 
  content.includes('```json')
  → Renders SplitResponseView (2 panels)

const hasPredefinedTemplate = 
  getPredefinedTemplateKey(triggerQuery) !== null
  → Renders PredefinedResponseTemplate (custom format)

const hasChartIntent = 
  query.includes('chart'|'graph'|'bar'|'pie'|'line'|'area')
  → Renders DynamicResponseTemplate (chart display)

const isDualMode = 
  query.includes('compare dashboard'|'dashboard view'|'dual mode')
  → Renders DualModeResponse

Else:
  → Renders ReactMarkdown (plain text)
```

### **SplitResponseView.jsx** - Dual Response Display
```javascript
STRUCTURE:
┌─────────────────────────────────────────────┐
│  Response Versions | "Compare both responses"│
├──────────────┬──────────────────────────────┤
│              │                              │
│  Narrative   │  Structured Dashboard        │
│              │                              │
│  Text        │  ├─ KPI Cards               │
│  Summary     │  ├─ Top Performer           │
│  (markdown)  │  ├─ Ranked List             │
│              │  ├─ Risk Indicators         │
│  Switch ↔    │  ├─ Recommendations         │
│  Compare     │  └─ Structured Data Summary│
│              │                              │
└──────────────┴──────────────────────────────┘

FUNCTIONS:
- extractTextSection()  → Parse SECTION 1 markdown
- extractJsonBlock()    → Parse SECTION 2 JSON
- selectView()          → Show one view only
- switchView()          → Toggle between views
- restoreView()         → Show both side-by-side

KEY COMPONENTS:
- KpiCards()           → Display metrics with status
- RankingList()        → Top N items with scores
- RiskIndicators()     → Alerts with severity
- RecommendationList() → Bulleted recommendations
- StructuredDashboard()→ Organize JSON data
```

### **WelcomeScreen.jsx** - Landing Interface
```javascript
COMPONENTS:
├─ AppLogo              → Header image
├─ Greeting             → "AniCare Vox: Voice Enabled AI Assistant"
├─ Voice Button         → Microphone (center of screen)
├─ AudioWaveform        → Visual feedback
├─ Example Chips        → EXAMPLES array (10 predefined queries)
│   ├─ "Give me healthcare dashboard report"     [KPI]
│   ├─ "Revenue by service this month"           [REV]
│   ├─ "Total patients served today"             [PT]
│   ├─ "Doctor performance ranking"              [DOC]
│   ├─ "Active vs critical patient count"        [RISK]
│   ├─ "Abnormal vitals alerts summary"          [ALRT]
│   ├─ "Patients per doctor"                     [LOAD]
│   ├─ "Region-wise patient distribution"        [REG]
│   ├─ "Pending payment cases"                   [PAY]
│   └─ "Patient outcome trends"                  [TRND]
└─ TextInput            → Manual query entry

INTERACTION:
User clicks chip → onQueryClick() → handleQueryClick()
  → sendTextAndStream(chipText, 'text')
  → WebSocket stream begins
  → Response rendered real-time
```

---

## 🔗 BACKEND ARCHITECTURE

### **Entry Point: backend/main.py**
```python
INITIALIZATION SEQUENCE:
1. Create FastAPI app
2. Add CORS middleware (allow cross-origin requests)
3. Setup lifespan context manager
   └─ On startup: run_background_initialization()
      ├─ init_data_service(DATA_DIR)
      │  └─ Load CSV/Excel/JSON to DuckDB
      └─ init_stt_service()
         └─ Initialize Groq API for speech-to-text
4. Mount static files (frontend build)
5. Mount routers:
   ├─ /api/health   → Health checks
   ├─ /api/speech   → STT/TTS endpoints
   ├─ /api/chat     → Chat & WebSocket
   ├─ /api/query    → Direct queries
   ├─ /api/history  → Conversation history
   ├─ /api/auth     → Login/signup
   ├─ /api/documents→ File uploads
   └─ /api/dashboard→ Dashboard queries

6. Run on HOST:PORT (default: localhost:8000)
```

### **Router: backend/routers/chat.py**

```python
REQUEST TYPES:

1. POST /chat (Non-streaming)
   INPUT:  ChatRequest {
     message: str,              # User's query
     conversation_id: str,      # Session ID
     history: List[dict]        # Prior messages
   }
   OUTPUT: ChatResponse {
     response: str,             # Full response text
     conversation_id: str,
     refined_query: str | None, # Query after rewriting
     context_used: dict | None, # Memory context
     was_rewritten: bool
   }
   
   FLOW: ChatRequest 
      → process_contextual_query()
      → automotive_agent.process_query()
      → Returns complete response

2. WS /stream (Token Streaming - Preferred)
   INIT:   Connect with ?token=JWT
   SEND:   { message, conversation_id, history }
   RECV:   { token: "text" } × N
   FINAL:  { done: true }
   
   FLOW: WebSocket handshake
      → stream_contextual_query()
      → async generator yields tokens
      → Client receives in real-time
      → Frontend batches every 80ms for UI
```

---

## 🧠 CORE PROCESSING PIPELINE

### **Service: backend/services/contextual_chat_service.py**

```python
ENTRY POINT: async process_contextual_query(
  query: str,                        # User input
  session_id: str,                   # Conversation ID
  conversation_history: List[dict]   # Prior messages
) → Dict {
  "response": str,
  "refined_query": str,
  "context_used": dict,
  "was_rewritten": bool
}

PROCESSING FLOW:

1. MEMORY RETRIEVAL
   memory = get_memory_manager()
   context_block = memory.get_context_block(session_id, query)
   
2. QUERY REWRITING (for follow-ups)
   followup = is_followup(query)        # "that" | "it" | "them"?
   rewrite = rewrite_query(             # Resolve pronouns
     query, 
     context_block
   )
   → refined_query = rewrite.refined_query
   
3. HISTORY INJECTION (for context)
   if followup:
     injected_history = _merge_histories(
       build_prompt_context(context_block, refined_query),
       conversation_history[-8:]         # Last 8 messages
     )
   
4. MAIN PROCESSING
   response = await process_query(
     refined_query,
     injected_history
   )
   
5. MEMORY STORAGE
   memory.append_interaction(
     session_id=session_id,
     user_query=query,
     refined_query=refined_query,
     response=response,
     structured_memory=extract_structured_memory(refined_query),
     metadata={...}
   )
   
6. RETURN
   {
     "response": response,
     "refined_query": refined_query,
     "context_used": context_block if followup else None,
     "was_rewritten": rewrite.was_rewritten
   }
```

---

## 🤖 AGENT LAYER: backend/agents/automotive_agent.py

### **Main Function: async process_query()**

```python
PIPELINE STAGES:

1. TYPO CORRECTION
   query = _fix_common_typos(query)
   → "pateint" → "patient"

2. HEALTHCARE NORMALIZATION
   query = _normalize_legacy_query_to_healthcare(query)
   → Map automotive terms to healthcare

3. INTENT DETECTION
   intent = detect_intent(query)
   → Determines topic: 'doctor_performance', 'revenue', 'patients', etc.

4. PREDEFINED RESPONSE CHECK
   if _is_predefined_request_response(query):
     return _execute_predefined_healthcare_report(query)
   → For 10 standard queries (dashboard, doctor ranking, etc.)

5. HEALTHCARE ANALYTICS EXECUTION
   try:
     response = _execute_healthcare_analytics(query)
   except:
     response = _generate_healthcare_response(query)
   → Query DuckDB or JSON, build response

6. DUAL RESPONSE FORMATTING
   return _format_dual_healthcare_response(query, response)
   → Wraps in SECTION 1 (text) + SECTION 2 (JSON dashboard)

OUTPUT FORMAT:
==================================================
SECTION 1 — TEXT SUMMARY RESPONSE
==================================================

## Executive Summary
[Detailed narrative with 5+ sections]

## Key Metrics
- 📈 **Label**: Value
- 📉 **Label**: Value

## Alerts & Critical Issues
🔴 [HIGH] Message
🟡 [MEDIUM] Message

## Analysis & Insights
**Primary Focus**: Title
**Top Performer**: Name (Score)

## Detailed Rankings & Performance
1. **Item Name** — Score: X (Y patients, Z% efficiency)
2. ...

## Strategic Recommendations
1. **Primary Action**: ...
2. **Validation**: ...
3. **Prioritization**: ...
4. **Follow-up**: ...

## 🎯 Actionable Next Steps
1. Review rankings above...
2. Examine dashboard below...
3. Validate outliers...
4. Prioritize interventions...
5. Monitor KPIs...

==================================================
SECTION 2 — VISUAL DASHBOARD RESPONSE
==================================================

```json
{
  "dashboard_title": "...",
  "generated_at": "2026-05-17T...",
  "summary_metrics": [
    {
      "label": "Total Patients",
      "value": "1,234",
      "change": "+5%",
      "status": "positive"
    },
    ...
  ],
  "top_performer": {
    "name": "Dr. Emily Miller",
    "score": "100.0",
    "metrics": {
      "patients_served": 156,
      "efficiency": 92.5,
      "revenue": 45000
    }
  },
  "rankings": [
    {
      "rank": 1,
      "name": "Dr. Emily Miller",
      "score": 100.0,
      "additional_metrics": {...}
    },
    ...
  ],
  "charts": [
    {
      "type": "bar",
      "title": "...",
      "x_axis": [...],
      "y_axis": [...],
      "series": [{...}]
    },
    ...
  ],
  "alerts": [
    {
      "severity": "high" | "medium" | "low",
      "message": "..."
    }
  ],
  "insights": ["..."],
  "recommendations": ["..."]
}
```
```

### **Intent Detection: detect_intent()**

```python
TOPIC KEYWORDS (QUERY_TOPIC_KEYWORDS):
├─ "billing"       → payment, invoice, revenue, pending
├─ "patients"      → admission, discharge, critical, outcome
├─ "appointments"  → schedule, visit, booked
├─ "doctors"       → physician, provider
├─ "caregivers"    → nurse, staff
├─ "services"      → treatment, procedure
├─ "vitals"        → bp, pulse, spo2, temperature
├─ "operations"    → throughput, turnaround
├─ "regions"       → city, state, location
└─ "products"      → plan, package

RETURNS: topic string used for response customization
```

### **Dashboard Payload Generation: _build_dashboard_payload()**

```python
INPUT: query, response_text

PROCESSING:
1. Topic detection via intent
2. Extract first markdown table (if present)
3. Load JSON data files:
   ├─ summary_metrics.json
   ├─ billing_revenue_summary.json
   ├─ patient_outcome_trends.json
   └─ doctor_load_analytics.json

4. Build dashboard object:
   
TOPIC-SPECIFIC LOGIC:
├─ "doctor_performance" → Rank doctors by patient load
├─ "pending_payments"   → Rank payment buckets by amount
├─ "revenue"            → Rank services by revenue
├─ "outcomes"           → Track outcome trends
└─ Default             → Generic ranking from response

RETURNS: Dashboard Object {
  "dashboard_title": "...",
  "generated_at": ISO timestamp,
  "summary_metrics": [
    { label, value, change, status: "positive"|"negative"|"neutral" }
  ],
  "top_performer": {
    "name": str,
    "score": str,
    "metrics": { patients_served, efficiency, revenue }
  },
  "rankings": [
    {
      "rank": int,
      "name": str,
      "score": number,
      "additional_metrics": { patients_served, efficiency, revenue }
    }
  ],
  "charts": [
    { type: "bar"|"line"|"donut"|"progress", title, data }
  ],
  "alerts": [{ severity, message }],
  "insights": [str],
  "recommendations": [str]
}
```

---

## 💾 DATA LAYER

### **Service: backend/services/data_service.py**

```python
CLASS: DataService

__init__(data_dir: Path):
  self.data_dir = data_dir
  self.db_path = data_dir / "voxa_system.duckdb"
  self.conn = DuckDB connection
  self._loaded = False

INITIALIZATION:
1. Check if persistent DB exists
   ├─ Yes → Connect to file-based DB
   └─ No → Use in-memory DB

2. load_data()
   ├─ Scan for .csv, .xlsx, .json files
   ├─ For each file:
   │  ├─ Skip if table already exists
   │  ├─ Read into pandas DataFrame
   │  └─ CREATE TABLE in DuckDB
   └─ Log load status for each table

SUPPORTED FORMATS:
├─ CSV       → Read directly to DataFrame
├─ Excel     → Read with openpyxl
└─ JSON      
   ├─ List[object]        → Create one table
   ├─ Dict[str, List]     → Create tables for each key
   └─ Dict with scalars   → Single-row table

KEY TABLES LOADED:
├─ patients.json        → Patient records
├─ doctors.json         → Healthcare providers
├─ appointments.json    → Scheduled visits
├─ billing.json         → Billing records
├─ vitals.json          → Patient vital signs
├─ services.json        → Healthcare services
└─ summary_metrics.json → Pre-computed aggregations

QUERY EXECUTION:
def execute_query(sql: str) → List[Dict]:
  results = self.conn.execute(sql).fetchall()
  return [dict(row) for row in results]
```

### **Supported Data Files**

| File | Type | Purpose | Key Fields |
|------|------|---------|-----------|
| patients.json | List | Patient demographics | id, name, age, status |
| doctors.json | List | Healthcare providers | id, name, specialty, region |
| appointments.json | List | Scheduled visits | id, patient_id, doctor_id, date |
| billing.json | List | Financial transactions | id, patient_id, amount, status |
| vitals.json | List | Health measurements | patient_id, bp, pulse, spo2, temperature |
| services.json | List | Healthcare services | id, name, type, cost |
| summary_metrics.json | Dict | KPIs | total_patients, total_doctors, monthly_revenue |
| patient_outcome_trends.json | Dict | Outcome analytics | monthly_outcomes, recovery_rate, readmission_rate |
| doctor_load_analytics.json | Dict | Provider workload | regional_distribution, overloaded_count |
| billing_revenue_summary.json | Dict | Financial analytics | revenue_by_service, pending_payments |

---

## 🔄 DATA FLOW DIAGRAMS

### **Message Flow: User Query → Response**

```
FRONTEND                          BACKEND
┌──────────────┐
│  User Input  │ (text or voice)
│  "Doctor     │
│  performance"│
└──────┬───────┘
       │ transcribeAudio()
       │ or TextInput.onSend()
       │
       v
┌─────────────────────────────────┐
│ ChatWindow.handleQueryClick()    │
│ sendTextAndStream()              │
└──────────────┬──────────────────┘
       │ streamMessage(message, convId, ...)
       │
       └─────WebSocket Connect──────→ ┌──────────────────────┐
                                      │ /api/chat/stream     │
                                      │ websocket_endpoint() │
                                      └──────────┬───────────┘
                                                  │
                                                  v
                                      ┌─────────────────────────────┐
                                      │ process_contextual_query()  │
                                      │ (contextual_chat_service)   │
                                      └──────────┬──────────────────┘
                                                  │
                                                  v
                                      ┌─────────────────────────────┐
                                      │ process_query()             │
                                      │ (automotive_agent)          │
                                      │ 1. detect_intent()          │
                                      │ 2. _execute_healthcare_...()│
                                      │ 3. _build_dashboard_...()   │
                                      │ 4. _format_dual_response()  │
                                      └──────────┬──────────────────┘
                                                  │
                                                  v
                                      ┌─────────────────────────────┐
                                      │ DuckDB / JSON Data Lookup   │
                                      │ get_data_service()          │
                                      └──────────┬──────────────────┘
                                                  │
                                                  v
                                      ┌─────────────────────────────┐
                                      │ LLM Generation (Groq API)   │
                                      │ llm_service.generate_...()  │
                                      └──────────┬──────────────────┘
                                                  │
                                                  v
                                      ┌─────────────────────────────┐
                                      │ Format Response:            │
                                      │ SECTION 1: Text (markdown)  │
                                      │ SECTION 2: JSON (dashboard) │
                                      └──────────┬──────────────────┘
                                                  │
       ┌──────────────────────────────────────────┘
       │ Send tokens: { token: "chunk" }
       │ (async stream, multiple messages)
       │
       v
┌─────────────────────────────────┐
│ onToken(token)                  │
│ appendToken(token, streamId)    │
│ (batched every 80ms)            │
└────────────┬────────────────────┘
             │
             v
┌─────────────────────────────────┐
│ MessageBubble renders streaming │
│ text (real-time visual update)  │
└────────────┬────────────────────┘
             │ (continuous updates)
             │
       ┌─────────────────────────────────────────┐
       │ { done: true } received                 │
       │
       v
┌─────────────────────────────────┐
│ onComplete()                    │
│ finalizeStream(streamId)        │
│ (add complete message)          │
└────────────┬────────────────────┘
             │
             v
┌─────────────────────────────────┐
│ Display final response:         │
│ ├─ Text (full markdown)         │
│ └─ Dashboard (JSON viz)         │
│                                 │
│ SplitResponseView shows both    │
└─────────────────────────────────┘
```

### **Voice Input Flow**

```
FRONTEND                          BACKEND
┌──────────────┐
│ User clicks  │
│ microphone   │
└──────┬───────┘
       │ startRecording()
       │ (useVoiceRecorder hook)
       │ Microphone active
       │
       v
┌──────────────────────────────────┐
│ Audio streams from device        │
│ audioBlob accumulates            │
└──────┬───────────────────────────┘
       │ stopRecording() (Esc/click)
       │
       v
┌──────────────────────────────────┐
│ audioBlob ready                  │
│ VoiceStore.audioBlob = blob      │
└──────┬───────────────────────────┘
       │ useEffect triggers
       │ transcribeAudio(audioBlob)
       │
       └──────POST /speech-to-text──→ ┌──────────────────┐
                      FormData(audio)  │ speech_router    │
                                       └────────┬─────────┘
                                                │
                                                v
                                       ┌────────────────────────┐
                                       │ Groq Whisper API       │
                                       │ transcribe(audioBlob)  │
                                       └────────┬───────────────┘
                                                │
       ┌────────────────────────────────────────┘
       │ { text: "doctor performance ranking", ... }
       │
       v
┌──────────────────────────────────┐
│ setTranscribedText(text)         │
│ setTranscribing(false)           │
└──────┬───────────────────────────┘
       │
       v
┌──────────────────────────────────┐
│ TextInput auto-filled            │
│ User can edit or send directly   │
└──────┬───────────────────────────┘
       │ sendTextAndStream(text, 'voice')
       │
       └─────WebSocket stream───────→ (same as text flow above)
```

---

## 📊 MESSAGE SCHEMA

### **ChatRequest (Frontend → Backend)**
```python
{
  "message": "doctor performance ranking",      # User query
  "conversation_id": "conv_1715914400000_abc123", # Session ID
  "history": [                                   # Prior conversation
    {
      "role": "user",
      "content": "Show patients by region",
      "type": "text",
      "createdAt": 1715914400000
    },
    {
      "role": "assistant",
      "content": "## Regional Distribution...",
      "type": "text",
      "createdAt": 1715914410000
    }
  ]
}
```

### **Message Schema (Frontend Store)**
```python
{
  "id": "msg_1715914430123_xyz",               # Unique ID
  "role": "assistant" | "user",                # Sender
  "content": "Full response text...",           # Message body
  "type": "text" | "voice",                    # Input method
  "isError": False,                            # Error flag
  "isStale": False,                            # After edit
  "parentId": null | "msg_123",                # If edited
  "createdAt": 1715914430000                   # Timestamp (ms)
}
```

### **ChatResponse (Backend → Frontend)**
```python
{
  "response": "==================================================\nSECTION 1...",
  "conversation_id": "conv_1715914400000_abc123",
  "refined_query": "doctor performance ranking analysis",  # After rewrite
  "context_used": {...},                       # Memory context
  "was_rewritten": False                       # Query changed?
}
```

### **Dashboard JSON Structure (SECTION 2)**
```python
{
  "dashboard_title": "Doctor Performance Ranking",
  "generated_at": "2026-05-17T14:30:45",
  
  "summary_metrics": [
    {
      "label": "Total Patients",
      "value": "1,234",
      "change": "+5.2%",
      "status": "positive" | "negative" | "neutral"
    }
  ],
  
  "top_performer": {
    "name": "Dr. Emily Miller",
    "score": "100.0",
    "metrics": {
      "patients_served": 156,
      "efficiency": 92.5,
      "revenue": 45000.0
    }
  },
  
  "rankings": [
    {
      "rank": 1,
      "name": "Dr. Emily Miller",
      "score": 100.0,
      "additional_metrics": {
        "patients_served": 156,
        "efficiency": 92.5,
        "revenue": 45000.0
      }
    },
    ...  // up to 8 items
  ],
  
  "charts": [
    {
      "type": "bar" | "line" | "donut" | "progress",
      "title": "Performance Metrics",
      "x_axis": ["Dr. A", "Dr. B", "Dr. C"],
      "y_axis": [85, 92, 78],
      "labels": [...],
      "series": [{ "name": "Score", "data": [...] }]
    }
  ],
  
  "alerts": [
    {
      "severity": "high" | "medium" | "low",
      "message": "2 providers are flagged as overloaded."
    }
  ],
  
  "insights": ["Provider workload is concentrated among highest-volume physicians."],
  
  "recommendations": [
    "Redistribute new patient assignments from overloaded providers."
  ]
}
```

---

## 🔐 Authentication Flow

```
FRONTEND                          BACKEND
┌──────────────┐
│ User enters  │
│ credentials  │
└──────┬───────┘
       │ login(email, password)
       │
       └─────POST /auth/login──────→ ┌──────────────────┐
                                      │ auth_router      │
                                      │ login_endpoint() │
                                      └────────┬─────────┘
                                               │
                                               v
                                       ┌─────────────────┐
                                       │ Verify email    │
                                       │ & password hash │
                                       └────────┬────────┘
                                               │
       ┌──────────────────────────────────────┘
       │ { token: "jwt...", user: {...} }
       │
       v
┌─────────────────────────────────┐
│ useAuthStore.setToken(token)    │
│ localStorage['auth-storage']    │
│ = { token, user }               │
└─────────────────────────────────┘

SUBSEQUENT REQUESTS:
All API calls include:
  Authorization: Bearer <token>
```

---

## 🎯 Key Predefined Queries

```
TRIGGER PHRASES (PREDEFINED_RESPONSE_PATTERNS):
1. "give me healthcare dashboard report"      → Full KPI dashboard
2. "revenue by service this month"            → Service revenue breakdown
3. "total patients served today"              → Patient volume
4. "doctor performance ranking"               → Provider ranking
5. "active vs critical patient count"         → Patient status distribution
6. "abnormal vitals alerts summary"           → Alert aggregation
7. "patients per doctor"                      → Workload distribution
8. "region-wise patient distribution"         → Geographic breakdown
9. "pending payment cases"                    → Outstanding billing
10. "patient outcome trends"                  → Trend analysis

EACH RETURNS:
├─ SECTION 1: Detailed narrative with:
│  ├─ Executive Summary
│  ├─ Key Metrics (with emoji indicators)
│  ├─ Alerts & Critical Issues
│  ├─ Analysis & Insights
│  ├─ Detailed Rankings (top 8)
│  ├─ Strategic Recommendations
│  └─ Actionable Next Steps
└─ SECTION 2: Interactive dashboard JSON with:
   ├─ KPI cards
   ├─ Top performer
   ├─ Rankings list
   ├─ 4 chart types (bar, line, donut, progress)
   ├─ Risk indicators
   └─ Recommendations
```

---

## 🚀 Complete Execution Timeline

```
T=0ms:   User speaks or types
T=1ms:   addMessage() stores in useChatStore
T=5ms:   startStreaming() initializes UI for response
T=10ms:  streamMessage() creates WebSocket
T=50ms:  WebSocket connects to /stream endpoint
T=100ms: Backend receives message
T=150ms: process_contextual_query() starts
T=200ms: detect_intent() analyzes query
T=300ms: DuckDB query executes
T=400ms: LLM processes context
T=500ms: First tokens generated
T=600ms: First token sent to frontend
T=700ms: Frontend batches and renders (80ms batching)
T=800ms: Visual update shows first word
T=2000ms: Response complete
T=2100ms: finalizeStream() adds complete message
T=2200ms: SplitResponseView renders both sections
T=2300ms: Dashboard becomes interactive
T=3000ms: Message saved to backend (debounced sync)
```

---

## 📝 Summary: What Each Component Does

| Component | Role | Responsibility |
|-----------|------|-----------------|
| **main.jsx** | Entry | Initialize React app & routing |
| **App.jsx** | Router | Define routes & theme/auth setup |
| **ChatWindow.jsx** | Container | Manage conversation UI |
| **MessageBubble.jsx** | Renderer | Detect & display response type |
| **SplitResponseView.jsx** | Display | Show dual responses (text + JSON) |
| **WelcomeScreen.jsx** | Landing | Show predefined examples |
| **api.js** | Network | All API & WebSocket communication |
| **useChatStore.js** | State | Conversation & message state |
| **useVoiceStore.js** | State | Voice recording state |
| **useAuthStore.js** | State | Authentication & user state |
| **main.py** | Backend Init | FastAPI setup & service initialization |
| **chat.py** | Router | HTTP & WebSocket endpoints |
| **contextual_chat_service.py** | Orchestrator | Query rewriting & memory management |
| **automotive_agent.py** | Brain | Intent detection → response generation |
| **data_service.py** | Storage | DuckDB data loading & queries |
| **llm_service.py** | LLM | Groq API interface for generation |
| **memory_manager.py** | Memory | Session context & conversation history |

---

This roadmap covers the entire flow from user input through backend processing to response display. Each piece works together to create a seamless healthcare analytics experience!
