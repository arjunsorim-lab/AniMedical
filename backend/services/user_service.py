import duckdb
from pathlib import Path
import logging
from typing import Optional, Dict, Any
from datetime import datetime
import uuid

try:
    from pymongo import MongoClient
    from pymongo.errors import DuplicateKeyError, PyMongoError
except Exception:  # optional dependency for local-only setups
    MongoClient = None
    DuplicateKeyError = Exception
    PyMongoError = Exception

logger = logging.getLogger("voxa.users")

class UserService:
    def __init__(self, db_path: Path):
        self.db_path = db_path
        self._init_db()

    def _init_db(self):
        """Initialize the users table if it doesn't exist."""
        conn = duckdb.connect(str(self.db_path))
        try:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS users (
                    id VARCHAR PRIMARY KEY,
                    name VARCHAR,
                    username VARCHAR UNIQUE,
                    email VARCHAR UNIQUE,
                    password VARCHAR,
                    role VARCHAR,
                    profile_pic VARCHAR,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            
            # Check if default user exists
            res = conn.execute("SELECT COUNT(*) FROM users WHERE username = 'user'").fetchone()
            if res[0] == 0:
                logger.info("Initializing default user in database")
                conn.execute("""
                    INSERT INTO users (id, name, username, email, password, role)
                    VALUES ('1', 'Plant Manager', 'user', 'user@voxa.ai', 'password123', 'manager')
                """)
        finally:
            conn.close()

    def get_user_by_email_or_username(self, identifier: str) -> Optional[Dict[str, Any]]:
        conn = duckdb.connect(str(self.db_path))
        try:
            res = conn.execute("""
                SELECT id, name, username, email, password, role, profile_pic 
                FROM users 
                WHERE email = ? OR username = ?
            """, [identifier, identifier]).fetchone()
            
            if res:
                return {
                    "id": res[0],
                    "name": res[1],
                    "username": res[2],
                    "email": res[3],
                    "password": res[4],
                    "role": res[5],
                    "profile_pic": res[6]
                }
            return None
        finally:
            conn.close()

    def create_user(self, name: str, username: str, email: str, password: str) -> Dict[str, Any]:
        conn = duckdb.connect(str(self.db_path))
        try:
            new_id = str(conn.execute("SELECT COUNT(*) + 1 FROM users").fetchone()[0])
            conn.execute("""
                INSERT INTO users (id, name, username, email, password, role)
                VALUES (?, ?, ?, ?, ?, 'user')
            """, [new_id, name, username, email, password])
            
            return {
                "id": new_id,
                "name": name,
                "username": username,
                "email": email,
                "role": "user",
                "profile_pic": None
            }
        finally:
            conn.close()

    def update_password(self, username: str, new_password: str):
        conn = duckdb.connect(str(self.db_path))
        try:
            conn.execute("""
                UPDATE users SET password = ? WHERE username = ? OR email = ?
            """, [new_password, username, username])
        finally:
            conn.close()

    def update_profile_pic(self, user_id: str, profile_pic_url: str):
        conn = duckdb.connect(str(self.db_path))
        try:
            conn.execute("""
                UPDATE users SET profile_pic = ? WHERE id = ?
            """, [profile_pic_url, user_id])
        finally:
            conn.close()


class MongoUserService:
    def __init__(self, mongo_uri: str, db_name: str, collection_name: str = "users"):
        if not mongo_uri:
            raise ValueError("MONGO_URI is required when DATA_BACKEND=mongo")
        if MongoClient is None:
            raise RuntimeError("pymongo is not installed. Please install pymongo.")
        self.client = MongoClient(mongo_uri)
        self.db = self.client[db_name]
        self.col = self.db[collection_name]
        self._init_collection()

    def _init_collection(self):
        self.col.create_index("email", unique=True)
        self.col.create_index("username", unique=True)
        self.col.create_index("id", unique=True)

        # Seed default user for dev parity with local mode.
        exists = self.col.find_one({"username": "user"})
        if not exists:
            self.col.insert_one({
                "id": "1",
                "name": "Plant Manager",
                "username": "user",
                "email": "user@voxa.ai",
                "password": "password123",
                "role": "manager",
                "profile_pic": None,
                "created_at": datetime.utcnow(),
            })

    def _public_user(self, doc: Dict[str, Any]) -> Dict[str, Any]:
        return {
            "id": str(doc.get("id", "")),
            "name": doc.get("name"),
            "username": doc.get("username"),
            "email": doc.get("email"),
            "password": doc.get("password"),
            "role": doc.get("role", "user"),
            "profile_pic": doc.get("profile_pic"),
        }

    def get_user_by_email_or_username(self, identifier: str) -> Optional[Dict[str, Any]]:
        try:
            doc = self.col.find_one(
                {"$or": [{"email": identifier}, {"username": identifier}]},
                {"_id": 0},
            )
            if not doc:
                return None
            return self._public_user(doc)
        except PyMongoError as e:
            logger.error(f"Mongo get_user_by_email_or_username failed: {e}")
            return None

    def create_user(self, name: str, username: str, email: str, password: str) -> Dict[str, Any]:
        user = {
            "id": uuid.uuid4().hex,
            "name": name,
            "username": username,
            "email": email,
            "password": password,
            "role": "user",
            "profile_pic": None,
            "created_at": datetime.utcnow(),
        }
        try:
            self.col.insert_one(user)
            return {k: v for k, v in user.items() if k != "password"} | {"role": "user"}
        except DuplicateKeyError:
            raise ValueError("Email or username already registered")
        except PyMongoError as e:
            logger.error(f"Mongo create_user failed: {e}")
            raise

    def update_password(self, username: str, new_password: str):
        try:
            self.col.update_one(
                {"$or": [{"username": username}, {"email": username}]},
                {"$set": {"password": new_password, "updated_at": datetime.utcnow()}},
            )
        except PyMongoError as e:
            logger.error(f"Mongo update_password failed: {e}")
            raise

    def update_profile_pic(self, user_id: str, profile_pic_url: str):
        try:
            self.col.update_one(
                {"id": str(user_id)},
                {"$set": {"profile_pic": profile_pic_url, "updated_at": datetime.utcnow()}},
            )
        except PyMongoError as e:
            logger.error(f"Mongo update_profile_pic failed: {e}")
            raise

_user_service = None

def get_user_service(db_path: Optional[Path] = None) -> UserService:
    global _user_service
    if _user_service is None:
        try:
            from backend.config import DATA_BACKEND, DATA_DIR, MONGO_URI, MONGO_DB_NAME, MONGO_USERS_COLLECTION
        except ImportError:
            from config import DATA_BACKEND, DATA_DIR, MONGO_URI, MONGO_DB_NAME, MONGO_USERS_COLLECTION

        if DATA_BACKEND == "mongo":
            _user_service = MongoUserService(
                mongo_uri=MONGO_URI,
                db_name=MONGO_DB_NAME,
                collection_name=MONGO_USERS_COLLECTION,
            )
        else:
            if db_path is None:
                db_path = DATA_DIR / "voxa_system.duckdb"
            _user_service = UserService(db_path)
    return _user_service
