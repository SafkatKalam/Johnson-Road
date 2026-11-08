"""Request id and one access log line per HTTP request (LOW_LEVEL_DESIGN 3.3 and 3.4, FD20).

The request id identifies one HTTP attempt. It is not a job id.

This is a plain ASGI middleware (not BaseHTTPMiddleware) so streaming uploads and downloads are not
buffered. It also turns an unhandled error into the standard 500 body *inside* the CORS layer, so the
browser still receives the diagnostic id and the request id header.
"""
import logging
import re
import time
import uuid
from contextvars import ContextVar

from starlette.datastructures import Headers, MutableHeaders
from starlette.requests import Request
from starlette.types import ASGIApp, Message, Receive, Scope, Send

REQUEST_ID_HEADER = "X-Request-Id"
_VALID_REQUEST_ID = re.compile(r"[A-Za-z0-9-]{8,64}")

request_id_var: ContextVar[str] = ContextVar("request_id", default="-")
logger = logging.getLogger("johnsonroad.access")


def get_request_id() -> str:
    return request_id_var.get()


class RequestIdMiddleware:
    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        incoming = Headers(scope=scope).get(REQUEST_ID_HEADER, "")
        request_id = incoming if _VALID_REQUEST_ID.fullmatch(incoming) else str(uuid.uuid4())
        scope.setdefault("state", {})["request_id"] = request_id
        token = request_id_var.set(request_id)
        started = time.perf_counter()
        status = {"code": 0, "started": False}

        async def send_with_id(message: Message) -> None:
            if message["type"] == "http.response.start":
                status["code"] = message["status"]
                status["started"] = True
                MutableHeaders(scope=message)[REQUEST_ID_HEADER] = request_id
            await send(message)

        try:
            try:
                await self.app(scope, receive, send_with_id)
            except Exception as exc:
                if status["started"]:
                    raise  # the response is already on the wire; nothing safe to send
                from app.core.errors import unexpected_error_response

                response = await unexpected_error_response(Request(scope, receive), exc)
                await response(scope, receive, send_with_id)
        finally:
            route = scope.get("route")
            logger.info(
                "request",
                extra={
                    "method": scope.get("method"),
                    "route": getattr(route, "path", "unmatched"),
                    "status": status["code"],
                    "duration_ms": round((time.perf_counter() - started) * 1000, 1),
                },
            )
            request_id_var.reset(token)
