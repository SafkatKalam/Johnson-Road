"""Stop oversized or anonymous upload bodies BEFORE they are read (security review 2026-11-17, finding 2).

FastAPI reads a whole multipart body into temporary files before any route dependency (sign-in check) runs, so without
this guard anyone could fill the disk by sending a huge body that is refused only afterwards. This middleware sits in
front: on the upload route it refuses a request with no bearer token, a declared size over the limit, or a stream that
grows past the limit. The real sign-in check still runs in the route; this is only an early, cheap refusal."""
from __future__ import annotations

import json
import re

from app.core.config import settings

_UPLOAD_PATH = re.compile(r"^/api/projects/[^/]+/uploads/?$")
_SLACK = 1024 * 1024   # multipart headers and metadata fields around the file


def _reply(send, status: int, code: str, message: str):
    body = json.dumps({"error": {"code": code, "message": message, "diagnosticId": None}}).encode()

    async def go():
        await send({"type": "http.response.start", "status": status,
                    "headers": [(b"content-type", b"application/json"), (b"content-length", str(len(body)).encode()), (b"connection", b"close")]})
        await send({"type": "http.response.body", "body": body})
    return go()


class UploadGuardMiddleware:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http" or scope["method"] != "POST" or not _UPLOAD_PATH.match(scope["path"]):
            return await self.app(scope, receive, send)
        headers = dict(scope["headers"])
        auth = headers.get(b"authorization", b"")
        if not auth.lower().startswith(b"bearer ") or len(auth) < 20:
            return await _reply(send, 401, "not_signed_in", "You need to sign in.")
        limit = settings.upload_max_bytes + _SLACK
        declared = headers.get(b"content-length")
        if declared is not None:
            try:
                if int(declared) > limit:
                    return await _reply(send, 413, "file_too_large", "That video is larger than the allowed size.")
            except ValueError:
                return await _reply(send, 400, "bad_request", "The request could not be processed.")
        seen = 0

        async def counting_receive():
            nonlocal seen
            message = await receive()
            if message["type"] == "http.request":
                seen += len(message.get("body", b""))
                if seen > limit:
                    # Stop reading: the parser sees an aborted body and the request fails without storing more.
                    return {"type": "http.disconnect"}
            return message

        return await self.app(scope, counting_receive, send)
