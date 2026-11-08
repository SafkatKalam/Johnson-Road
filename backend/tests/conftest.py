import os
import sys
from pathlib import Path

_BACKEND = Path(__file__).resolve().parents[1]
# A default only for a machine with NO backend/.env (a clean checkout or CI). When the file exists, its
# DATABASE_URL is used: a default here would beat it and silently skip every database test.
if not (_BACKEND / ".env").exists():
    os.environ.setdefault("DATABASE_URL", "postgresql://postgres:postgres@127.0.0.1:5430/johnson_road")
os.environ.setdefault("MODEL", "stub")           # tests run without torch/ultralytics
os.environ.setdefault("ENABLE_WARMUP", "false")
# REQUIRE_DB=1 turns "PostgreSQL is not running" from a skip into a failure (use it in CI).
REQUIRE_DB = os.environ.get("REQUIRE_DB") == "1"

sys.path.insert(0, str(_BACKEND))

import uuid

import psycopg
import pytest
from fastapi.testclient import TestClient

from app.core.errors import AppError
from app.database import migrate as m
from app.main import app

ADMIN_URL = m.libpq_url().rsplit("/", 1)[0] + "/postgres"


def server_up() -> bool:
    try:
        psycopg.connect(ADMIN_URL, connect_timeout=3).close()
        return True
    except psycopg.Error:
        return False


@pytest.fixture()
def db_url():
    """An empty throwaway database, dropped afterwards."""
    if not server_up():
        message = "PostgreSQL container is not running"
        if REQUIRE_DB:
            pytest.fail(message + " (REQUIRE_DB=1)")
        pytest.skip(message)
    name = "jr_test_" + uuid.uuid4().hex[:10]
    with psycopg.connect(ADMIN_URL, autocommit=True) as admin:
        admin.execute(f'CREATE DATABASE "{name}"')
    url = ADMIN_URL.rsplit("/", 1)[0] + "/" + name
    try:
        yield url
    finally:
        with psycopg.connect(ADMIN_URL, autocommit=True) as admin:
            admin.execute(f'DROP DATABASE IF EXISTS "{name}" WITH (FORCE)')


@pytest.fixture()
def migrated(db_url):
    """The throwaway database with every migration applied."""
    assert m.migrate(db_url) == ["0001"]
    return db_url


def _boom():
    raise RuntimeError("secret path C:\\private\\file.mp4 token=abc123")


def _known_failure():
    raise AppError("job_not_cancellable", 409, "This job has already finished and cannot be cancelled.")


@pytest.fixture(scope="session")
def client():
    # Test-only routes exist only while the tests run; they are removed afterwards.
    before = len(app.router.routes)
    app.add_api_route("/__test/boom", _boom)
    app.add_api_route("/__test/known", _known_failure)
    try:
        with TestClient(app, raise_server_exceptions=False) as c:
            yield c
    finally:
        del app.router.routes[before:]
