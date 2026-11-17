"""F22/F23: streamed upload, validation with the real reader, preview, metadata, removal. Real PostgreSQL, real video files."""
import uuid

import cv2
import numpy as np
import pytest
from sqlalchemy import text
from test_org_api import Org, scalar, tok

from app.storage import LocalStorage

pytestmark = pytest.mark.usefixtures("confirmed_email")


def make_video(path, frames=30, fps=10, size=(64, 48), codec="MJPG"):
    w = cv2.VideoWriter(str(path), cv2.VideoWriter_fourcc(*codec), fps, size)
    assert w.isOpened(), "this machine cannot write the test codec"
    for i in range(frames):
        img = np.full((size[1], size[0], 3), (i * 7) % 255, dtype=np.uint8)
        w.write(img)
    w.release()
    return path.read_bytes()


@pytest.fixture(scope="module")
def avi_bytes(tmp_path_factory):
    return make_video(tmp_path_factory.mktemp("vid") / "t.avi")


@pytest.fixture()
def store(tmp_path, monkeypatch):
    s = LocalStorage(tmp_path / "data")
    (tmp_path / "data").mkdir()
    monkeypatch.setattr("app.routers.project_uploads.storage", s)
    return s


@pytest.fixture()
def ctx(client, verifier, auth_db, store):
    org = Org(client, auth_db)
    org.add(3, "researcher")
    pid = client.post("/api/projects", json={"name": "Ring Road"}, headers=tok(1)).json()["project"]["id"]
    return org, pid


def up(client, pid, data, who=1, name="clip.avi", key=None, **fields):
    headers = dict(tok(who))
    if key:
        headers["Idempotency-Key"] = key
    return client.post(f"/api/projects/{pid}/uploads", files={"file": (name, data, "video/x-msvideo")}, data=fields, headers=headers)


def files_under(store):
    return [p for p in store.root.rglob("*") if p.is_file()]


def test_good_upload_is_measured_and_gets_a_real_preview(client, ctx, store, avi_bytes):
    org, pid = ctx
    r = up(client, pid, avi_bytes, cameraId="CAM-1", recordedDate="2026-11-07", recordedStartTime="08:00", recordedEndTime="09:30")
    assert r.status_code == 201, r.text
    u = r.json()["upload"]
    assert (u["widthPx"], u["heightPx"], u["frameCount"], u["status"]) == (64, 48, 30, "ready")
    assert u["frameRate"] == 10.0 and u["durationSeconds"] == 3.0 and u["sizeBytes"] == len(avi_bytes)
    assert u["metadata"]["cameraId"] == "CAM-1" and u["metadata"]["recordedStartTime"] == "08:00:00"
    assert u["jobCount"] == 0
    assert scalar(org.maker, "select count(*) from jobs") == 0            # upload never creates a job (FD8)
    prev = client.get(f"/api/projects/{pid}/uploads/{u['id']}/preview", headers=tok(1))
    assert prev.status_code == 200 and prev.headers["content-type"] == "image/jpeg"
    img = cv2.imdecode(np.frombuffer(prev.content, np.uint8), cv2.IMREAD_COLOR)
    assert img.shape[:2] == (48, 64)                                       # real frame, same size as the video
    assert len(files_under(store)) == 2


def test_stored_name_never_contains_the_client_name(client, ctx, store, avi_bytes):
    org, pid = ctx
    up(client, pid, avi_bytes, name="..\\..\\evil name.avi")
    key = scalar(org.maker, "select storage_key from uploads")
    assert "evil" not in key and ".." not in key
    assert scalar(org.maker, "select original_name from uploads") == "evil name.avi"


def test_wrong_type_and_forged_extension_are_refused(client, ctx, store, avi_bytes):
    org, pid = ctx
    assert up(client, pid, b"hello", name="a.txt").status_code == 415
    assert up(client, pid, b"just text pretending", name="a.mp4").status_code == 415
    assert up(client, pid, avi_bytes, name="a.mp4").status_code == 415      # an AVI renamed .mp4
    assert files_under(store) == []
    assert scalar(org.maker, "select count(*) from uploads") == 0


