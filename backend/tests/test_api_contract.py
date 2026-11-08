"""F3 contract tests: request ids, one error shape, no leaked internals."""
import json
import logging
import re

from app.core.logging_setup import JsonFormatter

ERROR_KEYS = {"code", "message", "diagnosticId"}


def _assert_error_shape(body):
    assert set(body) == {"error"}
    assert ERROR_KEYS <= set(body["error"])
    assert isinstance(body["error"]["code"], str)
    assert isinstance(body["error"]["message"], str)


# --- request id ---------------------------------------------------------------

def test_request_id_is_created_when_missing(client):
    r = client.get("/health")
    assert r.status_code == 200
    assert re.fullmatch(r"[A-Za-z0-9-]{8,64}", r.headers["x-request-id"])


def test_valid_incoming_request_id_is_kept(client):
    r = client.get("/health", headers={"X-Request-Id": "abc-12345678"})
    assert r.headers["x-request-id"] == "abc-12345678"


def test_bad_incoming_request_id_is_replaced(client):
    r = client.get("/health", headers={"X-Request-Id": "short"})
    assert r.headers["x-request-id"] != "short"
    r = client.get("/health", headers={"X-Request-Id": "has spaces and <script> 123456"})
    assert re.fullmatch(r"[A-Za-z0-9-]{8,64}", r.headers["x-request-id"])


def test_two_requests_get_different_ids(client):
    a = client.get("/health").headers["x-request-id"]
    b = client.get("/health").headers["x-request-id"]
    assert a != b


# --- error shape --------------------------------------------------------------

def test_unknown_route_uses_error_shape(client):
    r = client.get("/api/does-not-exist")
    assert r.status_code == 404
    _assert_error_shape(r.json())
    assert r.json()["error"]["code"] == "not_found"
    assert "x-request-id" in r.headers


def test_wrong_method_uses_error_shape(client):
    r = client.delete("/health")
    assert r.status_code == 405
    _assert_error_shape(r.json())


def test_validation_error_is_422_without_echoing_input(client, as_member):
    r = client.post("/api/uploads", data={"notes": "SECRET-VALUE-123"})
    assert r.status_code == 422
    body = r.json()
    _assert_error_shape(body)
    assert body["error"]["code"] == "invalid_input"
    assert body["error"]["details"]["fields"]
    assert "SECRET-VALUE-123" not in r.text
    assert "x-request-id" in r.headers


def test_app_error_keeps_its_code_and_status(client):
    r = client.get("/__test/known")
    assert r.status_code == 409
    _assert_error_shape(r.json())
    assert r.json()["error"]["code"] == "job_not_cancellable"


def test_unexpected_error_is_500_with_diagnostic_id_and_no_leak(client):
    r = client.get("/__test/boom")
    assert r.status_code == 500
    body = r.json()
    _assert_error_shape(body)
    assert body["error"]["code"] == "internal_error"
    assert re.fullmatch(r"[0-9a-f]{12}", body["error"]["diagnosticId"])
    for leak in ("RuntimeError", "private", "file.mp4", "abc123", "Traceback"):
        assert leak not in r.text
    assert "x-request-id" in r.headers


# --- as-built behaviour kept (legacy routes are not changed by F3) -------------

def test_legacy_unknown_job_still_returns_200_not_found(client, as_member):
    r = client.get("/api/processing/jobs/does-not-exist")
    assert r.status_code == 200
    assert r.json().get("status") == "not_found"


def test_health_and_root_still_work(client):
    assert client.get("/").json()["project"] == "Johnson Road"
    # "healthy" or "degraded" depends on whether the database container is up; the keys do not.
    assert client.get("/health").json()["status"] in ("healthy", "degraded")


# --- logging ------------------------------------------------------------------

def _format(**extra):
    record = logging.LogRecord("johnsonroad.test", logging.INFO, __file__, 1, "hello Bearer abc.def.ghi", (), None)
    for key, value in extra.items():
        setattr(record, key, value)
    return json.loads(JsonFormatter().format(record))


def test_log_line_is_json_with_core_fields():
    entry = _format()
    assert {"time", "level", "logger", "message", "request_id"} <= set(entry)


def test_log_masks_secret_keys_and_bearer_tokens():
    entry = _format(password="hunter2", api_key="k-123", authorization="Bearer xyz", job_id="j1")
    assert entry["password"] == "***"
    assert entry["api_key"] == "***"
    assert entry["authorization"] == "***"
    assert entry["job_id"] == "j1"
    assert "abc.def.ghi" not in entry["message"]
