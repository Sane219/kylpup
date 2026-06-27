"""Supabase client (service key). Isolation is enforced by callers scoping
every query with org_id — the service key bypasses RLS."""
from functools import lru_cache

from app.core.config import settings


@lru_cache(maxsize=1)
def db():
    """Shared service-role client. Never call sign_in_with_password on this —
    it persists the user session onto the client and swaps its Authorization
    header off service_role, breaking admin + RLS-bypassing queries. Use
    auth_client() for any password sign-in instead."""
    from supabase import create_client  # lazy: keep import off the test/cold path
    return create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)


def auth_client():
    """A fresh, uncached client for password sign-in, so the session it stores
    never pollutes the shared service-role client (see db())."""
    from supabase import create_client
    return create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)
