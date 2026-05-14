"""
Context-aware chat orchestration.

This wrapper keeps the existing automotive agent intact while adding:
1. session memory retrieval
2. follow-up query rewriting
3. structured prompt context injection
4. post-response memory persistence
"""

from __future__ import annotations

from typing import AsyncGenerator

try:
    from backend.agents.automotive_agent import process_query, stream_query
    from backend.services.memory_manager import get_memory_manager
    from backend.services import llm_service
    from backend.services.query_rewriter import (
        build_prompt_context,
        extract_structured_memory,
        is_followup,
        rewrite_query,
    )
except ImportError:
    from agents.automotive_agent import process_query, stream_query
    from services.memory_manager import get_memory_manager
    from services import llm_service
    from services.query_rewriter import (
        build_prompt_context,
        extract_structured_memory,
        is_followup,
        rewrite_query,
    )

HEALTHCARE_DIRECT_TERMS = (
    "pending payment",
    "payment pending",
    "overdue payment",
    "billing pending",
    "active patient",
    "critical patient",
    "patient outcome",
    "patients per doctor",
    "revenue by service",
)


def _is_direct_healthcare_request(query: str) -> bool:
    q = (query or "").lower()
    return any(term in q for term in HEALTHCARE_DIRECT_TERMS)


def _generate_clarification_with_llm(query: str, conversation_history: list[dict] | None = None) -> str:
    prompt = (
        "The user sent a follow-up that appears context-dependent. "
        "Politely ask a short clarification question to identify intended healthcare scope. "
        "Keep it concise and helpful."
    )
    try:
        return llm_service.generate_response(
            user_query=query,
            data_context=prompt,
            conversation_history=conversation_history,
        )
    except Exception:
        return "Could you clarify which healthcare area you want this applied to?"


async def process_contextual_query(
    query: str,
    session_id: str,
    conversation_history: list[dict] | None = None,
) -> dict:
    memory = get_memory_manager()
    followup = is_followup(query)
    context_block = memory.get_context_block(session_id, query) if followup else None
    rewrite = rewrite_query(query, context_block or {"previous_context": [], "current_query": query})

    if rewrite.needs_clarification and not _is_direct_healthcare_request(query):
        response = _generate_clarification_with_llm(query, conversation_history)
        memory.append_interaction(
            session_id=session_id,
            user_query=query,
            refined_query=query,
            generated_query=None,
            response=response,
            structured_memory=rewrite.structured_memory or extract_structured_memory(query),
            metadata={"rewrite_reason": rewrite.reason, "needs_clarification": True},
        )
        return {
            "response": response,
            "refined_query": query,
            "context_used": context_block,
            "was_rewritten": False,
        }

    refined_query = rewrite.refined_query
    injected_history = None
    if followup:
        injected_history = _merge_histories(
            build_prompt_context(context_block or {}, refined_query),
            conversation_history,
        )
    response = await process_query(refined_query, injected_history)

    memory.append_interaction(
        session_id=session_id,
        user_query=query,
        refined_query=refined_query,
        generated_query=refined_query,
        response=response,
        structured_memory=rewrite.structured_memory or extract_structured_memory(refined_query),
        metadata={
            "is_followup": followup,
            "rewrite_reason": rewrite.reason,
            "was_rewritten": rewrite.was_rewritten,
            "context_used": followup,
        },
    )

    return {
        "response": response,
        "refined_query": refined_query,
        "context_used": context_block if followup else None,
        "was_rewritten": rewrite.was_rewritten,
    }


async def stream_contextual_query(
    query: str,
    session_id: str,
    conversation_history: list[dict] | None = None,
) -> AsyncGenerator[str, None]:
    memory = get_memory_manager()
    followup = is_followup(query)
    context_block = memory.get_context_block(session_id, query) if followup else None
    rewrite = rewrite_query(query, context_block or {"previous_context": [], "current_query": query})

    if rewrite.needs_clarification and not _is_direct_healthcare_request(query):
        response = _generate_clarification_with_llm(query, conversation_history)
        memory.append_interaction(
            session_id=session_id,
            user_query=query,
            refined_query=query,
            generated_query=None,
            response=response,
            structured_memory=rewrite.structured_memory or extract_structured_memory(query),
            metadata={"rewrite_reason": rewrite.reason, "needs_clarification": True},
        )
        yield response
        return

    refined_query = rewrite.refined_query
    injected_history = None
    if followup:
        injected_history = _merge_histories(
            build_prompt_context(context_block or {}, refined_query),
            conversation_history,
        )

    chunks: list[str] = []
    async for token in stream_query(refined_query, injected_history):
        chunks.append(token)
        yield token

    response = "".join(chunks)
    memory.append_interaction(
        session_id=session_id,
        user_query=query,
        refined_query=refined_query,
        generated_query=refined_query,
        response=response,
        structured_memory=rewrite.structured_memory or extract_structured_memory(refined_query),
        metadata={
            "is_followup": followup,
            "rewrite_reason": rewrite.reason,
            "was_rewritten": rewrite.was_rewritten,
            "context_used": followup,
        },
    )


def _merge_histories(
    memory_history: list[dict],
    client_history: list[dict] | None,
) -> list[dict]:
    history: list[dict] = []
    history.extend(memory_history)
    if client_history:
        history.extend(client_history[-8:])
    return history
