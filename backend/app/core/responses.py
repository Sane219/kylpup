"""Consistent response envelope + error handling. Success: {data, meta}.
Error: {error: {code, message, details}, meta}."""
import logging
import uuid

from fastapi import Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

log = logging.getLogger("klypup")


def ok(data, meta: dict | None = None):
    return {"data": data, "meta": meta or {}}


def _err(code: str, message, status: int, details=None):
    return JSONResponse(
        status_code=status,
        content={"error": {"code": code, "message": message, "details": details},
                 "meta": {"request_id": str(uuid.uuid4())}},
    )


def install_error_handlers(app):
    @app.exception_handler(StarletteHTTPException)
    async def http_exc(_: Request, e: StarletteHTTPException):
        return _err("http_error", e.detail, e.status_code)

    @app.exception_handler(RequestValidationError)
    async def validation_exc(_: Request, e: RequestValidationError):
        return _err("validation_error", "invalid request", 400, e.errors())

    @app.exception_handler(Exception)
    async def unhandled(_: Request, e: Exception):
        log.exception("unhandled error")
        return _err("internal_error", "something went wrong", 500)
