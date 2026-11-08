"""F6: truthful health and readiness. Public responses carry no paths, hosts or credentials."""
import shutil

import pytest

from app.core import health as health_module
from app.core.config import settings
from app.database import migrate as m

DOWN_URL = "postgresql+psycopg://x:x@127.0.0.1:1/none"  # port 1 refuses at once: a database that is down


@pytest.fixture(autouse=True)
def _fresh_health_cache():
    health_module.clear_cache()
    yield
    health_module.clear_cache()


def test_live_is_always_ok(client):
    r = client.get("/live")
    assert r.status_code == 200 and r.json() == {"status": "alive"}


def test_health_has_the_agreed_fields_and_no_paths(client):
    body = client.get("/health").json()
    assert {"status", "service", "databaseReady", "workerReady", "processingReady", "runtimeInitialized",
            "detectorLoaded", "detectorIsStub", "currentDetector", "device"} <= set(body)
    assert "modelPath" not in body
    text = client.get("/health").text
    for leak in (".pt", "\\", "5430", "postgres", "johnson_road", "127.0.0.1"):
        assert leak not in text


def test_health_is_honest_that_no_worker_exists_yet(client):
    body = client.get("/health").json()
    assert body["workerReady"] is False
    assert body["processingReady"] is False  # no worker and (in tests) only the stub detector


def test_stub_detector_is_flagged_so_it_cannot_pass_for_a_real_model(client):
    body = client.get("/health").json()
    assert body["detectorIsStub"] is True and body["currentDetector"] == "StubDetector"
    assert body["processingReady"] is False


def test_health_and_ready_when_database_is_up(client, migrated, monkeypatch):
    monkeypatch.setattr(settings, "database_url", _as_sqlalchemy_url(migrated))
    body = client.get("/health").json()
    assert body["databaseReady"] is True and body["status"] == "healthy"
    r = client.get("/ready")
    assert r.status_code == 200 and r.json()["schemaCurrent"] is True


def test_unmigrated_database_is_up_but_not_ready(client, db_url, monkeypatch):
    monkeypatch.setattr(settings, "database_url", _as_sqlalchemy_url(db_url))
    assert client.get("/health").json()["databaseReady"] is True
    r = client.get("/ready")
    assert r.status_code == 503
    assert r.json()["error"]["details"] == {"databaseReady": True, "schemaCurrent": False}


def test_concurrent_health_calls_connect_once(monkeypatch):
    import threading

    calls = []
    real_connect = health_module._connect

    def slow_connect():
        calls.append(1)
        import time

        time.sleep(0.2)
        return real_connect()

    monkeypatch.setattr(health_module, "_connect", slow_connect)
    threads = [threading.Thread(target=health_module.database_ready) for _ in range(6)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    assert len(calls) == 1


def test_database_down_makes_health_degraded_and_ready_503(client, monkeypatch):
    monkeypatch.setattr(settings, "database_url", DOWN_URL)
    r = client.get("/health")
    assert r.status_code == 200  # the process is alive; it just says so
    assert r.json()["status"] == "degraded" and r.json()["databaseReady"] is False
    r = client.get("/ready")
    assert r.status_code == 503
    error = r.json()["error"]
    assert error["code"] == "not_ready"
    assert error["details"] == {"databaseReady": False, "schemaCurrent": False}
    assert "127.0.0.1" not in r.text and "x:x" not in r.text
    assert "x-request-id" in r.headers


def test_live_still_ok_when_database_is_down(client, monkeypatch):
    monkeypatch.setattr(settings, "database_url", DOWN_URL)
    assert client.get("/live").status_code == 200


def test_results_are_cached_briefly(monkeypatch):
    calls = []
    real_connect = health_module._connect

    def counting_connect():
        calls.append(1)
        return real_connect()

    monkeypatch.setattr(health_module, "_connect", counting_connect)
    health_module.database_ready()
    health_module.database_ready()
    health_module.database_ready()
    assert len(calls) <= 1


# --- the schema check against a real database and a real missing migration -------

def _as_sqlalchemy_url(libpq):
    return libpq.replace("postgresql://", "postgresql+psycopg://", 1)


def test_schema_current_true_then_false_when_a_migration_file_is_added(migrated, tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "database_url", _as_sqlalchemy_url(migrated))
    assert health_module.schema_current() is True
    extra = tmp_path / "migrations"
    shutil.copytree(m.MIGRATIONS_DIR, extra)
    (extra / "0002_add_nothing.sql").write_text("SELECT 1;\n", encoding="utf-8")
    assert health_module.schema_current(extra) is False  # file exists, never applied


def test_ready_is_503_when_a_migration_is_really_pending(client, migrated, tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "database_url", _as_sqlalchemy_url(migrated))
    extra = tmp_path / "migrations"
    shutil.copytree(m.MIGRATIONS_DIR, extra)
    (extra / "0002_add_nothing.sql").write_text("SELECT 1;\n", encoding="utf-8")
    monkeypatch.setattr(m, "MIGRATIONS_DIR", extra)
    r = client.get("/ready")
    assert r.status_code == 503
    assert r.json()["error"]["details"] == {"databaseReady": True, "schemaCurrent": False}
    # and it becomes ready once the migration is applied
    m.migrate(migrated, extra)
    health_module.clear_cache()
    assert client.get("/ready").status_code == 200
