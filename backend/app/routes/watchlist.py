"""Watchlist CRUD, org-scoped."""
from fastapi import APIRouter, Depends

from app.core.auth import Tenant, get_current_tenant
from app.core.responses import ok
from app.models.schemas import WatchlistIn
from app.services.db import db

router = APIRouter(prefix="/watchlist", tags=["watchlist"])


@router.get("")
def list_watchlist(t: Tenant = Depends(get_current_tenant)):
    rows = db().table("watchlist").select("id,ticker,created_at").eq(
        "org_id", t.org_id).eq("user_id", t.user_id).order("ticker").execute().data
    return ok(rows)


@router.post("", status_code=201)
def add_watchlist(body: WatchlistIn, t: Tenant = Depends(get_current_tenant)):
    row = db().table("watchlist").upsert(
        {"org_id": t.org_id, "user_id": t.user_id, "ticker": body.ticker.upper()},
        on_conflict="org_id,user_id,ticker").execute().data[0]
    return ok(row)


@router.delete("/{ticker}", status_code=204)
def remove_watchlist(ticker: str, t: Tenant = Depends(get_current_tenant)):
    db().table("watchlist").delete().eq("org_id", t.org_id).eq(
        "user_id", t.user_id).eq("ticker", ticker.upper()).execute()
    return None
