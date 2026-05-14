import duckdb
from pathlib import Path
import logging
import json
from typing import Dict, Any, Optional
from datetime import datetime

try:
    from pymongo import MongoClient
    from pymongo.errors import PyMongoError
except Exception:  # optional dependency for local-only setups
    MongoClient = None
    PyMongoError = Exception

logger = logging.getLogger("voxa.chat")

class ChatService:
    def __init__(self, db_path: Path):
        self.db_path = db_path
        self._init_db()

    def _init_db(self):
        """Initialize the chats table if it doesn't exist."""
        conn = duckdb.connect(str(self.db_path))
        try:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS chats (
                    user_id VARCHAR,
                    conversations JSON,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    PRIMARY KEY (user_id)
                )
            """)
        finally:
            conn.close()

    def get_user_chats(self, user_id: str) -> Dict[str, Any]:
        conn = duckdb.connect(str(self.db_path))
        try:
            res = conn.execute("SELECT conversations FROM chats WHERE user_id = ?", [user_id]).fetchone()
            if res:
                # DuckDB JSON type returns a string or a dict depending on driver/version
                val = res[0]
                if isinstance(val, str):
                    return json.loads(val)
                return val
            return {}
        finally:
            conn.close()

    def sync_user_chats(self, user_id: str, conversations: Dict[str, Any]):
        conn = duckdb.connect(str(self.db_path))
        try:
            # We use a full replace (UPSERT) for the user's conversation map
            # This allows clearing all chats if an empty dict is passed
            conversations_json = json.dumps(conversations)
            
            # Check if exists
            exists = conn.execute("SELECT 1 FROM chats WHERE user_id = ?", [user_id]).fetchone()
            if exists:
                conn.execute("""
                    UPDATE chats SET conversations = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?
                """, [conversations_json, user_id])
            else:
                conn.execute("""
                    INSERT INTO chats (user_id, conversations) VALUES (?, ?)
                """, [user_id, conversations_json])
        finally:
            conn.close()


class MongoChatService:
    def __init__(self, mongo_uri: str, db_name: str, collection_name: str = "chats"):
        if not mongo_uri:
            raise ValueError("MONGO_URI is required when DATA_BACKEND=mongo")
        if MongoClient is None:
            raise RuntimeError("pymongo is not installed. Please install pymongo.")
        self.client = MongoClient(mongo_uri)
        self.db = self.client[db_name]
        self.col = self.db[collection_name]
        self._init_collection()

    def _init_collection(self):
        # One chat document per user, same contract as DuckDB service.
        self.col.create_index("user_id", unique=True)
        self.col.create_index("updated_at")

    def get_user_chats(self, user_id: str) -> Dict[str, Any]:
        try:
            doc = self.col.find_one({"user_id": str(user_id)}, {"_id": 0, "conversations": 1})
            if not doc:
                return {}
            conversations = doc.get("conversations", {})
            return conversations if isinstance(conversations, dict) else {}
        except PyMongoError as e:
            logger.error(f"Mongo get_user_chats failed: {e}")
            return {}

    def sync_user_chats(self, user_id: str, conversations: Dict[str, Any]):
        try:
            self.col.update_one(
                {"user_id": str(user_id)},
                {
                    "$set": {
                        "conversations": conversations or {},
                        "updated_at": datetime.utcnow(),
                    },
                    "$setOnInsert": {"user_id": str(user_id), "created_at": datetime.utcnow()},
                },
                upsert=True,
            )
        except PyMongoError as e:
            logger.error(f"Mongo sync_user_chats failed: {e}")
            raise

_chat_service = None

def get_chat_service(db_path: Optional[Path] = None) -> ChatService:
    global _chat_service
    if _chat_service is None:
        try:
            from backend.config import DATA_BACKEND, DATA_DIR, MONGO_URI, MONGO_DB_NAME, MONGO_CHATS_COLLECTION
        except ImportError:
            from config import DATA_BACKEND, DATA_DIR, MONGO_URI, MONGO_DB_NAME, MONGO_CHATS_COLLECTION

        if DATA_BACKEND == "mongo":
            _chat_service = MongoChatService(
                mongo_uri=MONGO_URI,
                db_name=MONGO_DB_NAME,
                collection_name=MONGO_CHATS_COLLECTION,
            )
        else:
            if db_path is None:
                db_path = DATA_DIR / "voxa_system.duckdb" # Use a shared system DB
            _chat_service = ChatService(db_path)
    return _chat_service
