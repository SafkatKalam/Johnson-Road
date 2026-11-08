"""F3 audit fixes: 500 keeps CORS and request id, one access log line per request, redaction, fullmatch."""
import json
import logging

from app.core.logging_setup import JsonFormatter
from app.core.request_context import _VALID_REQUEST_ID, get_request_id


class _Collector(logging.Handler):
    """Records the request id that is active at the moment a record is emitted."""

    def __init__(self):
        super().__init__()
        self.rows = []

    def emit(self, record):
        self.rows.append((record, get_request_id()))


def _attach(name):
    handler = _Collector()
    logger = logging.getLogger(name)
    logger.addHandler(handler)
    return logger, handler


def test_unhandled_500_still_has_cors_request_id_and_diagnostic_id(client):
    r = client.get("/__test/boom", headers={"Origin": "http://localhost:3000", "X-Request-Id": "boom-request-01"})
    assert r.status_code == 500
    assert r.headers["access-control-allow-origin"] == "http://localhost:3000"
    assert r.headers["x-request-id"] == "boom-request-01"
    assert r.json()["error"]["diagnosticId"]


def test_error_log_line_carries_the_request_id(client):
    logger, handler = _attach("johnsonroad.api")
    try:
        client.get("/__test/boom", headers={"X-Request-Id": "log-request-0001"})
    finally:
        logger.removeHandler(handler)
    errors = [(rec, rid) for rec, rid in handler.rows if rec.getMessage() == "unhandled error"]
    assert errors and errors[0][1] == "log-request-0001"
    assert errors[0][0].diagnostic_id


def test_one_access_log_line_per_request_with_route_status_duration(client):
    logger, handler = _attach("johnsonroad.access")
    logger.setLevel(logging.INFO)
    try:
        client.get("/live", headers={"X-Request-Id": "access-request-01"})
    finally:
        logger.removeHandler(handler)
    assert len(handler.rows) == 1
    record, request_id = handler.rows[0]
    assert (record.method, record.route, record.status) == ("GET", "/live", 200)
    assert record.duration_ms >= 0 and request_id == "access-request-01"


def test_access_log_uses_route_template_not_the_raw_path(client):
    logger, handler = _attach("johnsonroad.access")
    logger.setLevel(logging.INFO)
    try:
        client.get("/api/processing/jobs/some-private-id-123")
    finally:
        logger.removeHandler(handler)
    assert handler.rows[0][0].route.endswith("{job_id}")


def test_request_id_pattern_rejects_trailing_newline():
    assert _VALID_REQUEST_ID.fullmatch("abcdefgh")
    assert _VALID_REQUEST_ID.fullmatch("abcdefgh\n") is None


def _format(message="hello", **extra):
    record = logging.LogRecord("t", logging.INFO, __file__, 1, message, (), None)
    for key, value in extra.items():
        setattr(record, key, value)
    return json.loads(JsonFormatter().format(record))


def test_redacts_database_url_password_in_messages():
    entry = _format("connect failed for postgresql://postgres:hunter2@127.0.0.1:5430/db")
    assert "hunter2" not in entry["message"] and "postgresql://***@127.0.0.1" in entry["message"]


def test_redacts_assigned_secrets_in_messages():
    entry = _format("retry with password=hunter2 and api_key: abc123xyz")
    assert "hunter2" not in entry["message"] and "abc123xyz" not in entry["message"]


def test_redacts_inside_nested_extra_values():
    entry = _format(payload={"user": "a", "password": "p1", "items": [{"token": "t1"}, "Bearer abc.def"]})
    text = json.dumps(entry)
    for secret in ("p1", "t1", "abc.def"):
        assert secret not in text
    assert entry["payload"]["user"] == "a"


import pytest  # noqa: E402


@pytest.mark.parametrize("message", [
    "access_token=abc123secret failed",
    "client_secret=abc123secret failed",
    "db_password=abc123secret failed",
    "S3_SECRET_ACCESS_KEY=abc123secret failed",
    'sent {"password": "abc123secret"} to server',
    "sent {'password': 'abc123secret'} to server",
    'password="abc123secret" rejected',
    "Authorization: Basic abc123secret",
    "Authorization: Bearer abc123secret",
])
def test_redaction_covers_the_forms_the_audit_found(message):
    assert "abc123secret" not in _format(message)["message"]


def test_non_text_extras_are_masked_as_text():
    entry = _format(error=RuntimeError("connect to postgresql://u:abc123secret@host/db failed"))
    assert "abc123secret" not in json.dumps(entry)


@pytest.mark.parametrize("name", ["idempotency_key", "storage_key", "preview_frame_key", "tokens_used", "monkey"])
def test_useful_fields_that_merely_contain_key_or_token_stay_visible(name):
    assert _format(**{name: "visible-value"})[name] == "visible-value"


@pytest.mark.parametrize("name", ["api_key", "secret_key", "S3_SECRET_ACCESS_KEY", "access_token", "Authorization", "db_password"])
def test_secret_fields_are_masked(name):
    assert _format(**{name: "visible-value"})[name] == "***"


def test_extra_cannot_overwrite_core_log_fields():
    entry = _format("real message", level="FAKE", request_id="forged")
    assert entry["level"] == "INFO" and entry["request_id"] != "forged"
    assert entry["extra_level"] == "FAKE" and entry["extra_request_id"] == "forged"


def test_unserialisable_extras_never_lose_the_line():
    cyclic = {}
    cyclic["self"] = cyclic
    record = logging.LogRecord("t", logging.INFO, __file__, 1, "still logged", (), None)
    record.weird = float("nan")
    record.cyclic = cyclic
    line = json.loads(JsonFormatter().format(record))
    assert line["level"] == "INFO" and line["logger"] == "t"


def test_405_keeps_its_allow_header(client):
    r = client.delete("/health")
    assert r.status_code == 405 and "allow" in r.headers and "GET" in r.headers["allow"]
