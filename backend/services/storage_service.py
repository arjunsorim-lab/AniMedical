from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional
import logging
try:
    from supabase import create_client
except Exception:  # optional when non-supabase backends are used
    create_client = None

logger = logging.getLogger("voxa.storage")


@dataclass
class StoredObject:
    key: str
    url: str
    size: int
    updated_at: Optional[datetime] = None


class LocalStorageService:
    def __init__(self, base_dir: Path):
        self.base_dir = base_dir
        self.base_dir.mkdir(parents=True, exist_ok=True)

    def save_bytes(self, key: str, data: bytes, content_type: str | None = None) -> StoredObject:
        path = self.base_dir / key
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
        normalized_key = key.replace("\\", "/")
        return StoredObject(
            key=key,
            url=f"/uploads/{normalized_key}",
            size=len(data),
            updated_at=datetime.now(timezone.utc),
        )

    def list_prefix(self, prefix: str = "") -> list[StoredObject]:
        root = self.base_dir / prefix
        if not root.exists():
            return []
        items: list[StoredObject] = []
        for p in root.rglob("*"):
            if not p.is_file():
                continue
            rel = p.relative_to(self.base_dir).as_posix()
            stat = p.stat()
            items.append(
                StoredObject(
                    key=rel,
                    url=f"/uploads/{rel}",
                    size=int(stat.st_size),
                    updated_at=datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc),
                )
            )
        items.sort(key=lambda x: x.updated_at or datetime.min.replace(tzinfo=timezone.utc), reverse=True)
        return items


class SupabaseStorageService:
    def __init__(
        self,
        supabase_url: str,
        service_role_key: str,
        bucket: str,
        public_base_url: str = "",
    ):
        if create_client is None:
            raise RuntimeError("supabase is not installed. Please install supabase.")
        if not supabase_url or not service_role_key or not bucket:
            raise ValueError(
                "SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and SUPABASE_STORAGE_BUCKET are required for STORAGE_BACKEND=supabase"
            )
        self.client = create_client(supabase_url, service_role_key)
        self.bucket = bucket
        self.public_base_url = (public_base_url or "").rstrip("/")

    def _build_url(self, key: str) -> str:
        if self.public_base_url:
            return f"{self.public_base_url}/{key}"
        # Falls back to signed path-like URL format from Supabase public storage endpoint.
        # For private buckets, use signed URL generation in app-specific endpoints if needed.
        base = self.client.storage.from_(self.bucket).get_public_url(key)
        return str(base) if base else key

    def save_bytes(self, key: str, data: bytes, content_type: str | None = None) -> StoredObject:
        opts = {"upsert": "true"}
        if content_type:
            opts["content-type"] = content_type
        self.client.storage.from_(self.bucket).upload(path=key, file=data, file_options=opts)
        return StoredObject(
            key=key,
            url=self._build_url(key),
            size=len(data),
            updated_at=datetime.now(timezone.utc),
        )

    def list_prefix(self, prefix: str = "") -> list[StoredObject]:
        # Supabase list works per folder; we derive folder path and filter.
        folder = prefix.rstrip("/")
        parent = str(Path(folder).parent).replace("\\", "/")
        if parent == ".":
            parent = ""
        name_prefix = Path(folder).name

        rows = self.client.storage.from_(self.bucket).list(path=parent or "")
        items: list[StoredObject] = []
        for row in rows or []:
            name = str(row.get("name") or "")
            if not name:
                continue
            key = f"{parent}/{name}" if parent else name
            key = key.strip("/")
            if prefix and not key.startswith(prefix.rstrip("/") + "/") and key != prefix.rstrip("/"):
                continue
            if name_prefix and not (key.startswith(folder + "/") or key == folder):
                continue
            size = int(row.get("metadata", {}).get("size") or row.get("size") or 0)
            updated_raw = row.get("updated_at") or row.get("created_at")
            updated = None
            if isinstance(updated_raw, str):
                try:
                    updated = datetime.fromisoformat(updated_raw.replace("Z", "+00:00"))
                except Exception:
                    updated = None
            items.append(
                StoredObject(
                    key=key,
                    url=self._build_url(key),
                    size=size,
                    updated_at=updated,
                )
            )
        items.sort(key=lambda x: x.updated_at or datetime.min.replace(tzinfo=timezone.utc), reverse=True)
        return items


_storage_service = None


def get_storage_service():
    global _storage_service
    if _storage_service is not None:
        return _storage_service

    try:
        from backend.config import (
            DATA_DIR,
            STORAGE_BACKEND,
            SUPABASE_URL,
            SUPABASE_SERVICE_ROLE_KEY,
            SUPABASE_STORAGE_BUCKET,
            SUPABASE_PUBLIC_BASE_URL,
        )
    except ImportError:
        from config import (
            DATA_DIR,
            STORAGE_BACKEND,
            SUPABASE_URL,
            SUPABASE_SERVICE_ROLE_KEY,
            SUPABASE_STORAGE_BUCKET,
            SUPABASE_PUBLIC_BASE_URL,
        )

    if STORAGE_BACKEND == "supabase":
        try:
            _storage_service = SupabaseStorageService(
                supabase_url=SUPABASE_URL,
                service_role_key=SUPABASE_SERVICE_ROLE_KEY,
                bucket=SUPABASE_STORAGE_BUCKET,
                public_base_url=SUPABASE_PUBLIC_BASE_URL,
            )
            logger.info("Storage backend initialized: supabase")
            return _storage_service
        except Exception as e:
            logger.warning(f"Failed to initialize supabase storage backend; falling back to local. reason={e}")

    _storage_service = LocalStorageService(base_dir=Path(DATA_DIR) / "uploads")
    logger.info("Storage backend initialized: local")
    return _storage_service
