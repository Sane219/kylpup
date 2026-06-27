import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.responses import install_error_handlers
from app.routes import auth, market, orgs, research, watchlist

logging.basicConfig(level=logging.INFO)

app = FastAPI(title="Klypup Research API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS.split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)

install_error_handlers(app)
app.include_router(auth.router)
app.include_router(market.router)
app.include_router(orgs.router)
app.include_router(research.router)
app.include_router(watchlist.router)


@app.get("/health")
def health():
    return {"status": "ok"}
