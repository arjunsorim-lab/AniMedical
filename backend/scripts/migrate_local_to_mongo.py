"""
One-time migration: local DuckDB -> MongoDB Atlas

Usage:
  python backend/scripts/migrate_local_to_mongo.py

Reads:
  - DATA_DIR/voxa_system.duckdb
Writes:
  - MongoDB collections configured via env:
      MONGO_URI, MONGO_DB_NAME, MONGO_USERS_COLLECTION, MONGO_CHATS_COLLECTION
"""

from __future__ import annotations

import json
from pathlib import Path

import duckdb
from pymongo import MongoClient

try:
    from backend.config import (
        DATA_DIR,
        MONGO_URI,
        MONGO_DB_NAME,
        MONGO_USERS_COLLECTION,
        MONGO_CHATS_COLLECTION,
    )
except ImportError:
    from config import (
        DATA_DIR,
        MONGO_URI,
        MONGO_DB_NAME,
        MONGO_USERS_COLLECTION,
        MONGO_CHATS_COLLECTION,
    )


def _parse_json_field(value):
    if isinstance(value, str):
        try:
            return json.loads(value)
        except Exception:
            return {}
    if isinstance(value, dict):
        return value
    return {}


def migrate():
    if not MONGO_URI:
        raise RuntimeError("MONGO_URI is empty. Set it in backend/.env before migration.")

    db_path = Path(DATA_DIR) / "voxa_system.duckdb"
    if not db_path.exists():
        raise FileNotFoundError(f"DuckDB file not found: {db_path}")

    conn = duckdb.connect(str(db_path))
    client = MongoClient(MONGO_URI)
    db = client[MONGO_DB_NAME]
    users_col = db[MONGO_USERS_COLLECTION]
    chats_col = db[MONGO_CHATS_COLLECTION]

    users_col.create_index("id", unique=True)
    users_col.create_index("email", unique=True)
    users_col.create_index("username", unique=True)
    chats_col.create_index("user_id", unique=True)

    users_rows = conn.execute(
        "SELECT id, name, username, email, password, role, profile_pic, created_at FROM users"
    ).fetchall()
    chat_rows = conn.execute(
        "SELECT user_id, conversations, updated_at FROM chats"
    ).fetchall()

    migrated_users = 0
    for row in users_rows:
        doc = {
            "id": str(row[0]),
            "name": row[1],
            "username": row[2],
            "email": row[3],
            "password": row[4],
            "role": row[5],
            "profile_pic": row[6],
            "created_at": row[7],
        }
        users_col.update_one({"id": doc["id"]}, {"$set": doc}, upsert=True)
        migrated_users += 1

    migrated_chats = 0
    for row in chat_rows:
        conversations = _parse_json_field(row[1])
        doc = {
            "user_id": str(row[0]),
            "conversations": conversations,
            "updated_at": row[2],
        }
        chats_col.update_one({"user_id": doc["user_id"]}, {"$set": doc}, upsert=True)
        migrated_chats += 1

    conn.close()
    client.close()

    print(f"Migration complete: users={migrated_users}, chats={migrated_chats}")


if __name__ == "__main__":
    migrate()