def test_corrupt_and_empty_videos_leave_nothing_ready(client, ctx, store, avi_bytes):
    org, pid = ctx
    r = up(client, pid, avi_bytes[:200] + b"\x00" * 300)                   # right signature, damaged body
    assert r.status_code in (422,) and r.json()["error"]["code"] in ("unreadable_video", "empty_video"), r.text
    assert up(client, pid, b"RIFF\x00\x00\x00\x00AVI ").status_code == 422
    assert files_under(store) == []
    assert scalar(org.maker, "select count(*) from uploads where status = 'ready'") == 0
    assert scalar(org.maker, "select count(*) from uploads where status = 'failed'") == 2
    assert client.get(f"/api/projects/{pid}/uploads", headers=tok(1)).json()["total"] == 0


def test_oversize_is_refused_and_removed(client, ctx, store, avi_bytes, monkeypatch):
    org, pid = ctx
    monkeypatch.setattr("app.routers.project_uploads.settings.upload_max_bytes", 1000)
    r = up(client, pid, avi_bytes)
    assert r.status_code == 413 and r.json()["error"]["code"] == "file_too_large"
    assert files_under(store) == []


def test_too_long_video_is_refused(client, ctx, store, avi_bytes, monkeypatch):
    org, pid = ctx
    monkeypatch.setattr("app.routers.project_uploads.settings.upload_max_duration_seconds", 1)
    r = up(client, pid, avi_bytes)
    assert r.status_code == 422 and r.json()["error"]["code"] == "video_too_long"
    assert files_under(store) == []


def test_invalid_metadata_fails_before_anything_is_stored(client, ctx, store, avi_bytes):
    org, pid = ctx
    for bad in ({"recordedDate": "07/11/2026"}, {"recordedStartTime": "24:00"}, {"recordedStartTime": "10:00", "recordedEndTime": "09:00"},
                {"cameraId": "x" * 101}, {"recordedStartTime": "08:00+01:00"}):
        r = up(client, pid, avi_bytes, **bad)
        assert r.status_code == 422, (bad, r.text)
    assert files_under(store) == [] and scalar(org.maker, "select count(*) from uploads") == 0


def test_retry_with_same_key_returns_the_same_video(client, ctx, store, avi_bytes):
    org, pid = ctx
    first = up(client, pid, avi_bytes, key="retry-key-0001")
    again = up(client, pid, avi_bytes, key="retry-key-0001")
    assert first.status_code == 201 and again.status_code == 200
    assert again.json()["replayed"] is True and again.json()["upload"]["id"] == first.json()["upload"]["id"]
    assert scalar(org.maker, "select count(*) from uploads") == 1 and len(files_under(store)) == 2
    assert up(client, pid, avi_bytes, key="bad key!").status_code == 422


def test_failed_upload_can_be_retried_with_the_same_key(client, ctx, store, avi_bytes):
    org, pid = ctx
    assert up(client, pid, avi_bytes[:100] + b"\x00" * 100, key="retry-key-0002").status_code == 422
    ok = up(client, pid, avi_bytes, key="retry-key-0002")
    assert ok.status_code == 201 and ok.json()["replayed"] is False


def test_unfinished_receiving_row_blocks_a_duplicate_key(client, ctx, store, avi_bytes):
    org, pid = ctx
    with org.maker() as db:
        db.execute(text("""INSERT INTO uploads (organization_id, project_id, idempotency_key, original_name, storage_key, extension)
                           SELECT organization_id, id, 'retry-key-0003', 'a.avi', :k, 'avi' FROM projects WHERE id = :p"""),
                   {"k": f"{org.id}/{pid}/{uuid.uuid4()}.avi", "p": pid})
        db.commit()
    r = up(client, pid, avi_bytes, key="retry-key-0003")
    assert r.status_code == 409 and r.json()["error"]["code"] == "upload_in_progress"


def test_another_organisation_cannot_use_or_see_the_project_videos(client, ctx, store, avi_bytes):
    org, pid = ctx
    u = up(client, pid, avi_bytes).json()["upload"]
    Org(client, org.maker, owner=9, name="Other")
    assert up(client, pid, avi_bytes, who=9).status_code == 404
    assert client.get(f"/api/projects/{pid}/uploads", headers=tok(9)).status_code == 404
    assert client.get(f"/api/projects/{pid}/uploads/{u['id']}", headers=tok(9)).status_code == 404
    assert client.get(f"/api/projects/{pid}/uploads/{u['id']}/preview", headers=tok(9)).status_code == 404
    assert client.delete(f"/api/projects/{pid}/uploads/{u['id']}", headers=tok(9)).status_code == 404


