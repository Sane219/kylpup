"""Live market quotes for the dashboard tape and markets board. Public market
data (yfinance), not tenant data — auth-gated for consistency but not org-scoped."""
from fastapi import APIRouter, Depends, Query

from app.core.auth import Tenant, get_current_tenant
from app.core.responses import ok
from app.tools import market

router = APIRouter(prefix="/market", tags=["market"])


@router.get("/snapshot")
def market_snapshot(
    symbols: str = Query(..., description="comma-separated tickers, e.g. AAPL,MSFT,SPX"),
    _: Tenant = Depends(get_current_tenant),
):
    syms = [s.strip().upper() for s in symbols.split(",") if s.strip()][:60]
    return ok(market.snapshot(syms))
