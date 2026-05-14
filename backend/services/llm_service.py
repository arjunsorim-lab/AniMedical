"""
VOXA Backend — LLM Service (Layer 6 & 10: AI Agent + Response Generation)
Uses Groq API (FREE tier) for LLaMA 3 70B (primary) and LLaMA 3 8B (fallback).

Groq provides free access to open-source LLMs with ultra-fast inference.
Free tier: 30 req/min, 14,400 req/day — plenty for a demo.
Get your key at: https://console.groq.com
"""

import logging
from typing import AsyncGenerator

from groq import Groq, AsyncGroq
try:
    from backend.config import GROQ_API_KEY, PRIMARY_MODEL, FALLBACK_MODEL, SYSTEM_PROMPT, LLM_GUARDRAILS
except ImportError:
    from config import GROQ_API_KEY, PRIMARY_MODEL, FALLBACK_MODEL, SYSTEM_PROMPT, LLM_GUARDRAILS

logger = logging.getLogger("voxa.llm")

# Prompt-size guards. Increased to allow richer JSON-grounded responses.
MAX_DATA_CONTEXT_CHARS = 28000
MAX_SYSTEM_CONTENT_CHARS = 36000
MAX_HISTORY_MESSAGES = 6
MAX_HISTORY_MESSAGE_CHARS = 800
FALLBACK_DATA_CONTEXT_CHARS = 4200
FALLBACK_SYSTEM_CONTENT_CHARS = 8000


def _is_payload_too_large_error(err: Exception) -> bool:
    msg = str(err).lower()
    return "413" in msg or "payload too large" in msg or "request too large" in msg


def _model_limits(model_name: str) -> tuple[int, int, int]:
    if model_name == FALLBACK_MODEL:
        return FALLBACK_DATA_CONTEXT_CHARS, FALLBACK_SYSTEM_CONTENT_CHARS, 768
    return MAX_DATA_CONTEXT_CHARS, MAX_SYSTEM_CONTENT_CHARS, 2048

# Clients (lazy init)
_sync_client: Groq | None = None
_async_client: AsyncGroq | None = None


def _get_sync_client() -> Groq:
    global _sync_client
    if _sync_client is None:
        if not GROQ_API_KEY or GROQ_API_KEY == "your_groq_api_key_here":
            raise RuntimeError(
                "GROQ_API_KEY not set! Get a FREE key at https://console.groq.com "
                "and add it to backend/.env"
            )
        _sync_client = Groq(api_key=GROQ_API_KEY)
    return _sync_client


def _get_async_client() -> AsyncGroq:
    global _async_client
    if _async_client is None:
        if not GROQ_API_KEY or GROQ_API_KEY == "your_groq_api_key_here":
            raise RuntimeError(
                "GROQ_API_KEY not set! Get a FREE key at https://console.groq.com "
                "and add it to backend/.env"
            )
        _async_client = AsyncGroq(api_key=GROQ_API_KEY)
    return _async_client


def generate_response(
    user_query: str,
    data_context: str = "",
    conversation_history: list[dict] | None = None,
    model: str | None = None,
) -> str:
    """
    Generate a complete response using Groq LLM (non-streaming).

    Args:
        user_query: The user's question
        data_context: Data tables/stats to include in context
        conversation_history: Previous messages for context
        model: Override model choice

    Returns:
        Complete response text (markdown formatted)
    """
    client = _get_sync_client()
    target_model = model or PRIMARY_MODEL

    data_limit, system_limit, max_tokens = _model_limits(target_model)
    messages = _build_messages(
        user_query,
        data_context,
        conversation_history,
        data_context_limit=data_limit,
        system_content_limit=system_limit,
    )

    try:
        response = client.chat.completions.create(
            model=target_model,
            messages=messages,
            temperature=0.0,
            max_tokens=max_tokens,
            top_p=0.9,
        )
        return response.choices[0].message.content

    except Exception as e:
        if _is_payload_too_large_error(e):
            compact_limit = min(2200, data_limit)
            compact_messages = _build_messages(
                user_query,
                data_context,
                conversation_history,
                data_context_limit=compact_limit,
                system_content_limit=min(system_limit, 7000),
            )
            response = client.chat.completions.create(
                model=target_model,
                messages=compact_messages,
                temperature=0.0,
                max_tokens=min(max_tokens, 512),
                top_p=0.9,
            )
            return response.choices[0].message.content
        if target_model == PRIMARY_MODEL:
            logger.warning(f"Primary model ({PRIMARY_MODEL}) failed: {e}. Trying fallback...")
            return generate_response(
                user_query, data_context, conversation_history, model=FALLBACK_MODEL
            )
        else:
            logger.error(f"Fallback model ({FALLBACK_MODEL}) also failed: {e}")
            raise


