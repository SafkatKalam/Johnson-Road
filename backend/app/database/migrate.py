"""Numbered SQL migrations for PostgreSQL.

Run from backend/:
    python -m app.database.migrate            apply every pending migration
    python -m app.database.migrate --status   show applied / pending (changes nothing)
    python -m app.database.migrate --baseline 0001   record 0001 as applied without running it
                                              (only for a database whose schema was loaded by hand)

Rules:
- Files live in backend/migrations/ and are named NNNN_description.sql.
- A migration file has no transaction statements: the runner runs the file and writes its
  schema_migrations row in ONE transaction, so a failure leaves nothing behind.
  CREATE INDEX CONCURRENTLY and similar commands that cannot run inside a transaction are not supported.
- An applied file must never be edited: its checksum is stored and checked on every run.
- Two runners at once are blocked by a PostgreSQL advisory lock (which is taken before anything else).
"""
from __future__ import annotations

import argparse
import hashlib
import re
import sys
from dataclasses import dataclass
from pathlib import Path

import psycopg

from app.core.config import BACKEND_DIR, settings

MIGRATIONS_DIR = BACKEND_DIR / "migrations"
_NAME = re.compile(r"^(\d{4})_[a-z0-9_]+\.sql$")
# What the runner removes before looking at statements: comments, quoted strings and $$...$$ bodies
# (a plpgsql function body has its own BEGIN/END, which are fine). One pass, so a "--" inside a
# string is not mistaken for a comment and a quote inside a comment is not mistaken for a string.
_NOISE = re.compile(
    r"--[^\n]*"                      # line comment
    r"|/\*.*?\*/"                    # block comment
    r"|\$\$.*?\$\$"                  # dollar-quoted body
    r"|\$([A-Za-z_]\w*)\$.*?\$\1\$"  # dollar-quoted body with a tag, e.g. $body$ ... $body$
    r"|'(?:[^']|'')*'"               # single-quoted string
    r'|"(?:[^"]|"")*"',              # quoted identifier
    re.DOTALL,
)
# A statement that starts with one of these controls the transaction, which only the runner may do.
_TRANSACTION_START = re.compile(
    r"^\s*(?:BEGIN|START|COMMIT|END|ROLLBACK|ABORT|SAVEPOINT|RELEASE|PREPARE\s+TRANSACTION"
    r"|COMMIT\s+PREPARED|ROLLBACK\s+PREPARED|SET\s+TRANSACTION|SET\s+SESSION\s+CHARACTERISTICS)\b",
    re.IGNORECASE,
)
_CONCURRENTLY = re.compile(r"\bCONCURRENTLY\b", re.IGNORECASE)


def _forbidden_statement(sql: str) -> str | None:
    """The first forbidden statement in `sql`, or None."""
    code = _NOISE.sub(" ", sql)
    if _CONCURRENTLY.search(code):
        return "CONCURRENTLY"
    for statement in code.split(";"):
        match = _TRANSACTION_START.match(statement)
        if match:
            return match.group(0).strip().upper()
    return None
_LOCK_KEY = 70_050_001  # any fixed number; identifies "Johnson Road migrations"
_LOCK_WAIT = "30s"      # a second runner gives up after this instead of waiting forever


class MigrationError(Exception):
    pass


@dataclass(frozen=True)
class Migration:
    version: str
    filename: str
    sql: str
    checksum: str


def libpq_url(url: str | None = None) -> str:
    """psycopg wants postgresql://, not the SQLAlchemy postgresql+psycopg:// form."""
    if url is None:
        return settings.libpq_url
    return url.replace("postgresql+psycopg://", "postgresql://", 1)


def load_migrations(directory: Path = MIGRATIONS_DIR) -> list[Migration]:
    migrations: list[Migration] = []
    for path in sorted(directory.glob("*.sql")):
        match = _NAME.match(path.name)
        if not match:
            raise MigrationError(f"bad migration file name: {path.name} (expected NNNN_description.sql)")
        text = path.read_text(encoding="utf-8")
        bad = _forbidden_statement(text)
        if bad:
            raise MigrationError(
                f"{path.name} must not contain {bad}: the runner adds the transaction "
                "(BEGIN/COMMIT/ROLLBACK/SAVEPOINT/SET TRANSACTION and CONCURRENTLY are not allowed in a migration)"
            )
        migrations.append(Migration(match.group(1), path.name, text, hashlib.sha256(text.encode()).hexdigest()))
    versions = [m.version for m in migrations]
    if len(versions) != len(set(versions)):
        raise MigrationError("two migration files share a version number")
    return migrations


def _table_exists(conn: psycopg.Connection) -> bool:
    return conn.execute("SELECT to_regclass('public.schema_migrations') IS NOT NULL").fetchone()[0]


