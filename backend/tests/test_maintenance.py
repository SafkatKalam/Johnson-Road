"""F41: orphan scan and controlled source deletion. Real PostgreSQL and files."""
import os
import time

import pytest
from test_jobs_api import avi, ctx, queue, store, worker  # noqa: F401
from test_org_api import scalar, tok

from app import maintenance

pytestmark = pytest.mark.usefixtures("confirmed_email")


def test_retention_is_off():
    assert maintenance.retention_enabled() is False


def test_orphan_scan_reports_old_strays_only_and_deletes_only_when_asked(client, ctx, auth_db, store):
    org, pid, uid, base = ctx
    stray = store.root / "outputs" / org.id / pid / "00000000-0000-0000-0000-000000000001.mp4"
    stray.parent.mkdir(parents=True, exist_ok=True)
    stray.write_bytes(b"x")
    fresh = stray.with_name("00000000-0000-0000-0000-000000000002.mp4")
    fresh.write_bytes(b"y")
    old = time.time() - 7200
    os.utime(stray, (old, old))
    with auth_db() as db:
        report = maintenance.orphan_scan(db, store)
    assert report["orphans"] == [f"outputs/{org.id}/{pid}/00000000-0000-0000-0000-000000000001.mp4"]
    assert report["missingFiles"] == [] and stray.exists()                  # report only
    with auth_db() as db:
        maintenance.orphan_scan(db, store, apply=True)
    assert not stray.exists() and fresh.exists()                            # the fresh file may still be being written
    assert store.exists("sources", scalar(org.maker, "select storage_key from uploads"))   # real files untouched


def test_missing_file_is_reported(client, ctx, auth_db, store):
    org, pid, uid, base = ctx
    key = scalar(org.maker, "select storage_key from uploads")
    store.delete("sources", key)
    with auth_db() as db:
        assert maintenance.orphan_scan(db, store)["missingFiles"] == [f"sources/{key}"]


def test_source_delete_keeps_results_refuses_busy_and_needs_admin(client, ctx, auth_db, store):
    org, pid, uid, base = ctx
    jid = queue(client, base).json()["job"]["id"]
    url = f"{base}/delete-source"
    assert client.post(url, headers=tok(1)).json()["error"]["code"] == "upload_in_use"     # queued job
    worker(auth_db, store).process_one()
    assert client.post(url, headers=tok(3)).status_code == 403                             # researcher
    assert client.post(url, headers=tok(1)).status_code == 204
    assert client.post(url, headers=tok(1)).status_code == 204                             # repeat is harmless
    assert [f for f in (store.root / "sources").rglob("*") if f.is_file()] == []
    assert client.get(f"/api/jobs/{jid}/results", headers=tok(1)).json()["vehiclesCounted"] == 1   # results stay
    assert queue(client, base).status_code == 410                                          # no new processing
