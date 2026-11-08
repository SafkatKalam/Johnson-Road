"""One error shape for every failure (LOW_LEVEL_DESIGN 3.2; open item O26 default).

Shape: {"error": {"code": str, "message": str, "diagnosticId": str | None}}
Messages are plain words. Stack traces, file paths and raw exception text never reach the client.
"""
import logging
import uuid
from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core.request_context import REQUEST_ID_HEADER

logger = logging.getLogger("johnsonroad.api")

_STATUS_CODES = {
    400: ("bad_request", "The request could not be processed."),
    401: ("not_signed_in", "You need to sign in."),
    403: ("forbidden", "You are not allowed to do this."),
    404: ("not_found", "That item or page was not found."),
    405: ("method_not_allowed", "That action is not allowed on this address."),
    409: ("conflict", "That is not allowed in the current state."),
    413: ("payload_too_large", "That file or request is too large."),
    415: ("unsupported_media_type", "That kind of file is not supported."),
    422: ("invalid_input", "Some of the information sent is missing or not valid."),
    429: ("too_many_requests", "Too many requests. Please wait and try again."),
}


class AppError(Exception):
    """An expected failure with a stable code and a catalogue message."""

    def __init__(
        self,
        code: str,
        http_status: int,
        message: str,
        diagnostic_id: str | None = None,
        details: dict[str, Any] | None = None,
        headers: dict[str, str] | None = None,
    ) -> None:
        super().__init__(code)
        self.code = code
        self.http_status = http_status
        self.message = message
        self.diagnostic_id = diagnostic_id
        self.details = details
        self.headers = headers


def _body(code: str, message: str, diagnostic_id: str | None, details: dict[str, Any] | None = None) -> dict:
    error: dict[str, Any] = {"code": code, "message": message, "diagnosticId": diagnostic_id}
    if details:
        error["details"] = details
    return {"error": error}


def _respond(request: Request, status: int, body: dict, headers: dict[str, str] | None = None) -> JSONResponse:
    response = JSONResponse(status_code=status, content=body, headers=headers)
    request_id = getattr(request.state, "request_id", None)
    if request_id:
        response.headers[REQUEST_ID_HEADER] = request_id
    return response


async def _app_error_handler(request: Request, exc: AppError) -> JSONResponse:
    return _respond(request, exc.http_status, _body(exc.code, exc.message, exc.diagnostic_id, exc.details), exc.headers)


async def _validation_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    # Field names and rules only; the submitted values are not echoed back.
    fields = [
        {"field": ".".join(str(part) for part in err.get("loc", ())), "problem": err.get("type", "invalid")}
        for err in exc.errors()
    ]
    return _respond(
        request,
        422,
        _body("invalid_input", "Some of the information sent is missing or not valid.", None, {"fields": fields}),
    )


async def _http_exception_handler(request: Request, exc: StarletteHTTPException) -> JSONResponse:
    code, message = _STATUS_CODES.get(exc.status_code, ("error", "The request failed."))
    if exc.status_code >= 500:
        return await unexpected_error_response(request, exc)
    # Keep headers the framework set for a reason, e.g. "Allow" on a 405 or "WWW-Authenticate" on a 401.
    return _respond(request, exc.status_code, _body(code, message, None), dict(exc.headers or {}))


async def unexpected_error_response(request: Request, exc: Exception) -> JSONResponse:
    """The standard 500. Also used by RequestIdMiddleware so CORS and the request id still apply."""
    diagnostic_id = uuid.uuid4().hex[:12]
    # The real exception and stack go to the log under the diagnostic id, nowhere else.
    logger.error(
        "unhandled error",
        exc_info=exc,
        extra={"diagnostic_id": diagnostic_id, "route": request.url.path},
    )
    return _respond(
        request,
        500,
        _body("internal_error", "Something went wrong on our side. Quote the diagnostic id if you ask for help.", diagnostic_id),
    )


def register_error_handlers(app: FastAPI) -> None:
    app.add_exception_handler(AppError, _app_error_handler)
    app.add_exception_handler(RequestValidationError, _validation_handler)
    app.add_exception_handler(StarletteHTTPException, _http_exception_handler)
    app.add_exception_handler(Exception, unexpected_error_response)