def _ensure_table(conn: psycopg.Connection) -> None:
    conn.execute(
        """CREATE TABLE IF NOT EXISTS schema_migrations (
             version     text PRIMARY KEY,
             filename    text NOT NULL,
             checksum    text NOT NULL,
             applied_at  timestamptz NOT NULL DEFAULT now())"""
    )
    conn.commit()


def _applied(conn: psycopg.Connection) -> dict[str, tuple[str, str]]:
    rows = conn.execute("SELECT version, filename, checksum FROM schema_migrations").fetchall()
    conn.commit()
    return {version: (filename, checksum) for version, filename, checksum in rows}


def _check_applied(migrations: list[Migration], applied: dict[str, tuple[str, str]]) -> None:
    known = {m.version: m for m in migrations}
    for version, (filename, checksum) in applied.items():
        if version not in known:
            raise MigrationError(f"database has migration {version} ({filename}) but the file is missing")
        if known[version].checksum != checksum:
            raise MigrationError(f"{filename} was changed after it was applied; add a new migration instead")


class _Locked:
    """Holds the advisory lock for the length of a with-block. Takes the lock before any other work."""

    def __init__(self, conn: psycopg.Connection) -> None:
        self.conn = conn

    def __enter__(self):
        try:
            self.conn.execute(f"SET lock_timeout = '{_LOCK_WAIT}'")
            self.conn.execute("SELECT pg_advisory_lock(%s)", (_LOCK_KEY,))
            # The timeout is only for waiting on THIS lock; a later migration may legitimately wait longer.
            self.conn.execute("RESET lock_timeout")
            self.conn.commit()
        except psycopg.errors.LockNotAvailable as exc:
            self.conn.rollback()
            raise MigrationError(f"another migration run holds the lock (waited {_LOCK_WAIT})") from exc
        return self

    def __exit__(self, *exc_info):
        try:
            self.conn.rollback()  # clear any failed transaction so the unlock can run
            self.conn.execute("SELECT pg_advisory_unlock(%s)", (_LOCK_KEY,))
            self.conn.commit()
        except psycopg.Error:
            pass  # the lock is released when the session closes; never hide the real error
        return False


def status(url: str | None = None, directory: Path = MIGRATIONS_DIR) -> list[tuple[str, str, bool]]:
    """Applied / pending list. Read-only: it does not create the schema_migrations table."""
    migrations = load_migrations(directory)
    with psycopg.connect(libpq_url(url), connect_timeout=10) as conn:
        applied = _applied(conn) if _table_exists(conn) else {}
    return [(m.version, m.filename, m.version in applied) for m in migrations]


def migrate(url: str | None = None, directory: Path = MIGRATIONS_DIR) -> list[str]:
    """Apply pending migrations in order. Returns the versions applied now."""
    migrations = load_migrations(directory)
    done: list[str] = []
    with psycopg.connect(libpq_url(url), connect_timeout=10) as conn:
        with _Locked(conn):
            _ensure_table(conn)
            applied = _applied(conn)
            _check_applied(migrations, applied)
            for m in migrations:
                if m.version in applied:
                    continue
                try:
                    with conn.transaction():
                        conn.execute(m.sql)  # no parameters: % and $$ in the SQL are left alone
                        conn.execute(
                            "INSERT INTO schema_migrations (version, filename, checksum) VALUES (%s, %s, %s)",
                            (m.version, m.filename, m.checksum),
                        )
                except psycopg.Error as exc:
                    raise MigrationError(f"{m.filename} failed and was rolled back: {exc}") from exc
                done.append(m.version)
    return done


def baseline(version: str, url: str | None = None, directory: Path = MIGRATIONS_DIR) -> None:
    """Record a migration as applied without running it (schema was loaded by hand)."""
    match = next((m for m in load_migrations(directory) if m.version == version), None)
    if match is None:
        raise MigrationError(f"no migration file with version {version}")
    with psycopg.connect(libpq_url(url), connect_timeout=10) as conn:
        with _Locked(conn):
            _ensure_table(conn)
            existing = _applied(conn).get(version)
            if existing is not None:
                if existing[1] != match.checksum:
                    raise MigrationError(f"{match.filename} is already recorded with a different checksum")
                return
            conn.execute(
                "INSERT INTO schema_migrations (version, filename, checksum) VALUES (%s, %s, %s)",
                (match.version, match.filename, match.checksum),
            )
            conn.commit()


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Johnson Road database migrations")
    parser.add_argument("--status", action="store_true", help="show applied and pending migrations")
    parser.add_argument("--baseline", metavar="VERSION", help="record VERSION as applied without running it")
    args = parser.parse_args(argv)
    try:
        if args.baseline:
            baseline(args.baseline)
            print(f"recorded {args.baseline} as applied")
        elif args.status:
            for _version, filename, is_applied in status():
                print(f"{'applied' if is_applied else 'PENDING':8} {filename}")
        else:
            done = migrate()
            print("applied: " + ", ".join(done) if done else "nothing to apply")
    except (MigrationError, psycopg.Error) as exc:
        print(f"migration error: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
