"""F5: migrations and schema rules, run against a real PostgreSQL (a throwaway database).

Skipped when the PostgreSQL container is not reachable. Deferred-trigger rules are tested with real
commits (FD18), not with rollback-only tests.
"""
import json
import shutil
import threading

import psycopg
import pytest
from psycopg import errors

from app.database import migrate as m

# The db_url / migrated fixtures live in conftest.py and skip these tests when PostgreSQL is not running.


# --- runner ---------------------------------------------------------------------

def test_migration_creates_all_21_tables(migrated):
    with psycopg.connect(migrated) as conn:
        names = {r[0] for r in conn.execute(
            "select table_name from information_schema.tables where table_schema='public' and table_name <> 'schema_migrations'")}
    assert len(names) == 21
    assert {"users", "jobs", "job_results", "count_buckets", "audit_events", "settings"} <= names


def test_second_run_applies_nothing_and_status_says_applied(migrated):
    assert m.migrate(migrated) == []
    assert m.status(migrated) == [("0001", "0001_initial.sql", True)]


def test_settings_seed_has_seven_undecided_keys(migrated):
    with psycopg.connect(migrated) as conn:
        rows = conn.execute("select key, value from settings").fetchall()
    assert len(rows) == 7 and all(v is None for _, v in rows)


def test_changed_applied_file_is_refused(migrated, tmp_path):
    copy = tmp_path / "migrations"
    shutil.copytree(m.MIGRATIONS_DIR, copy)
    (copy / "0001_initial.sql").write_text("-- edited\n" + (copy / "0001_initial.sql").read_text(encoding="utf-8"), encoding="utf-8")
    with pytest.raises(m.MigrationError, match="changed after it was applied"):
        m.migrate(migrated, copy)


@pytest.mark.parametrize("sql", [
    "BEGIN;\nSELECT 1;\nCOMMIT;\n",
    "begin transaction;\nSELECT 1;\n",
    "START TRANSACTION;\nSELECT 1;\n",
    "SELECT 1;\nROLLBACK;\n",
    "CREATE INDEX CONCURRENTLY i ON t (c);\n",
])
def test_file_with_transaction_statements_is_refused(tmp_path, sql):
    (tmp_path / "0001_x.sql").write_text(sql, encoding="utf-8")
    with pytest.raises(m.MigrationError, match="must not contain"):
        m.load_migrations(tmp_path)


@pytest.mark.parametrize("sql", [
    "CREATE TABLE t (id int); COMMIT;",                    # on the same line as other SQL
    "SELECT 1;\n  commit and chain;",
    "BEGIN ISOLATION LEVEL SERIALIZABLE;",
    "BEGIN READ WRITE;",
    "END;",                                                # top-level END is a COMMIT
    "SAVEPOINT a;",
    "ROLLBACK TO SAVEPOINT a;",
    "RELEASE SAVEPOINT a;",
    "SET TRANSACTION READ ONLY;",
    "PREPARE TRANSACTION 'x';",
    "SELECT 'a--b'; BEGIN;",                               # a quote does not hide what follows
    "/* note */ BEGIN;",
])
def test_guard_catches_transaction_control_in_every_form(tmp_path, sql):
    (tmp_path / "0001_x.sql").write_text(sql + "\n", encoding="utf-8")
    with pytest.raises(m.MigrationError, match="must not contain"):
        m.load_migrations(tmp_path)


@pytest.mark.parametrize("sql", [
    "-- begin the table; commit later\nSELECT 'begin';\n",
    "/* BEGIN;\nCOMMIT; CONCURRENTLY */ SELECT 1;\n",       # block comment is ignored
    "SELECT 'x; COMMIT; y';\n",                            # inside a string
    "CREATE FUNCTION f() RETURNS int LANGUAGE plpgsql AS $$\nBEGIN\n  RETURN 1;\nEND $$;\n",
    "CREATE FUNCTION g() RETURNS int LANGUAGE plpgsql AS $body$\nBEGIN RETURN 2; END\n$body$;\n",
    'CREATE TABLE "begin" (id int);\n',                    # quoted identifier
])
def test_guard_ignores_comments_strings_and_function_bodies(tmp_path, sql):
    (tmp_path / "0001_x.sql").write_text(sql, encoding="utf-8")
    assert len(m.load_migrations(tmp_path)) == 1


