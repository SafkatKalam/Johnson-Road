"""Fixes from the security review of 2026-11-17."""
import uuid

import cv2
import numpy as np
import pytest
from sqlalchemy import text
from test_jobs_api import avi, ctx, store  # noqa: F401
from test_org_api import scalar, tok

from app.engine.reader import ReaderError, read_batches
from app.routers.insights import _cell

pytestmark = pytest.mark.usefixtures("confirmed_email")


def test_anonymous_upload_is_refused_before_the_body_is_read(client):
    r = client.post(f"/api/projects/{uuid.uuid4()}/uploads", content=b"x" * 10, headers={"Content-Type": "multipart/form-data; boundary=b"})
    assert r.status_code == 401 and r.json()["error"]["code"] == "not_signed_in"


def test_declared_oversize_upload_is_refused_before_the_body_is_read(client, monkeypatch):
    monkeypatch.setattr("app.core.upload_guard.settings.upload_max_bytes", 10)
    r = client.post(f"/api/projects/{uuid.uuid4()}/uploads", content=b"x" * (2 * 1024 * 1024),
                    headers={"Authorization": "Bearer abcdefghijklmnopqrstuvwxyz", "Content-Type": "multipart/form-data; boundary=b"})
    assert r.status_code == 413 and r.json()["error"]["code"] == "file_too_large"


def test_csv_guard_covers_leading_spaces_and_full_width_signs():
    for bad in (" =1+1", "\t=1", "＝1", "  @cmd", "-2", "+3"):
        assert _cell(bad).startswith("'"), bad
    assert _cell("Ring Road") == "Ring Road"


def test_reader_stops_when_a_video_is_far_longer_than_its_header_says(tmp_path):
    p = tmp_path / "v.avi"
    w = cv2.VideoWriter(str(p), cv2.VideoWriter_fourcc(*"MJPG"), 10, (32, 32))
    for _ in range(40):
        w.write(np.zeros((32, 32, 3), np.uint8))
    w.release()
    with pytest.raises(ReaderError) as e:
        list(read_batches(p, fps=10, expected_frames=5))
    assert e.value.code == "frame_count_mismatch"


def test_crashed_receiving_upload_frees_its_key_after_30_minutes(client, ctx, avi):
    org, pid, uid, base = ctx
    with org.maker() as db:
        db.execute(text("""INSERT INTO uploads (organization_id, project_id, idempotency_key, original_name, storage_key, extension, updated_at)
                           SELECT organization_id, id, 'stuck-key-0001', 'a.avi', :k, 'avi', now() - interval '2 hours' FROM projects WHERE id = :p"""),
                   {"k": f"{org.id}/{pid}/{uuid.uuid4()}.avi", "p": pid})
        db.commit()
    h = dict(tok(1))
    h["Idempotency-Key"] = "stuck-key-0001"
    r = client.post(f"/api/projects/{pid}/uploads", files={"file": ("v.avi", avi, "video/x-msvideo")}, headers=h)
    assert r.status_code == 201, r.text
    assert scalar(org.maker, "select count(*) from uploads where failure_code = 'interrupted'") == 1


def test_old_sample_routes_cannot_write_files(client, ctx):
    r = client.post("/api/uploads", files={"file": ("../../x.py", b"print(1)", "text/plain")}, headers=tok(1))
    assert r.status_code in (404, 405)
