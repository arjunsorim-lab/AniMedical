# VOXA — Voice-Enabled Automotive Data Assistant

VOXA is a voice and text interface for querying automotive manufacturing data. It uses a combination of LLMs for natural language processing and a Python-based data layer to retrieve metrics from plant datasets.

## Features

- **Data Querying**: Accesses manufacturing data stored in CSV files via DuckDB.
- **Dashboard Integration**: Injects HTML/JS templates into the chat interface for data visualization.
- **Voice Support**: Uses Whisper for Speech-to-Text and Edge-TTS for Text-to-Speech.
- **Time-Based Filtering**: Supports queries for specific weeks, months, or quarters (e.g., "this week", "last quarter").
- **Metric Validation**: A Python layer that compares numbers in the LLM response with raw data from the database.
- **Structured Responses**: Formats output into summaries, data tables, and bulleted insights.

## System Flow

1.  **Intent Detection**: The user query is classified into categories like sales, production, or quality alerts.
2.  **SQL Execution**: The system generates and runs SQL queries against DuckDB to fetch relevant data.
3.  **Context Building**: Raw data and query results are provided to the LLM as context.
4.  **Response Generation**: The LLM generates a summary and insights based on the provided data.
5.  **Numeric Check**: A validation script scans the LLM output to ensure numbers match the raw data results.
6.  **Dashboard Injection**: If the query is analytical, a dashboard template is populated with data and sent to the frontend.

## Tech Stack

### Backend
- **Framework**: FastAPI
- **Data Engine**: DuckDB
- **LLM Integration**: Groq API (Primary: LLaMA 3.3 70B, Fallback: LLaMA 3 8B)
- **Speech**: Whisper (STT) and Edge-TTS (TTS)
- **Auth**: JWT-based authentication

### Frontend
- **Framework**: React 19 with Vite
- **Styling**: Tailwind CSS
- **State Management**: Zustand
- **Animations**: Framer Motion

## Project Structure

```text
VOICE-MODEL/
├── backend/
│   ├── agents/
│   │   └── automotive_agent.py # Intent parsing, SQL logic, and validation
│   ├── services/
│   │   ├── data_service.py    # DuckDB management
│   │   ├── llm_service.py     # LLM API calls
│   │   ├── stt_service.py     # Speech processing
│   │   └── tts_service.py     # Voice synthesis
│   ├── config.py               # System settings and prompts
│   └── main.py                 # FastAPI server entry
├── frontend/
│   ├── src/
│   │   ├── components/        # UI and chat components
│   │   ├── store/             # Global state management
│   │   └── App.jsx            # Application entry
├── data/                      # CSV files for production and alerts
├── dashboardtemplate.html     # HTML template for analytical reports
└── start.bat                  # Batch script to run backend and frontend
```

## Setup & Usage

### Prerequisites
- Python 3.9+
- Node.js 18+
- A valid Groq API Key

### Running the Application
Use the provided batch file for a quick start:
```bash
./start.bat
```

### Manual Installation

1.  **Backend**:
    ```bash
    cd backend
    pip install -r requirements.txt
    # Configure .env with your GROQ_API_KEY
    python main.py
    ```

2.  **Frontend**:
    ```bash
    cd frontend
    npm install
    npm run dev
    ```

## Data Domains
- **Production**: Tracks units by plant, model, and date.
- **Revenue**: Financial data breakdown by region and vehicle type.
- **Quality**: Logs for manufacturing alerts and affected units.
- **Tasks**: Schedule of plant operations and task status.

## Implementation Details
- **Deterministic SQL**: The system prioritizes data retrieved via SQL over LLM-generated numbers.
- **Validation Layer**: Any number mentioned in the final response is checked against the database result set.
- **Modular Design**: Separate services for speech, data, and LLM orchestration.