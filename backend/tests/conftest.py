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


@pytest.fixture()
def as_member():
    """Skip sign-in for tests about something else (legacy sample-data routes): the caller is a fake member."""
    from app.auth.deps import Principal, current_member
    from app.auth.tokens import Identity

    principal = Principal(
        user={"id": "u1", "email": "t@example.com", "status": "active"},
        identity=Identity("sub-1", "t@example.com"),
        organization_id="o1", organization={"id": "o1", "name": "Org", "slug": "org", "plan": "starter"}, role="owner",
    )
    app.dependency_overrides[current_member] = lambda: principal
    yield principal
    app.dependency_overrides.pop(current_member, None)


@pytest.fixture()
def confirmed_email():
    """Replaces the call that asks Supabase whether an address was confirmed. `state['answer']` is True, False,
    None (cannot check) or an exception to raise; `state['calls']` lists the sign-in ids that were asked about."""
    from app.auth.email_confirmation import get_email_confirmation_check

    state = {"answer": True, "calls": []}

    def check(subject, email=None):
        state["calls"].append(subject)
        if isinstance(state["answer"], Exception):
            raise state["answer"]
        return state["answer"]

    app.dependency_overrides[get_email_confirmation_check] = lambda: check
    yield state
    app.dependency_overrides.pop(get_email_confirmation_check, None)


@pytest.fixture()
def verifier(monkeypatch):
    """A token verifier trusting the local test key. Returns the FakeJWKS so a test can change the keys."""
    from app.auth import tokens
    from auth_support import SUPABASE_URL, FakeJWKS

    jwks = FakeJWKS()
    monkeypatch.setattr(tokens, "_verifier", tokens.TokenVerifier(SUPABASE_URL, "authenticated", 10, jwks))
    return jwks


@pytest.fixture()
def auth_db(migrated):
    """The app's database dependency pointed at a throwaway migrated database."""
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker

    from app.database.database import get_db

    engine = create_engine(migrated.replace("postgresql://", "postgresql+psycopg://", 1), pool_pre_ping=True)
    maker = sessionmaker(autoflush=False, autocommit=False, bind=engine)

    def override():
        db = maker()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override
    yield maker
    app.dependency_overrides.pop(get_db, None)
    engine.dispose()


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