def test_the_real_initial_migration_passes_the_guard():
    assert [x.version for x in m.load_migrations()] == ["0001"]


def test_status_is_read_only_and_does_not_create_the_table(db_url):
    assert m.status(db_url) == [("0001", "0001_initial.sql", False)]
    with psycopg.connect(db_url) as conn:
        assert conn.execute("select to_regclass('public.schema_migrations') is null").fetchone()[0] is True


def _lock_is_free(url) -> bool:
    with psycopg.connect(url) as probe:
        got = probe.execute("select pg_try_advisory_lock(%s)", (m._LOCK_KEY,)).fetchone()[0]
        if got:
            probe.execute("select pg_advisory_unlock(%s)", (m._LOCK_KEY,))
        return got


def test_locked_block_unlocks_even_when_it_fails_and_the_connection_stays_open(db_url):
    """Checks the unlock itself: the connection is NOT closed before the check (closing would free the lock anyway)."""
    with psycopg.connect(db_url) as conn:
        with pytest.raises(RuntimeError):
            with m._Locked(conn):
                assert _lock_is_free(db_url) is False  # held while inside
                raise RuntimeError("boom")
        assert _lock_is_free(db_url) is True  # released by __exit__, connection still open


def test_lock_is_released_after_a_failed_migration(db_url, tmp_path):
    (tmp_path / "0001_bad.sql").write_text("SELECT * FROM does_not_exist;\n", encoding="utf-8")
    with pytest.raises(m.MigrationError):
        m.migrate(db_url, tmp_path)
    assert _lock_is_free(db_url) is True


def test_second_runner_gives_up_with_a_clear_message_when_the_lock_is_held(db_url, monkeypatch):
    monkeypatch.setattr(m, "_LOCK_WAIT", "500ms")
    with psycopg.connect(db_url) as holder:
        holder.execute("select pg_advisory_lock(%s)", (m._LOCK_KEY,))
        with pytest.raises(m.MigrationError, match="another migration run holds the lock"):
            m.migrate(db_url)
        holder.execute("select pg_advisory_unlock(%s)", (m._LOCK_KEY,))
    assert m.migrate(db_url) == ["0001"]  # and works once the holder is gone


def test_lock_timeout_is_reset_so_later_statements_are_not_limited(db_url, tmp_path):
    (tmp_path / "0001_check.sql").write_text(
        "CREATE TABLE seen (v text);\nINSERT INTO seen SELECT current_setting('lock_timeout');\n", encoding="utf-8")
    m.migrate(db_url, tmp_path)
    with psycopg.connect(db_url) as conn:
        assert conn.execute("select v from seen").fetchone()[0] == "0"  # 0 = no limit


