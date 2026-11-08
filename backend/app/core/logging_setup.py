"""One JSON object per log line, with secrets masked (LOW_LEVEL_DESIGN 3.4, NFR-7, NFR-9)."""
import json
import logging
import re
from datetime import datetime, timezone

from app.core.request_context import get_request_id

# A field name is secret when one of its words is in _SECRET_WORDS, or it is "<kind>_key" for a secret kind.
# Plain words like idempotency_key or storage_key are NOT secret and stay visible for correlation.
_SECRET_WORDS = {"password", "passwd", "pwd", "secret", "secrets", "token", "authorization", "cookie",
                 "credential", "credentials", "apikey"}
_SECRET_KEY_KINDS = {"api", "secret", "access", "private", "signing", "encryption"}
_RESERVED = {"time", "level", "logger", "message", "request_id"}

_BEARER_OR_BASIC = re.compile(r"(?i)\b(bearer|basic)\s+[A-Za-z0-9._~+/=-]+")
_URL_CREDENTIALS = re.compile(r"(?i)([a-z][a-z0-9+.-]*://)[^/\s:@]+:[^/\s@]+@")
# name=value, name: value, "name": "value", 'name': 'value'  (name may be access_token, client_secret, S3_SECRET_ACCESS_KEY ...)
_ASSIGNED_SECRET = re.compile(
    r"""(?i)([\w-]*(?:password|passwd|pwd|secret|token|api[_-]?key|access[_-]?key|private[_-]?key)[\w-]*)"""
    r"""(["']?\s*[=:]\s*["']?)[^\s,;&"']+"""
)
_STANDARD = set(logging.LogRecord("", 0, "", 0, "", (), None).__dict__) | {"message", "asctime", "taskName"}


def _is_secret_key(key: str) -> bool:
    words = [w for w in re.split(r"[^a-z0-9]+", key.lower()) if w]
    if any(w in _SECRET_WORDS for w in words):
        return True
    return "key" in words and any(w in _SECRET_KEY_KINDS for w in words)


def _mask_text(value: str) -> str:
    value = _BEARER_OR_BASIC.sub(lambda m: f"{m.group(1)} ***", value)
    value = _URL_CREDENTIALS.sub(r"\1***@", value)
    return _ASSIGNED_SECRET.sub(lambda m: f"{m.group(1)}{m.group(2)}***", value)


def _mask(value):
    """Mask secrets inside a value; looks into lists and dicts. Unknown objects are masked as text."""
    if isinstance(value, str):
        return _mask_text(value)
    if isinstance(value, dict):
        return {str(k): ("***" if _is_secret_key(str(k)) else _mask(v)) for k, v in value.items()}
    if isinstance(value, (list, tuple, set)):
        return [_mask(v) for v in value]
    if value is None or isinstance(value, (bool, int, float)):
        return value
    return _mask_text(str(value))  # exceptions, paths, custom objects


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        try:
            return self._format(record)
        except Exception:  # a logging problem must never lose the line or crash the request
            return json.dumps({
                "time": datetime.now(timezone.utc).isoformat(),
                "level": record.levelname,
                "logger": record.name,
                "message": "log line could not be formatted",
                "request_id": get_request_id(),
            })

    def _format(self, record: logging.LogRecord) -> str:
        entry = {
            "time": datetime.fromtimestamp(record.created, tz=timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": _mask(record.getMessage()),
            "request_id": get_request_id(),
        }
        for key, value in record.__dict__.items():
            if key in _STANDARD or key.startswith("_"):
                continue
            name = f"extra_{key}" if key in _RESERVED else key  # an extra never overwrites a core field
            entry[name] = "***" if _is_secret_key(key) else _mask(value)
        if record.exc_info:
            entry["exception"] = _mask(self.formatException(record.exc_info))
        return json.dumps(entry, default=str, allow_nan=False)


def configure_logging(level: int = logging.INFO) -> None:
    root = logging.getLogger()
    if any(getattr(h, "_johnsonroad", False) for h in root.handlers):
        return
    handler = logging.StreamHandler()
    handler.setFormatter(JsonFormatter())
    handler._johnsonroad = True  # type: ignore[attr-defined]
    root.addHandler(handler)
    root.setLevel(level)
    # Uvicorn keeps its own plain-text handlers; route them through the same JSON format.
    # Its access log is replaced by the per-request line written by RequestIdMiddleware.
    for name in ("uvicorn", "uvicorn.error"):
        uvicorn_logger = logging.getLogger(name)
        uvicorn_logger.handlers = [handler]
        uvicorn_logger.propagate = False
    access = logging.getLogger("uvicorn.access")
    access.handlers = []
    access.propagate = False
    access.disabled = True
