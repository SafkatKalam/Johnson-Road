"""Truthful readiness checks (F6). Each check answers fast and never raises.

Public health responses must not reveal file paths, hosts, versions or credentials.
Results are cached for a few seconds so a flood of /health calls cannot flood the database.
"""
import logging
import threading
import time
from pathlib import Path

import psycopg

from app.core.config import settings

logger = logging.getLogger("johnsonroad.health")

CHECK_TIMEOUT_SECONDS = 2
CACHE_SECONDS = 3
_cache: dict[tuple[str, str], tuple[float, bool]] = {}


def clear_cache() -> None:
    _cache.clear()


_locks: dict[tuple[str, str], threading.Lock] = {}
_locks_guard = threading.Lock()


def _cached(name: str, compute) -> bool:
    key = (name, settings.database_url)
    hit = _cache.get(key)
    if hit and time.monotonic() - hit[0] < CACHE_SECONDS:
        return hit[1]
    with _locks_guard:
        lock = _locks.setdefault(key, threading.Lock())
    # One thread refreshes; the others wait for it and reuse its answer instead of all connecting.
    with lock:
        hit = _cache.get(key)
        if hit and time.monotonic() - hit[0] < CACHE_SECONDS:
            return hit[1]
        value = compute()
        _cache[key] = (time.monotonic(), value)  # stamped after the check, so a slow check still caches
        return value


def _connect() -> psycopg.Connection:
    # connect_timeout bounds the connection; statement_timeout bounds a query that hangs afterwards.
    return psycopg.connect(
        settings.libpq_url,
        connect_timeout=CHECK_TIMEOUT_SECONDS,
        options=f"-c statement_timeout={CHECK_TIMEOUT_SECONDS * 1000}",
    )


def database_ready() -> bool:
    """True when the database answers a trivial query within the timeout."""

    def compute() -> bool:
        try:
            with _connect() as conn:
                conn.execute("SELECT 1")
            return True
        except Exception as exc:  # any failure means "not ready"; the reason goes to the log only
            logger.warning("database not ready: %s", type(exc).__name__)
            return False

    return _cached("database", compute)


def schema_current(directory: Path | None = None) -> bool:
    """True when every migration file has been applied."""

    def compute() -> bool:
        try:
            from app.database.migrate import MIGRATIONS_DIR, load_migrations

            wanted = {m.version for m in load_migrations(directory or MIGRATIONS_DIR)}
            with _connect() as conn:
                applied = {row[0] for row in conn.execute("SELECT version FROM schema_migrations").fetchall()}
            return wanted <= applied
        except Exception as exc:
            logger.warning("schema check failed: %s", type(exc).__name__)
            return False

    if directory is not None:  # an explicit directory is a test or tool call: never cached
        return compute()
    return _cached("schema", compute)


def worker_ready() -> bool:
    """No separate worker process exists yet (F29), so processing is not available.

    Reported honestly as False until the worker writes a heartbeat that this function can read.
    """
    return False
