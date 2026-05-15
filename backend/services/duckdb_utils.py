from datetime import datetime
from pathlib import Path
import logging

import duckdb


INVALID_DUCKDB_MESSAGE = "not a valid DuckDB database file"


def connect_duckdb_file(db_path: Path, logger: logging.Logger | None = None) -> duckdb.DuckDBPyConnection:
    """
    Connect to a local DuckDB file, recovering only from invalid placeholder files.

    Git LFS pointer files can appear at the database path when LFS content has not
    been pulled. DuckDB cannot open those, so move the invalid file aside and let
    DuckDB create a fresh local database.
    """
    db_path.parent.mkdir(parents=True, exist_ok=True)

    try:
        return duckdb.connect(str(db_path))
    except Exception as exc:
        if INVALID_DUCKDB_MESSAGE not in str(exc):
            raise

        timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
        quarantine_path = db_path.with_name(f"{db_path.name}.invalid-{timestamp}")
        db_path.rename(quarantine_path)

        if logger:
            logger.warning(
                "Moved invalid DuckDB file from %s to %s and created a fresh database",
                db_path,
                quarantine_path,
            )

        return duckdb.connect(str(db_path))