def test_archived_project_accepts_no_new_video(client, ctx, store, avi_bytes):
    org, pid = ctx
    client.post(f"/api/projects/{pid}/archive", headers=tok(1))
    r = up(client, pid, avi_bytes)
    assert r.status_code == 409 and r.json()["error"]["code"] == "project_archived"


def test_metadata_edit_then_locked_after_first_job_except_notes(client, ctx, store, avi_bytes):
    org, pid = ctx
    u = up(client, pid, avi_bytes, cameraId="CAM-1").json()["upload"]
    url = f"/api/projects/{pid}/uploads/{u['id']}"
    r = client.patch(url, json={"cameraId": "CAM-2", "notes": "n1"}, headers=tok(3))
    assert r.status_code == 200 and r.json()["upload"]["metadata"]["cameraId"] == "CAM-2"
    assert client.patch(url, json={"recordedStartTime": "10:00", "recordedEndTime": "09:00"}, headers=tok(1)).status_code == 422
    assert client.patch(url, json={}, headers=tok(1)).status_code == 422
    assert client.patch(url, json={"sizeBytes": 1}, headers=tok(1)).status_code == 422
    assert client.patch(url, json={"cameraId": None}, headers=tok(1)).json()["upload"]["metadata"]["cameraId"] is None
    # pretend a job exists (the real job feature comes later): metadata freezes except notes
    with org.maker() as db:
        db.execute(text("ALTER TABLE jobs DISABLE TRIGGER ALL"))
        db.execute(text("""INSERT INTO analysis_configurations (organization_id, project_id, upload_id, version_no, model_name, tracker,
                              confidence_threshold, iou_threshold, classes)
                           SELECT organization_id, project_id, id, 1, 'm', 'bytetrack', 0.3, 0.5, '["car"]' FROM uploads"""))
        db.execute(text("""INSERT INTO jobs (organization_id, project_id, upload_id, configuration_id, metadata_snapshot)
                           SELECT organization_id, project_id, upload_id, id, '{}' FROM analysis_configurations"""))
        db.execute(text("ALTER TABLE jobs ENABLE TRIGGER ALL"))
        db.commit()
    locked = client.patch(url, json={"cameraId": "CAM-3"}, headers=tok(1))
    assert locked.status_code == 409 and locked.json()["error"]["code"] == "metadata_locked"
    assert client.patch(url, json={"notes": "still ok"}, headers=tok(1)).status_code == 200
    d = client.delete(url, headers=tok(1))
    assert d.status_code == 409 and d.json()["error"]["code"] == "upload_in_use"


def test_remove_deletes_files_and_hides_the_video(client, ctx, store, avi_bytes):
    org, pid = ctx
    u = up(client, pid, avi_bytes).json()["upload"]
    assert client.delete(f"/api/projects/{pid}/uploads/{u['id']}", headers=tok(3)).status_code == 204
    assert files_under(store) == []
    assert client.get(f"/api/projects/{pid}/uploads/{u['id']}", headers=tok(1)).status_code == 404
    assert client.get(f"/api/projects/{pid}/uploads", headers=tok(1)).json()["total"] == 0
    assert client.delete(f"/api/projects/{pid}/uploads/{u['id']}", headers=tok(1)).status_code == 404
    assert scalar(org.maker, "select count(*) from audit_events where action = 'upload_deleted'") == 1


def test_unavailable_storage_is_a_503_not_a_500(client, ctx, store, avi_bytes, monkeypatch, tmp_path):
    org, pid = ctx
    blocker = tmp_path / "blocker"
    blocker.write_text("a file where the folder should be")
    monkeypatch.setattr("app.routers.project_uploads.storage", LocalStorage(blocker))
    r = up(client, pid, avi_bytes)
    assert r.status_code == 503 and r.json()["error"]["code"] == "storage_unavailable"
    assert scalar(org.maker, "select count(*) from uploads where status = 'ready'") == 0


def test_requires_sign_in_and_membership(client, ctx):
    org, pid = ctx
    assert client.get(f"/api/projects/{pid}/uploads").status_code == 401
    assert client.get(f"/api/projects/{pid}/uploads", headers=tok(77)).status_code == 403