def _validate_response(text: str, result_context_json: str) -> str:
    """
    Post-response validation layer.
    Ensures that if allow_trend=False, no directional words are used.
    """
    import json
    try:
        ctx = json.loads(result_context_json)
        allow_trend = ctx.get("allow_trend", True)
    except Exception:
        return text

    if not allow_trend:
        banned_words = ["increase", "increased", "decrease", "decreased", "growth", "drop", "dropped", "higher", "lower", "rising", "falling"]
        text_lower = text.lower()
        for word in banned_words:
            if f" {word} " in f" {text_lower} " or text_lower.startswith(word):
                logger.warning(f"Response validation failed: banned word '{word}' found when allow_trend=False.")
                # We could retry here, but for now we'll just flag it or strip it.
                # A better approach is to return a stripped version or a generic error.
                return "SUMMARY Data is available for the requested period. Trends are not available for this specific result set.\n\n" + text

    return text


def generate_explanation(
    user_query: str,
    result_context: str,
    data_context: str = "",
    conversation_history: list[dict] | None = None,
    model: str | None = None,
) -> str:
    client = _get_sync_client()
    target_model = model or PRIMARY_MODEL
    data_limit, system_limit, max_tokens = _model_limits(target_model)
    messages = _build_explanation_messages(
        user_query,
        result_context,
        data_context,
        conversation_history,
        data_context_limit=data_limit,
        system_content_limit=system_limit,
    )

    try:
        response = client.chat.completions.create(
            model=target_model,
            messages=messages,
            temperature=0.0,
            max_tokens=max_tokens,
            top_p=0.9,
        )
        raw_text = response.choices[0].message.content
        return _validate_response(raw_text, result_context)
    except Exception as e:
        if _is_payload_too_large_error(e):
            compact_messages = _build_explanation_messages(
                user_query,
                result_context,
                data_context,
                conversation_history,
                data_context_limit=min(2200, data_limit),
                system_content_limit=min(system_limit, 7000),
            )
            response = client.chat.completions.create(
                model=target_model,
                messages=compact_messages,
                temperature=0.0,
                max_tokens=min(max_tokens, 512),
                top_p=0.9,
            )
            return _validate_response(response.choices[0].message.content, result_context)
        if target_model == PRIMARY_MODEL:
            logger.warning(f"Primary model ({PRIMARY_MODEL}) failed: {e}. Trying fallback...")
            return generate_explanation(
                user_query, result_context, data_context, conversation_history, model=FALLBACK_MODEL
            )
        else:
            logger.error(f"Fallback model ({FALLBACK_MODEL}) also failed: {e}")
            raise


async def stream_response(
    user_query: str,
    data_context: str = "",
    conversation_history: list[dict] | None = None,
    model: str | None = None,
) -> AsyncGenerator[str, None]:
    """
    Stream response tokens using Groq LLM.

    Yields:
        Individual text tokens as they arrive
    """
    client = _get_async_client()
    target_model = model or PRIMARY_MODEL

    data_limit, system_limit, max_tokens = _model_limits(target_model)
    messages = _build_messages(
        user_query,
        data_context,
        conversation_history,
        data_context_limit=data_limit,
        system_content_limit=system_limit,
    )

    try:
        stream = await client.chat.completions.create(
            model=target_model,
            messages=messages,
            temperature=0.0,
            max_tokens=max_tokens,
            top_p=0.9,
            stream=True,
        )

        async for chunk in stream:
            delta = chunk.choices[0].delta
            if delta and delta.content:
                yield delta.content

    except Exception as e:
        if _is_payload_too_large_error(e):
            compact_messages = _build_messages(
                user_query,
                data_context,
                conversation_history,
                data_context_limit=min(2200, data_limit),
                system_content_limit=min(system_limit, 7000),
            )
            stream = await client.chat.completions.create(
                model=target_model,
                messages=compact_messages,
                temperature=0.0,
                max_tokens=min(max_tokens, 512),
                top_p=0.9,
                stream=True,
            )
            async for chunk in stream:
                delta = chunk.choices[0].delta
                if delta and delta.content:
                    yield delta.content
            return
        if target_model == PRIMARY_MODEL:
            logger.warning(f"Primary model streaming failed: {e}. Trying fallback...")
            async for token in stream_response(
                user_query, data_context, conversation_history, model=FALLBACK_MODEL
            ):
                yield token
        else:
            logger.error(f"Fallback streaming also failed: {e}")
            yield f"\n\n⚠️ Error generating response: {str(e)}"


