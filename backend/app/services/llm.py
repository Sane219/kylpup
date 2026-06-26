"""LLM provider abstraction. Gemini primary, Groq fallback. One entry point:
chat_json(system, user) -> dict, using each provider's native JSON mode so we
never parse free text. Retries, then fails over to the other provider."""
import json
import logging
import time

from app.core.config import settings

log = logging.getLogger("klypup")

GEMINI_MODEL = "gemini-2.0-flash"
GROQ_MODEL = "llama-3.3-70b-versatile"


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


def _groq(system: str, user: str) -> str:
    from groq import Groq
    client = Groq(api_key=settings.GROQ_API_KEY)
    res = client.chat.completions.create(
        model=GROQ_MODEL,
        messages=[{"role": "system", "content": system},
                  {"role": "user", "content": user}],
        response_format={"type": "json_object"},
        temperature=0.2,
    )
    return res.choices[0].message.content


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
