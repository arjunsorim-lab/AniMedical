"""
VOXA Backend — Data Service (Layer 8: Data Lake)
Loads Excel data into DuckDB in-memory analytical database.
Provides query execution and pre-computed aggregations for the plant manager dashboard.
"""

import duckdb
import pandas as pd
from pathlib import Path
from datetime import datetime, timedelta
import logging

logger = logging.getLogger("voxa.data")

class DataService:
    """
    DuckDB-backed data layer.
    - Loads Excel files at startup into in-memory tables
    - Provides SQL query execution
    - Pre-computes common dashboard aggregations
    """

    def __init__(self, data_dir: Path):
        self.data_dir = data_dir
        self.db_path = data_dir / "voxa_system.duckdb"
        
        if self.db_path.exists():
            logger.info(f"Using persistent DuckDB at {self.db_path}")
            self.conn = duckdb.connect(str(self.db_path))
        else:
            logger.info("Using in-memory DuckDB")
            self.conn = duckdb.connect(":memory:")
            
        self._loaded = False

    def load_data(self):
        """Load CSV, Excel, and JSON files into DuckDB tables."""
        try:
            # Check if we already have the main tables (hospitals, doctors, patients, appointments)
            existing_tables = [t[0] for t in self.conn.execute("SHOW TABLES").fetchall()]
            
            files = [
                path for path in self.data_dir.iterdir()
                if path.suffix.lower() in {".csv", ".xlsx", ".xls", ".json"}
            ]

            if not files:
                logger.warning(f"No supported data files found in {self.data_dir}")

            for path in files:
                table_name = str(path.stem).strip().lower().replace(" ", "_").replace("-", "_")
                
                # Skip loading if the table already exists in the persistent DB
                # This prevents reloading massive 2 crore datasets on every startup
                if table_name in existing_tables:
                    count = self.conn.execute(f"SELECT COUNT(*) FROM {table_name}").fetchone()[0]
                    logger.info(f"Table {table_name} already exists with {count:,} rows. Skipping load.")
                    continue
                
                suffix = path.suffix.lower()

                if suffix == ".csv":
                    df = pd.read_csv(path)
                elif suffix in {".xlsx", ".xls"}:
                    df = pd.read_excel(path, engine="openpyxl")
                else:
                    # JSON support:
                    # 1) list[object] -> one table (file stem)
                    # 2) dict[str, list[object]] -> multiple tables (key names)
                    # 3) dict -> single-row table (file stem)
                    import json

                    with path.open("r", encoding="utf-8-sig") as f:
                        payload = json.load(f)

                    if isinstance(payload, list):
                        df = pd.DataFrame(payload)
                    elif isinstance(payload, dict):
                        list_entries = {k: v for k, v in payload.items() if isinstance(v, list)}
                        scalar_entries = {k: v for k, v in payload.items() if not isinstance(v, list)}

                        # Materialize each list as its own table (for master dataset files)
                        for key, value in list_entries.items():
                            nested_table = str(key).strip().lower().replace(" ", "_").replace("-", "_")
                            nested_df = pd.DataFrame(value)
                            nested_df.columns = [
                                str(col).strip().lower().replace(" ", "_").replace("(", "").replace(")", "")
                                for col in nested_df.columns
                            ]
                            self.conn.execute(f"DROP TABLE IF EXISTS {nested_table}")
                            self.conn.execute(f"CREATE TABLE {nested_table} AS SELECT * FROM nested_df")
                            nested_count = self.conn.execute(f"SELECT COUNT(*) FROM {nested_table}").fetchone()[0]
                            logger.info(f"Loaded {nested_table}: {nested_count} rows from {path.name}")

                        # Preserve summary-style scalar dicts as one-row tables
                        if scalar_entries:
                            df = pd.DataFrame([scalar_entries])
                        else:
                            # No single-table content left for this file
                            continue
                    else:
                        logger.warning(f"Skipping unsupported JSON shape in {path.name}")
                        continue

                df.columns = [
                    str(col).strip().lower().replace(" ", "_").replace("(", "").replace(")", "")
                    for col in df.columns
                ]

                self.conn.execute(f"DROP TABLE IF EXISTS {table_name}")
                self.conn.execute(f"CREATE TABLE {table_name} AS SELECT * FROM df")
                row_count = self.conn.execute(f"SELECT COUNT(*) FROM {table_name}").fetchone()[0]
                logger.info(f"Loaded {table_name}: {row_count} rows from {path.name}")

            self._loaded = True
            logger.info("Data service initialized successfully")

        except Exception as e:
            logger.error(f"Failed to load data: {e}")
            raise

    def get_table_schemas(self) -> dict:
        """Get column names and types for all loaded tables."""
        schemas = {}
        tables = self.conn.execute("SHOW TABLES").fetchall()
        for (table_name,) in tables:
            columns = self.conn.execute(f"DESCRIBE {table_name}").fetchall()
            schemas[table_name] = [
                {"name": col[0], "type": str(col[1])} for col in columns
            ]
        return schemas

    def get_table_schemas_text(self) -> str:
        """Get a formatted text representation of all table schemas."""
        schemas = self.get_table_schemas()
        lines = []
        for table_name, columns in schemas.items():
            lines.append(f"\n### Table: `{table_name}`")
            lines.append("| Column | Type |")
            lines.append("|--------|------|")
            for col in columns:
                lines.append(f"| {col['name']} | {col['type']} |")
        return "\n".join(lines)

    def get_sample_data(self, table_name: str, limit: int = 5) -> str:
        """Get sample rows from a table as formatted text."""
        try:
            df = self.conn.execute(f"SELECT * FROM {table_name} LIMIT {limit}").fetchdf()
            return df.to_markdown(index=False)
        except Exception as e:
            return f"Error fetching sample: {e}"

    def execute_query(self, sql: str) -> pd.DataFrame:
        """Execute a SQL query and return results as DataFrame."""
        try:
            return self.conn.execute(sql).fetchdf()
        except Exception as e:
            logger.error(f"Query error: {e}")
            raise

    def query_to_markdown(self, sql: str) -> str:
        """Execute query and return results as markdown table."""
        df = self.execute_query(sql)
        if df.empty:
            return "*No data found for this query.*"
        return df.to_markdown(index=False)

    def get_all_data_context(self) -> str:
        """
        Build a comprehensive data context string for the LLM.
        Includes schemas, sample data, and key aggregations.
        """
        context_parts = []

        # Table schemas
        context_parts.append("## Available Data Tables")
        context_parts.append(self.get_table_schemas_text())

        # Sample data from each table
        tables = self.conn.execute("SHOW TABLES").fetchall()
        for (table_name,) in tables:
            context_parts.append(f"\n## Sample Data from `{table_name}` (first 5 rows)")
            context_parts.append(self.get_sample_data(table_name, 5))

        # Summary statistics
        context_parts.append("\n## Summary Statistics")
        for (table_name,) in tables:
            try:
                count = self.conn.execute(f"SELECT COUNT(*) FROM {table_name}").fetchone()[0]
                context_parts.append(f"- `{table_name}`: **{count}** total rows")

                # Get numeric columns for aggregation
                cols = self.conn.execute(f"DESCRIBE {table_name}").fetchall()
                numeric_cols = [
                    col[0] for col in cols
                    if any(t in str(col[1]).upper() for t in ["INT", "FLOAT", "DOUBLE", "DECIMAL", "NUMERIC", "BIGINT"])
                ]
                if numeric_cols:
                    for nc in numeric_cols[:5]:  # Limit to first 5 numeric columns
                        try:
                            stats = self.conn.execute(
                                f"SELECT MIN({nc}), MAX({nc}), ROUND(AVG({nc}), 2), ROUND(SUM({nc}), 2) FROM {table_name}"
                            ).fetchone()
                            context_parts.append(
                                f"  - `{nc}`: min={stats[0]}, max={stats[1]}, avg={stats[2]}, total={stats[3]}"
                            )
                        except Exception:
                            pass
            except Exception as e:
                context_parts.append(f"- `{table_name}`: Error getting stats: {e}")

        return "\n".join(context_parts)

    def get_full_data_dump(self) -> str:
        """
        Dump ALL data as markdown tables for LLM context.
        Only suitable for small datasets (<1000 rows total).
        """
        parts = []
        tables = self.conn.execute("SHOW TABLES").fetchall()
        for (table_name,) in tables:
            count = self.conn.execute(f"SELECT COUNT(*) FROM {table_name}").fetchone()[0]
            if count <= 500:
                parts.append(f"\n## Complete Data: `{table_name}` ({count} rows)")
                df = self.conn.execute(f"SELECT * FROM {table_name}").fetchdf()
                parts.append(df.to_markdown(index=False))
            else:
                parts.append(f"\n## Data: `{table_name}` (showing first 100 of {count} rows)")
                df = self.conn.execute(f"SELECT * FROM {table_name} LIMIT 100").fetchdf()
                parts.append(df.to_markdown(index=False))
        return "\n".join(parts)

    def get_column_values(self, table_name: str, column_name: str) -> list:
        """Get distinct values for a column."""
        try:
            result = self.conn.execute(
                f"SELECT DISTINCT {column_name} FROM {table_name} ORDER BY {column_name}"
            ).fetchall()
            return [row[0] for row in result]
        except Exception:
            return []


# Singleton instance
_data_service: DataService | None = None


def get_data_service() -> DataService:
    """Get the singleton DataService instance."""
    global _data_service
    if _data_service is None:
        raise RuntimeError("DataService not initialized. Call init_data_service() first.")
    return _data_service


def init_data_service(data_dir: Path) -> DataService:
    """Initialize and return the DataService singleton."""
    global _data_service
    _data_service = DataService(data_dir)
    _data_service.load_data()
    return _data_service
