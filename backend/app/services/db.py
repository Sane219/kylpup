"""Supabase client (service key). Isolation is enforced by callers scoping
every query with org_id — the service key bypasses RLS."""
from functools import lru_cache

from app.core.config import settings


@lru_cache(maxsize=1)
def db():
    from supabase import create_client  # lazy: keep import off the test/cold path
    return create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)