def test_two_runners_at_once_apply_the_migration_exactly_once(db_url):
    results, errors_seen = [], []

    def run():
        try:
            results.append(m.migrate(db_url))
        except Exception as exc:  # noqa: BLE001 - the test reports whatever happened
            errors_seen.append(exc)

    threads = [threading.Thread(target=run) for _ in range(2)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    assert not errors_seen
    assert sorted(v for r in results for v in r) == ["0001"]


def test_baseline_refuses_a_different_checksum(migrated, tmp_path):
    copy = tmp_path / "migrations"
    shutil.copytree(m.MIGRATIONS_DIR, copy)
    (copy / "0001_initial.sql").write_text("-- edited\n" + (copy / "0001_initial.sql").read_text(encoding="utf-8"), encoding="utf-8")
    with pytest.raises(m.MigrationError, match="different checksum"):
        m.baseline("0001", migrated, copy)


def test_failed_migration_rolls_back_everything(db_url, tmp_path):
    (tmp_path / "0001_ok.sql").write_text("CREATE TABLE t1 (id int);\n", encoding="utf-8")
    (tmp_path / "0002_bad.sql").write_text("CREATE TABLE t2 (id int);\nSELECT * FROM does_not_exist;\n", encoding="utf-8")
    with pytest.raises(m.MigrationError, match="0002_bad.sql failed and was rolled back"):
        m.migrate(db_url, tmp_path)
    with psycopg.connect(db_url) as conn:
        tables = {r[0] for r in conn.execute("select table_name from information_schema.tables where table_schema='public'")}
        versions = [r[0] for r in conn.execute("select version from schema_migrations")]
    assert "t1" in tables and "t2" not in tables  # 0001 stays, 0002 left nothing behind
    assert versions == ["0001"]


def test_baseline_marks_applied_without_running(db_url):
    m.baseline("0001", db_url)
    assert m.migrate(db_url) == []
    with psycopg.connect(db_url) as conn:
        assert conn.execute("select count(*) from information_schema.tables where table_name='users'").fetchone()[0] == 0


# --- schema rules ---------------------------------------------------------------

class World:
    """Inserts the minimum rows a job needs."""

    def __init__(self, conn):
        self.conn = conn
        q = lambda sql, *a: conn.execute(sql, a).fetchone()[0]  # noqa: E731
        self.user = q("insert into users (auth_subject, email) values ('sub-1','a@example.com') returning id")
        self.org = q("insert into organizations (name, slug) values ('Org','org') returning id")
        self.project = q("insert into projects (organization_id, name) values (%s,'P') returning id", self.org)
        self.upload = q(
            """insert into uploads (organization_id, project_id, original_name, storage_key, extension, status,
                 size_bytes, checksum_sha256, duration_seconds, width_px, height_px, frame_rate)
               values (%s,%s,'a.mp4','k1.mp4','mp4','ready',10,'abc',5,640,480,25) returning id""",
            self.org, self.project)
        self.config = q(
            """insert into analysis_configurations (organization_id, project_id, upload_id, version_no, model_name, tracker,
                 confidence_threshold, iou_threshold, classes)
               values (%s,%s,%s,1,'yolov8n','bytetrack',0.25,0.45,%s) returning id""",
            self.org, self.project, self.upload, json.dumps(["car"]))

    def job(self, **extra) -> str:
        cols = {"organization_id": self.org, "project_id": self.project, "upload_id": self.upload,
                "configuration_id": self.config, "metadata_snapshot": json.dumps({})}
        cols.update(extra)
        keys = ", ".join(cols)
        marks = ", ".join(["%s"] * len(cols))
        return self.conn.execute(f"insert into jobs ({keys}) values ({marks}) returning id", list(cols.values())).fetchone()[0]


@pytest.fixture()
def world(migrated):
    with psycopg.connect(migrated) as conn:
        w = World(conn)
        conn.commit()
        yield w


def test_one_owner_per_organisation(world):
    c = world.conn
    u2 = c.execute("insert into users (auth_subject, email) values ('sub-2','b@example.com') returning id").fetchone()[0]
    c.execute("insert into organization_members (organization_id, user_id, role) values (%s,%s,'owner')", (world.org, world.user))
    with pytest.raises(errors.UniqueViolation):
        c.execute("insert into organization_members (organization_id, user_id, role) values (%s,%s,'owner')", (world.org, u2))


def test_invite_cannot_make_an_owner(world):
    with pytest.raises(errors.CheckViolation):
        world.conn.execute(
            "insert into organization_invites (organization_id, email, role, token_hash, invited_by, expires_at) "
            "values (%s,'x@example.com','owner','h',%s, now())", (world.org, world.user))


def test_recording_time_24_00_is_refused(world):
    with pytest.raises(errors.CheckViolation):
        world.conn.execute("update uploads set recorded_end_time = '24:00' where id = %s", (world.upload,))


def test_configuration_classes_must_be_a_nonempty_array(world):
    for bad in ("[]", '"car"', "{}"):
        with pytest.raises(errors.CheckViolation):
            world.conn.execute(
                """insert into analysis_configurations (organization_id, project_id, upload_id, version_no, model_name, tracker,
                     confidence_threshold, iou_threshold, classes) values (%s,%s,%s,2,'m','sort',0.3,0.5,%s)""",
                (world.org, world.project, world.upload, bad))
        world.conn.rollback()


def test_new_job_must_start_queued(world):
    with pytest.raises(errors.CheckViolation, match="must start as queued"):
        world.job(status="running", started_at="2026-01-01")


def test_job_moves_allowed_and_refused(world):
    c = world.conn
    job = world.job()
    c.execute("update jobs set status='running', started_at=now() where id=%s", (job,))
    with pytest.raises(errors.CheckViolation, match="not allowed"):
        c.execute("update jobs set status='queued' where id=%s", (job,))  # running -> queued
    c.rollback()
    job2 = world.job()
    with pytest.raises(errors.CheckViolation, match="not allowed"):
        c.execute("update jobs set status='completed', started_at=now(), finished_at=now(), progress_percent=100 where id=%s", (job2,))


def test_failed_job_retry_only_if_retryable(world):
    c = world.conn
    job = world.job()
    c.execute("update jobs set status='running', started_at=now() where id=%s", (job,))
    c.execute("""update jobs set status='failed', finished_at=now(), error_code='e', safe_message='m', diagnostic_id='d',
                 is_retryable=false where id=%s""", (job,))
    with pytest.raises(errors.CheckViolation, match="not allowed"):
        c.execute("update jobs set status='queued' where id=%s", (job,))
    c.rollback()
    c.execute("update jobs set is_retryable=true where id=%s", (job,))
    c.execute("update jobs set status='queued' where id=%s", (job,))


def test_failed_job_needs_error_code_message_and_diagnostic_id(world):
    c = world.conn
    job = world.job()
    c.execute("update jobs set status='running', started_at=now() where id=%s", (job,))
    with pytest.raises(errors.CheckViolation):
        c.execute("update jobs set status='failed', finished_at=now() where id=%s", (job,))


def _complete_columns():
    return "status='completed', finished_at=now(), progress_percent=100"


def test_completed_without_result_fails_at_commit(world):
    """FD18: the deferred rule fires at a real COMMIT, not before."""
    c = world.conn
    job = world.job()
    c.execute("update jobs set status='running', started_at=now() where id=%s", (job,))
    c.commit()
    c.execute(f"update jobs set {_complete_columns()} where id=%s", (job,))  # no error yet
    with pytest.raises(errors.CheckViolation, match="completed without a result"):
        c.commit()
    c.rollback()
    assert c.execute("select status from jobs where id=%s", (job,)).fetchone()[0] == "running"


def test_result_then_completed_in_one_transaction_commits(world):
    c = world.conn
    job = world.job()
    c.execute("update jobs set status='running', started_at=now() where id=%s", (job,))
    c.commit()
    c.execute(
        """insert into job_results (job_id, upload_id, configuration_id, model_name, model_file_sha256, code_version,
             method, bucket_seconds, frames_processed) values (%s,%s,%s,'yolov8n','sha','v1','line_crossing',900,100)""",
        (job, world.upload, world.config))
    c.execute(f"update jobs set {_complete_columns()} where id=%s", (job,))
    c.commit()
    assert c.execute("select status from jobs where id=%s", (job,)).fetchone()[0] == "completed"


def test_result_refused_unless_job_running(world):
    job = world.job()  # still queued
    with pytest.raises(errors.CheckViolation, match="not running"):
        world.conn.execute(
            """insert into job_results (job_id, upload_id, configuration_id, model_name, model_file_sha256, code_version,
                 method, bucket_seconds, frames_processed) values (%s,%s,%s,'m','s','v','line_crossing',900,1)""",
            (job, world.upload, world.config))


def test_creating_a_job_locks_the_configuration_and_locked_rows_refuse_changes(world):
    c = world.conn
    zone = c.execute("insert into counting_zones (configuration_id, name) values (%s,'z') returning id", (world.config,)).fetchone()[0]
    world.job()
    c.commit()  # keep the zone and the job, so later rollbacks only undo the refused statement
    assert c.execute("select locked_at is not null from analysis_configurations where id=%s", (world.config,)).fetchone()[0]
    with pytest.raises(errors.CheckViolation, match="locked"):
        c.execute("update analysis_configurations set frame_skip = 2 where id=%s", (world.config,))
    c.rollback()
    with pytest.raises(errors.CheckViolation, match="locked"):
        c.execute("insert into counting_lines (configuration_id, x1,y1,x2,y2) values (%s,0,0,1,1)", (world.config,))
    c.rollback()
    with pytest.raises(errors.CheckViolation, match="locked"):
        c.execute("insert into zone_points (zone_id, seq, x, y) values (%s,0,0.1,0.1)", (zone,))
    c.rollback()
    with pytest.raises(errors.CheckViolation, match="locked"):
        c.execute("delete from counting_zones where id=%s", (zone,))


def test_purge_setting_allows_delete_of_locked_rows(world):
    c = world.conn
    zone = c.execute("insert into counting_zones (configuration_id) values (%s) returning id", (world.config,)).fetchone()[0]
    world.job()
    c.commit()
    c.execute("set local jr.purge = 'on'")
    c.execute("delete from counting_zones where id=%s", (zone,))  # allowed during the purge
    c.rollback()


def test_count_bucket_check_constraint(migrated):
    with psycopg.connect(migrated) as c:
        w = World(c)
        zone = c.execute("insert into counting_zones (configuration_id) values (%s) returning id", (w.config,)).fetchone()[0]
        line = c.execute("insert into counting_lines (configuration_id, x1,y1,x2,y2) values (%s,0,0,1,1) returning id", (w.config,)).fetchone()[0]
        job = w.job()
        c.execute("update jobs set status='running', started_at=now() where id=%s", (job,))
        result = c.execute(
            """insert into job_results (job_id, upload_id, configuration_id, model_name, model_file_sha256, code_version,
                 method, bucket_seconds, frames_processed) values (%s,%s,%s,'m','s','v','zone_presence',900,1) returning id""",
            (job, w.upload, w.config)).fetchone()[0]
        c.commit()

        def bucket(line_id, zone_id, direction, idx=0):
            return c.execute(
                """insert into count_buckets (result_id, job_id, upload_id, configuration_id, bucket_index, bucket_start_s,
                     vehicle_class, direction, line_id, zone_id, vehicle_count) values (%s,%s,%s,%s,%s,0,'car',%s,%s,%s,1)""",
                (result, job, w.upload, w.config, idx, direction, line_id, zone_id))

        bucket(None, zone, "not_applicable")                       # zone presence: ok
        bucket(line, None, "forward", idx=1)                        # line crossing: ok
        for args in ((None, zone, "forward"), (line, None, "not_applicable"), (None, None, "not_applicable")):
            with pytest.raises(errors.CheckViolation):
                bucket(*args, idx=2)
            c.rollback()


def test_duplicate_count_rows_refused_even_with_nulls(migrated):
    with psycopg.connect(migrated) as c:
        w = World(c)
        zone = c.execute("insert into counting_zones (configuration_id) values (%s) returning id", (w.config,)).fetchone()[0]
        job = w.job()
        c.execute("update jobs set status='running', started_at=now() where id=%s", (job,))
        result = c.execute(
            """insert into job_results (job_id, upload_id, configuration_id, model_name, model_file_sha256, code_version,
                 method, bucket_seconds, frames_processed) values (%s,%s,%s,'m','s','v','zone_presence',900,1) returning id""",
            (job, w.upload, w.config)).fetchone()[0]
        sql = """insert into count_buckets (result_id, job_id, upload_id, configuration_id, bucket_index, bucket_start_s,
                   vehicle_class, direction, zone_id, vehicle_count) values (%s,%s,%s,%s,0,0,'car','not_applicable',%s,1)"""
        c.execute(sql, (result, job, w.upload, w.config, zone))
        with pytest.raises(errors.UniqueViolation):
            c.execute(sql, (result, job, w.upload, w.config, zone))


def test_audit_events_are_append_only(world):
    c = world.conn
    c.execute("insert into audit_events (action) values ('sign_in')")
    c.commit()
    with pytest.raises(errors.InsufficientPrivilege, match="append-only"):
        c.execute("update audit_events set action='x'")
    c.rollback()
    with pytest.raises(errors.InsufficientPrivilege, match="append-only"):
        c.execute("delete from audit_events")
    c.rollback()
    with pytest.raises(errors.InsufficientPrivilege, match="append-only"):
        c.execute("truncate audit_events")


def test_organisation_and_project_cannot_be_hard_deleted_while_used(world):
    c = world.conn
    with pytest.raises(errors.ForeignKeyViolation):
        c.execute("delete from projects where id=%s", (world.project,))
    c.rollback()
    with pytest.raises(errors.ForeignKeyViolation):
        c.execute("delete from organizations where id=%s", (world.org,))


def test_upload_ready_needs_metadata(world):
    with pytest.raises(errors.CheckViolation):
        world.conn.execute(
            "insert into uploads (organization_id, project_id, original_name, storage_key, extension, status) "
            "values (%s,%s,'b.mp4','k2.mp4','mp4','ready')", (world.org, world.project))
