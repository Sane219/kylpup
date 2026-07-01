"""LLM provider abstraction. Groq primary (gpt-oss-120b, biggest free tier +
streamed reasoning), Gemini fallback. One entry point: chat_json(system, user) ->
dict, using each provider's native JSON mode so we never parse free text. Retries,
then fails over to the other provider."""
import json
import logging
import time

from app.core.config import settings

log = logging.getLogger("klypup")

# gemini-2.0-flash has 0 free-tier quota on current keys; 2.5-flash works.
GEMINI_MODEL = "gemini-2.5-flash"
# gpt-oss-120b: a reasoning model (streams a thought trace) with the biggest free
# tier — 200K tokens/day vs 100K for the rest. Gemini's thinking_budget maps to
# Groq's reasoning_effort.
GROQ_MODEL = "openai/gpt-oss-120b"
# gpt-oss needs an explicit completion cap: without it, reasoning + a large JSON
# schema (synth/refine) gets truncated and Groq rejects it as "Failed to validate
# JSON". 8192 comfortably fits the biggest desk-note response plus its reasoning.
GROQ_MAX_TOKENS = 8192


def _active() -> str:
    return settings.LLM_PROVIDER if settings.LLM_PROVIDER in _PROVIDERS else "gemini"


def _effort(budget: int) -> str:
    return "low" if budget <= 512 else "high" if budget >= 2048 else "medium"


def _gemini(system: str, user: str) -> str:
    from google import genai
    from google.genai import types
    client = genai.Client(api_key=settings.GEMINI_API_KEY)
    res = client.models.generate_content(
        model=GEMINI_MODEL,
        contents=user,
        config=types.GenerateContentConfig(
            system_instruction=system,
            response_mime_type="application/json",
            temperature=0.2,
        ),
    )
    return res.text


def _gemini_thinking(system: str, user: str, budget: int) -> tuple[str, str]:
    """Gemini 2.5 with thought summaries. Returns (json_answer, thoughts_text).
    Thought parts are plain prose; only the non-thought parts form the JSON."""
    from google import genai
    from google.genai import types
    client = genai.Client(api_key=settings.GEMINI_API_KEY)
    res = client.models.generate_content(
        model=GEMINI_MODEL,
        contents=user,
        config=types.GenerateContentConfig(
            system_instruction=system,
            response_mime_type="application/json",
            temperature=0.2,
            thinking_config=types.ThinkingConfig(include_thoughts=True, thinking_budget=budget),
        ),
    )
    answer, thoughts = [], []
    for p in res.candidates[0].content.parts:
        if not p.text:
            continue
        (thoughts if getattr(p, "thought", False) else answer).append(p.text)
    return "".join(answer), "".join(thoughts)


def _stream_gemini(system: str, user: str, budget: int):
    from google import genai
    from google.genai import types
    client = genai.Client(api_key=settings.GEMINI_API_KEY)
    stream = client.models.generate_content_stream(
        model=GEMINI_MODEL,
        contents=user,
        config=types.GenerateContentConfig(
            system_instruction=system,
            response_mime_type="application/json",
            temperature=0.2,
            thinking_config=types.ThinkingConfig(include_thoughts=True, thinking_budget=budget),
        ),
    )
    for chunk in stream:
        if not chunk.candidates:
            continue
        for p in chunk.candidates[0].content.parts:
            if not p.text:
                continue
            yield ("thought" if getattr(p, "thought", False) else "answer", p.text)


def _stream_groq(system: str, user: str, budget: int):
    """gpt-oss streams reasoning via delta.reasoning and the JSON via delta.content
    when reasoning_format='parsed' (the only format allowed alongside JSON mode)."""
    from groq import Groq
    client = Groq(api_key=settings.GROQ_API_KEY)
    stream = client.chat.completions.create(
        model=GROQ_MODEL,
        messages=[{"role": "system", "content": system},
                  {"role": "user", "content": user}],
        response_format={"type": "json_object"},  # gpt-oss rejects reasoning_format alongside this; it streams delta.reasoning anyway
        reasoning_effort=_effort(budget),
        max_completion_tokens=GROQ_MAX_TOKENS,
        temperature=0.2,
        stream=True,
    )
    for chunk in stream:
        d = chunk.choices[0].delta
        if getattr(d, "reasoning", None):
            yield ("thought", d.reasoning)
        if d.content:
            yield ("answer", d.content)


def stream_thinking(system: str, user: str, budget: int):
    """Sync generator yielding ('thought', chunk) as the model reasons and
    ('answer', chunk) as it writes the JSON. Dispatches to the active provider;
    raises on failure so the caller can fall back to chat_json_thinking."""
    gen = _stream_groq if _active() == "groq" else _stream_gemini
    yield from gen(system, user, budget)


def chat_json_thinking(system: str, user: str, budget: int = 1024) -> tuple[dict, str]:
    """Like chat_json but also returns the model's thought trace. Uses the active
    provider's reasoning; on any failure falls back to chat_json with no thoughts,
    so the run never depends on thinking being available."""
    try:
        if _active() == "groq":
            txt, thoughts = _groq_thinking(system, user, budget)
        else:
            txt, thoughts = _gemini_thinking(system, user, budget)
        return json.loads(txt), thoughts
    except Exception as e:
        log.warning("thinking call failed, falling back: %s", e)
    return chat_json(system, user), ""


def _groq(system: str, user: str) -> str:
    from groq import Groq
    client = Groq(api_key=settings.GROQ_API_KEY)
    res = client.chat.completions.create(
        model=GROQ_MODEL,
        messages=[{"role": "system", "content": system},
                  {"role": "user", "content": user}],
        response_format={"type": "json_object"},
        max_completion_tokens=GROQ_MAX_TOKENS,
        temperature=0.2,
    )
    return res.choices[0].message.content


def _groq_thinking(system: str, user: str, budget: int) -> tuple[str, str]:
    """gpt-oss with parsed reasoning: content is the JSON, reasoning is the trace."""
    from groq import Groq
    client = Groq(api_key=settings.GROQ_API_KEY)
    res = client.chat.completions.create(
        model=GROQ_MODEL,
        messages=[{"role": "system", "content": system},
                  {"role": "user", "content": user}],
        response_format={"type": "json_object"},
        reasoning_effort=_effort(budget),
        max_completion_tokens=GROQ_MAX_TOKENS,
        temperature=0.2,
    )
    msg = res.choices[0].message
    return msg.content, (getattr(msg, "reasoning", None) or "")


_PROVIDERS = {"gemini": _gemini, "groq": _groq}


def chat_json(system: str, user: str) -> dict:
    """Call the configured provider (retry x2), fail over to the other, raise
    if both are down. System prompt must instruct JSON-only output."""
    primary = settings.LLM_PROVIDER if settings.LLM_PROVIDER in _PROVIDERS else "gemini"
    order = [primary] + [p for p in _PROVIDERS if p != primary]
    last = None
    for name in order:
        for attempt in range(2):
            try:
                return json.loads(_PROVIDERS[name](system, user))
            except Exception as e:
                last = e
                log.warning("llm %s attempt %d failed: %s", name, attempt + 1, e)
                time.sleep(0.5 * (attempt + 1))
    raise RuntimeError(f"all LLM providers failed: {last}")
