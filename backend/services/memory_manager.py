"""
Session-scoped conversation memory for the chat pipeline.

The LLM provider is stateless, so this module owns the short-term memory
buffer that is injected before each model/agent call. Redis is used when
configured and available; otherwise an in-process store keeps local dev fast.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
import json
import logging
from threading import RLock
from typing import Any

try:
    from backend.config import (
        MEMORY_BACKEND,
        MEMORY_COMPRESSION_THRESHOLD,
        MEMORY_CONTEXT_WINDOW,
        MEMORY_MAX_INTERACTIONS,
        REDIS_URL,
    )
except ImportError:
    from config import (
        MEMORY_BACKEND,
        MEMORY_COMPRESSION_THRESHOLD,
        MEMORY_CONTEXT_WINDOW,
        MEMORY_MAX_INTERACTIONS,
        REDIS_URL,
    )

logger = logging.getLogger("voxa.memory")


@dataclass
class MemoryInteraction:
    user_query: str
    refined_query: str
    generated_query: str | None
    response: str
    structured_memory: dict[str, Any] = field(default_factory=dict)
    created_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass
class ConversationMemory:
    session_id: str
    summary: str = ""
    interactions: list[MemoryInteraction] = field(default_factory=list)
    updated_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class ConversationMemoryManager:
    def __init__(
        self,
        context_window: int = MEMORY_CONTEXT_WINDOW,
        max_interactions: int = MEMORY_MAX_INTERACTIONS,
        compression_threshold: int = MEMORY_COMPRESSION_THRESHOLD,
        redis_url: str = REDIS_URL,
        backend: str = MEMORY_BACKEND,
    ):
        self.context_window = max(1, context_window)
        self.max_interactions = max(self.context_window, max_interactions)
        self.compression_threshold = max(self.context_window + 1, compression_threshold)
        self.redis_client = self._init_redis(redis_url, backend)
        self._store: dict[str, ConversationMemory] = {}
        self._lock = RLock()

    def _init_redis(self, redis_url: str, backend: str):
        if backend != "redis" or not redis_url:
            return None
        try:
            import redis

            client = redis.Redis.from_url(redis_url, decode_responses=True)
            client.ping()
            logger.info("Conversation memory using Redis")
            return client
        except Exception as exc:
            logger.warning("Redis memory unavailable, falling back to in-memory store: %s", exc)
            return None

    def get_memory(self, session_id: str) -> ConversationMemory:
        if self.redis_client:
            raw = self.redis_client.get(self._key(session_id))
            if raw:
                return self._deserialize(raw)
            return ConversationMemory(session_id=session_id)

        with self._lock:
            return self._store.get(session_id, ConversationMemory(session_id=session_id))

    def get_recent_context(self, session_id: str, limit: int | None = None) -> list[dict[str, Any]]:
        memory = self.get_memory(session_id)
        count = limit or self.context_window
        return [self._interaction_to_context(item) for item in memory.interactions[-count:]]

    def get_context_block(self, session_id: str, current_query: str) -> dict[str, Any]:
        memory = self.get_memory(session_id)
        return {
            "conversation_summary": memory.summary,
            "previous_context": self.get_recent_context(session_id),
            "current_query": current_query,
        }

    def append_interaction(
        self,
        session_id: str,
        user_query: str,
        refined_query: str,
        response: str,
        generated_query: str | None = None,
        structured_memory: dict[str, Any] | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> ConversationMemory:
        memory = self.get_memory(session_id)
        memory.interactions.append(
            MemoryInteraction(
                user_query=user_query,
                refined_query=refined_query,
                generated_query=generated_query,
                response=response,
                structured_memory=structured_memory or self._extract_key_entities(refined_query or user_query),
                metadata=metadata or {},
            )
        )
        memory.updated_at = datetime.now(timezone.utc).isoformat()
        memory = self._compress_if_needed(memory)
        self._save(memory)
        return memory

    def clear(self, session_id: str) -> None:
        if self.redis_client:
            self.redis_client.delete(self._key(session_id))
            return
        with self._lock:
            self._store.pop(session_id, None)

    def _compress_if_needed(self, memory: ConversationMemory) -> ConversationMemory:
        if len(memory.interactions) <= self.compression_threshold:
            return memory

        keep_count = self.context_window
        older = memory.interactions[:-keep_count]
        retained = memory.interactions[-keep_count:]
        memory.summary = self._summarize_interactions(memory.summary, older)
        memory.interactions = retained[-self.max_interactions :]
        return memory

    def _summarize_interactions(self, existing_summary: str, interactions: list[MemoryInteraction]) -> str:
        facts: list[str] = []
        for item in interactions:
            entities = self._extract_key_entities(item.refined_query or item.user_query)
            entity_text = ", ".join(f"{key}={value}" for key, value in entities.items() if value)
            if entity_text:
                facts.append(f"{item.refined_query} [{entity_text}]")
            else:
                facts.append(item.refined_query)

        combined = []
        if existing_summary:
            combined.append(existing_summary)
        combined.extend(facts[-12:])
        summary = " | ".join(part for part in combined if part)
        return summary[-3000:]

    def _extract_key_entities(self, query: str) -> dict[str, str | None]:
        text = query.lower()
        metric = next(
            (m for m in ["revenue", "patients", "services", "doctors", "vitals", "alerts", "billing", "operations"] if m in text),
            None,
        )
        aggregation = next(
            (a for a in ["total", "average", "count", "highest", "lowest", "trend"] if a in text),
            None,
        )
        time_filter = None
        for marker in ["q1", "q2", "q3", "q4", "week", "month", "year", "today", "last", "this"]:
            if marker in text:
                time_filter = marker
                break
        return {"metric": metric, "aggregation": aggregation, "time_filter": time_filter}

    def _save(self, memory: ConversationMemory) -> None:
        if self.redis_client:
            self.redis_client.set(self._key(memory.session_id), self._serialize(memory))
            return
        with self._lock:
            self._store[memory.session_id] = memory

    def _interaction_to_context(self, item: MemoryInteraction) -> dict[str, Any]:
        return {
            "query": item.user_query,
            "refined_query": item.refined_query,
            "generated_query": item.generated_query,
            "response": item.response,
            "structured_memory": item.structured_memory,
        }

    def _serialize(self, memory: ConversationMemory) -> str:
        payload = asdict(memory)
        return json.dumps(payload)

    def _deserialize(self, raw: str) -> ConversationMemory:
        payload = json.loads(raw)
        interactions = [MemoryInteraction(**item) for item in payload.get("interactions", [])]
        return ConversationMemory(
            session_id=payload["session_id"],
            summary=payload.get("summary", ""),
            interactions=interactions,
            updated_at=payload.get("updated_at", datetime.now(timezone.utc).isoformat()),
        )

    def _key(self, session_id: str) -> str:
        return f"voxa:memory:{session_id}"


_memory_manager: ConversationMemoryManager | None = None


def get_memory_manager() -> ConversationMemoryManager:
    global _memory_manager
    if _memory_manager is None:
        _memory_manager = ConversationMemoryManager()
    return _memory_manager
