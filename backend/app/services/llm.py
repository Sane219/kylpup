"""LLM provider abstraction. Groq primary (gpt-oss-120b, biggest free tier +
streamed reasoning), Gemini fallback. One entry point: chat_json(system, user) ->
dict, using each provider's native JSON mode so we never parse free text. Retries,
then fails over to the other provider."""
import json
import logging
import re
import time

from app.core.config import settings

log = logging.getLogger("klypup")

# gemini-2.0-flash has 0 free-tier quota on current keys; 2.5-flash works.
GEMINI_MODEL = "gemini-2.5-flash"
# llama-3.3-70b-versatile: NOT a reasoning model, so it burns no reasoning tokens
# and has a higher free-tier cap (12K TPM vs 8K for gpt-oss). gpt-oss-120b's live
# thought trace blew the 8K TPM limit — a single synth call (~15K in + reasoning +
# 8K out) exceeded it on its own, then failed over to an exhausted Gemini. This
# model yields no thought trace (stream_thinking emits only 'answer' chunks).
GROQ_MODEL = "llama-3.3-70b-versatile"
# Explicit completion cap so a large synth/refine JSON isn't truncated. 8192 fits
# the biggest desk-note response.
GROQ_MAX_TOKENS = 8192


def _active() -> str:
    return settings.LLM_PROVIDER if settings.LLM_PROVIDER in _PROVIDERS else "gemini"


_RETRY_RE = re.compile(r"try again in ([\d.]+)s|retry in ([\d.]+)s|retryDelay['\": ]+([\d.]+)")


def _retry_after(e: Exception) -> float | None:
    """Seconds Groq/Gemini asked us to wait, parsed from the 429 message. None if
    not a rate-limit error we should wait on."""
    m = _RETRY_RE.search(str(e))
    if not m:
        return None
    return float(next(g for g in m.groups() if g))


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
        response_format={"type": "json_object"},
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
        for attempt in range(3):
            try:
                return json.loads(_PROVIDERS[name](system, user))
            except Exception as e:
                last = e
                log.warning("llm %s attempt %d failed: %s", name, attempt + 1, e)
                # On a rate limit, wait out the window the provider asked for (capped
                # at 30s) and retry the SAME provider — don't fail over to the other,
                # which is likely also exhausted. Otherwise a short linear backoff.
                wait = _retry_after(e)
                if wait is not None and attempt < 2:
                    time.sleep(min(wait + 0.5, 30))
                else:
                    time.sleep(0.5 * (attempt + 1))
    raise RuntimeError(f"all LLM providers failed: {last}")
