"""
Dashboard data endpoints backed by files in the configured data directory.
"""

import json
import logging

from fastapi import APIRouter, HTTPException

try:
    from backend.config import DATA_DIR
except ImportError:
    from config import DATA_DIR


router = APIRouter()
logger = logging.getLogger("voxa.router.dashboard")


def _read_json_file(filename: str):
    path = DATA_DIR / filename
    try:
        with path.open("r", encoding="utf-8-sig") as f:
            return json.load(f)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=f"{filename} not found") from exc
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=500, detail=f"{filename} is not valid JSON") from exc


def _get_loaded_data_service():
    try:
        from backend.services.data_service import get_data_service
    except ImportError:
        from services.data_service import get_data_service

    try:
        return get_data_service()
    except RuntimeError:
        return None


def _provider_rows_from_duckdb():
    data_service = _get_loaded_data_service()
    if data_service is None:
        return None

    tables = {row[0] for row in data_service.conn.execute("SHOW TABLES").fetchall()}
    if "distribution_top_primary_physicians" not in tables:
        return None

    rows = data_service.conn.execute("""
        SELECT doctor_name, patient_count, status, capacity, efficiency_percent
        FROM distribution_top_primary_physicians
    """).fetchall()

    summary_metrics = {}
    if "summary_metrics" in tables:
        summary_row = data_service.conn.execute("""
            SELECT total_patients, active_patients, total_doctors
            FROM summary_metrics
            LIMIT 1
        """).fetchone()
        if summary_row:
            summary_metrics = {
                "total_patients": int(summary_row[0] or 0),
                "active_patients": int(summary_row[1] or 0),
                "total_doctors": int(summary_row[2] or 0),
            }

    return rows, summary_metrics


def _normalize_provider_rows(rows):
    max_patient_count = max([int(row[1] or 0) for row in rows] or [1])

    providers = []
    for row in rows:
        patient_count = int(row[1] or 0)
        load_index = round((patient_count / max_patient_count) * 100) if max_patient_count else 0
        providers.append({
            "name": row[0] or "Unknown provider",
            "patients": patient_count,
            "status": row[2] or "Unknown",
            "capacity": int(row[3] or 0),
            "workload": load_index,
            "efficiency": round(float(row[4] or 0)),
        })
    return providers


@router.get("/dashboard/provider-load")
async def get_provider_load_dashboard():
    """
    Returns provider load data from the data folder instead of UI hardcoded rows.
    """
    try:
        load_data = _read_json_file("doctor_load_analytics.json")
        summary_metrics = _read_json_file("summary_metrics.json")

        duckdb_result = _provider_rows_from_duckdb()
        if duckdb_result:
            provider_rows, db_summary_metrics = duckdb_result
            providers = _normalize_provider_rows(provider_rows)
            summary_metrics = {**summary_metrics, **db_summary_metrics}
            source = "duckdb"
        else:
            provider_rows = [
                (
                    row.get("doctor_name"),
                    row.get("patient_count"),
                    row.get("status"),
                    row.get("capacity"),
                    row.get("efficiency_percent"),
                )
                for row in load_data.get("distribution_top_primary_physicians", [])
            ]
            providers = _normalize_provider_rows(provider_rows)
            source = "json"

        summary = load_data.get("summary", {})
        return {
            "summary": {
                "total_doctors": int(summary.get("total_doctors") or summary_metrics.get("total_doctors") or 0),
                "average_patients_per_doctor": int(summary.get("average_patients_per_doctor") or 0),
                "overloaded_count": int(summary.get("overloaded_count") or 0),
                "total_patients": int(summary_metrics.get("total_patients") or 0),
                "active_patients": int(summary_metrics.get("active_patients") or 0),
            },
            "providers": providers,
            "source": source,
            "source_files": ["doctor_load_analytics.json", "summary_metrics.json"],
        }
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Provider load dashboard failed: %s", exc)
        raise HTTPException(status_code=500, detail="Failed to load provider dashboard data") from exc