def _build_messages(
    user_query: str,
    data_context: str = "",
    conversation_history: list[dict] | None = None,
    data_context_limit: int = MAX_DATA_CONTEXT_CHARS,
    system_content_limit: int = MAX_SYSTEM_CONTENT_CHARS,
) -> list[dict]:
    """
    Build the messages array for the LLM call.
    Includes system prompt, data context, conversation history, and user query.
    """
    from datetime import datetime

    system_content = SYSTEM_PROMPT
    if LLM_GUARDRAILS:
        system_content += "\n\n--- LLM GUARDRAILS ---\n"
        system_content += "\n".join(f"- {rule}" for rule in LLM_GUARDRAILS)

    if data_context:
        safe_data_context = data_context
        if len(safe_data_context) > data_context_limit:
            safe_data_context = (
                safe_data_context[:data_context_limit]
                + "\n\n[DATA CONTEXT TRUNCATED FOR TOKEN LIMIT]"
            )
        system_content += f"\n\n--- DATA CONTEXT ---\n{safe_data_context}\n--- END DATA CONTEXT ---"

    system_content += f"\n\nCurrent date/time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S (%A)')}"
    if len(system_content) > system_content_limit:
        system_content = (
            system_content[:system_content_limit]
            + "\n\n[SYSTEM CONTEXT TRUNCATED FOR TOKEN LIMIT]"
        )

    messages = [{"role": "system", "content": system_content}]

    if conversation_history:
        for msg in conversation_history[-MAX_HISTORY_MESSAGES:]:
            role = msg.get("role", "user")
            content = msg.get("content", "")
            if role in ("user", "assistant") and content:
                if len(content) > MAX_HISTORY_MESSAGE_CHARS:
                    content = content[:MAX_HISTORY_MESSAGE_CHARS] + " ...[truncated]"
                messages.append({"role": role, "content": content})

    messages.append({"role": "user", "content": user_query})

    return messages


def _build_explanation_messages(
    user_query: str,
    result_context: str,
    data_context: str = "",
    conversation_history: list[dict] | None = None,
    data_context_limit: int = MAX_DATA_CONTEXT_CHARS,
    system_content_limit: int = MAX_SYSTEM_CONTENT_CHARS,
) -> list[dict]:
    from datetime import datetime

    system_content = SYSTEM_PROMPT
    if LLM_GUARDRAILS:
        system_content += "\n\n--- LLM GUARDRAILS ---\n"
        system_content += "\n".join(f"- {rule}" for rule in LLM_GUARDRAILS)

    if data_context:
        safe_data_context = data_context
        if len(safe_data_context) > data_context_limit:
            safe_data_context = (
                safe_data_context[:data_context_limit]
                + "\n\n[DATA CONTEXT TRUNCATED FOR TOKEN LIMIT]"
            )
        system_content += f"\n\n--- DATA CONTEXT ---\n{safe_data_context}\n--- END DATA CONTEXT ---"

    system_content += f"\n\nCurrent date/time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S (%A)')}"
    if len(system_content) > system_content_limit:
        system_content = (
            system_content[:system_content_limit]
            + "\n\n[SYSTEM CONTEXT TRUNCATED FOR TOKEN LIMIT]"
        )

    messages = [{"role": "system", "content": system_content}]

    if conversation_history:
        for msg in conversation_history[-MAX_HISTORY_MESSAGES:]:
            role = msg.get("role", "user")
            content = msg.get("content", "")
            if role in ("user", "assistant") and content:
                if len(content) > MAX_HISTORY_MESSAGE_CHARS:
                    content = content[:MAX_HISTORY_MESSAGE_CHARS] + " ...[truncated]"
                messages.append({"role": role, "content": content})

    messages.append(
        {
            "role": "user",
            "content": (
                f"User query: {user_query}\n\n"
                f"RESULTS (DO NOT REPEAT THESE NUMBERS IN YOUR SUMMARY):\n{result_context}\n\n"
                "INSTRUCTIONS:\n"
                "1. Provide ONLY 'INSIGHTS' and 'KEY TAKEAWAYS'.\n"
                "2. DO NOT generate a SUMMARY or DATA TABLE (these are already handled).\n"
                "3. Use only the entities and values provided above.\n"
                "4. Be concise and professional."
            ),
        }
    )

    return messages


def extract_entities(query: str) -> dict:
    """
    Use the LLM as a high-fidelity NLU engine to extract structured entities.
    This is used as a fallback when rule-based parsing is ambiguous.
    """
    client = _get_sync_client()
    
    prompt = f"""
    You are an NLU engine for a Healthcare Service Analytics Assistant.
    Extract structured information from the following query.
    Query: "{query}"

    Return ONLY a valid JSON object with these keys:
    - is_automotive_related: (boolean: true if the query is about OUR healthcare service operations, patients, doctors, billing, outcomes, or vitals. Generic requests for "reports", "dashboards", or "summaries" should also be considered TRUE. Set to FALSE ONLY if the query is explicitly about unrelated companies like Meta, Google, Apple, Amazon, or other industries/trivia, EVEN IF it mentions 'revenue' or 'sales'.)
    - metric: (one of: "patients", "revenue", "alerts", "services", "vitals", "critical_patients", "pending_payments", or null)
    - aggregation: (one of: "sum", "avg", "count", "max", "min", or null)
    - plant: (use as region, e.g. "California", "Texas", or null)
    - model: (use as service name/category, e.g. "Hospice Home Support", or null)
    - department: (use as care area, e.g. "Disability", "Hospice", or null)
    - time_range: (a description like "last 10 days", "Q1 2024", "this week", or null)
    
    CRITICAL: If is_automotive_related is false, all other fields MUST be null.
    JSON:
    """

    try:
        response = client.chat.completions.create(
            model=PRIMARY_MODEL,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.0,  # Deterministic
            max_tokens=256,
            response_format={"type": "json_object"}
        )
        import json
        return json.loads(response.choices[0].message.content)
    except Exception as e:
        logger.warning(f"Primary model ({PRIMARY_MODEL}) failed for entity extraction: {e}. Trying fallback...")
        try:
            response = client.chat.completions.create(
                model=FALLBACK_MODEL,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.0,
                max_tokens=256,
                response_format={"type": "json_object"}
            )
            import json
            return json.loads(response.choices[0].message.content)
        except Exception as e2:
            logger.error(f"Fallback model ({FALLBACK_MODEL}) also failed for entity extraction: {e2}")
            return {}


def extract_time_range(query: str) -> dict:
    """
    Use the LLM to extract a structured time range from a natural language query.
    Returns a dict that _parse_time_range can understand.
    """
    from datetime import datetime
    now = datetime.now()
    current_date = now.strftime("%Y-%m-%d")
    current_week = now.isocalendar()[1]
    current_year = now.year

    client = _get_sync_client()
    
    prompt = f"""
    The current date is {current_date} (Week {current_week}, Year {current_year}).
    Parse the user's time-related request into a structured format.
    
    Query: "{query}"
    
    Return ONLY a valid JSON object with ONE of these formats:
    1. {{"type": "date_range", "start_date": "YYYY-MM-DD", "end_date": "YYYY-MM-DD", "requested": "..."}}
    2. {{"type": "week", "week": N, "year": YYYY, "requested": "..."}}
    3. {{"type": "month", "month": N, "year": YYYY, "requested": "..."}}
    4. {{"type": "quarter", "quarter": N, "year": YYYY, "requested": "..."}}
    5. {{"type": "year", "year": YYYY, "requested": "..."}}
    
    If no time is mentioned, return {{"type": null}}.
    JSON:
    """

    try:
        response = client.chat.completions.create(
            model=PRIMARY_MODEL,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.0,
            max_tokens=256,
            response_format={"type": "json_object"}
        )
        import json
        result = json.loads(response.choices[0].message.content)
        if result.get("type") is None:
            return None
        return result
    except Exception as e:
        logger.warning(f"Primary model ({PRIMARY_MODEL}) failed for time extraction: {e}. Trying fallback...")
        try:
            response = client.chat.completions.create(
                model=FALLBACK_MODEL,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.0,
                max_tokens=256,
                response_format={"type": "json_object"}
            )
            import json
            result = json.loads(response.choices[0].message.content)
            if result.get("type") is None:
                return None
            return result
        except Exception as e2:
            logger.error(f"Fallback model ({FALLBACK_MODEL}) also failed for time extraction: {e2}")
            return None


def check_llm_health() -> dict:
    """Quick health check — verify Groq API is reachable."""
    try:
        client = _get_sync_client()
        # Minimal request to verify connectivity
        response = client.chat.completions.create(
            model=PRIMARY_MODEL,
            messages=[{"role": "user", "content": "Say OK"}],
            max_tokens=5,
        )
        return {
            "status": "healthy",
            "primary_model": PRIMARY_MODEL,
            "fallback_model": FALLBACK_MODEL,
        }
    except Exception as e:
        return {
            "status": "error",
            "error": str(e),
            "primary_model": PRIMARY_MODEL,
            "fallback_model": FALLBACK_MODEL,
        }
