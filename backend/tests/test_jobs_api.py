"""F28-F36: jobs, worker, engine end to end on a real (synthetic) video. Real PostgreSQL, real files, real worker code.
Only the neural network is replaced: a "blob detector" finds the white squares in the picture, so the counts are knowable."""
import threading
import time
from concurrent.futures import ThreadPoolExecutor

import cv2
import numpy as np
import pytest
from sqlalchemy import text
from test_org_api import Org, scalar, tok

from app.engine.tracker import Detected
from app.repositories import job_repository as jobs
from app.storage import LocalStorage
from app.worker.service import Worker

pytestmark = pytest.mark.usefixtures("confirmed_email")

W, H, N, FPS = 320, 240, 40, 10


def make_video(path):
    w = cv2.VideoWriter(str(path), cv2.VideoWriter_fourcc(*"MJPG"), FPS, (W, H))
    for s in range(N):
        img = np.zeros((H, W, 3), np.uint8)
        a = 10 + 5 * s                       # car A drives DOWN the picture (x=100)
        img[a:a + 30, 100:130] = 255
        b = 200 - 5 * s                      # car B drives UP the picture (x=220)
        img[b:b + 30, 220:250] = 255
        w.write(img)
    w.release()
    return path.read_bytes()


class BlobDetector:
    """Stands in for the neural network: every white square is a 'car'."""
    model_file_name, model_sha256, actual_device = "blob.pt", "0" * 64, "cpu"

    def __init__(self, delay=0.0):
        self.delay = delay

    def detect(self, images):
        time.sleep(self.delay)
        out = []
        for im in images:
            gray = cv2.cvtColor(im, cv2.COLOR_BGR2GRAY)
            cs, _ = cv2.findContours((gray > 200).astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            out.append([Detected((x, y, x + w, y + h), "car", 0.9) for x, y, w, h in (cv2.boundingRect(c) for c in cs) if w * h > 100])
        return out


@pytest.fixture(scope="module")
def avi(tmp_path_factory):
    return make_video(tmp_path_factory.mktemp("jobvid") / "v.avi")


@pytest.fixture()
def store(tmp_path, monkeypatch):
    (tmp_path / "data").mkdir()
    s = LocalStorage(tmp_path / "data")
    for mod in ("project_uploads", "jobs"):
        monkeypatch.setattr(f"app.routers.{mod}.storage", s)
    return s


@pytest.fixture()
def ctx(client, verifier, auth_db, store, avi):
    org = Org(client, auth_db)
    org.add(3, "researcher")
    pid = client.post("/api/projects", json={"name": "Ring Road"}, headers=tok(1)).json()["project"]["id"]
    r = client.post(f"/api/projects/{pid}/uploads", files={"file": ("v.avi", avi, "video/x-msvideo")}, headers=tok(1))
    assert r.status_code == 201, r.text
    uid = r.json()["upload"]["id"]
    base = f"/api/projects/{pid}/uploads/{uid}"
    line = {"start": {"x": 0.1, "y": 0.5}, "end": {"x": 0.9, "y": 0.5}, "direction": "forward"}   # arrow points right: down-the-picture = forward
    c = client.put(base + "/configuration", json={"lines": [line], "tracker": "bytetrack"}, headers=tok(1))
    assert c.status_code == 201, c.text
    return org, pid, uid, base


def worker(auth_db, store, detector=None, **kw):
    return Worker(auth_db, store, detector_factory=lambda c: detector or BlobDetector(), heartbeat_seconds=0.1, **kw)


def queue(client, base, who=1, key=None):
    h = dict(tok(who))
    if key:
        h["Idempotency-Key"] = key
    return client.post(base + "/jobs", headers=h)


def test_job_runs_end_to_end_and_counts_the_forward_car_only(client, ctx, auth_db, store):
    org, pid, uid, base = ctx
    r = queue(client, base)
    assert r.status_code == 201, r.text
    job = r.json()["job"]
    assert job["status"] == "queued" and job["queuePosition"] == 1 and job["attempt"] == 1
    assert worker(auth_db, store).process_one() is True
    j = client.get(f"/api/jobs/{job['id']}", headers=tok(3)).json()["job"]
    assert j["status"] == "completed" and j["progressPercent"] == 100 and j["framesDone"] == N and j["framesTotal"] == N
    res = client.get(f"/api/jobs/{job['id']}/results", headers=tok(3)).json()
    assert res["method"] == "line_crossing" and res["isEstimate"] is True
    assert res["vehiclesCounted"] == 1 and res["totalsByClass"] == {"car": 1}          # B went the other way and is not counted
    assert [b["direction"] for b in res["buckets"]] == ["forward"] and sum(b["count"] for b in res["buckets"]) == res["vehiclesCounted"]
    assert res["provenance"]["model"] and res["provenance"]["modelSha256"] == "0" * 64
    ev = client.get(f"/api/jobs/{job['id']}/events", headers=tok(1)).json()["items"]
    assert [e["code"] for e in ev] == ["claimed", "completed"]
    assert [a["outcome"] for a in client.get(f"/api/jobs/{job['id']}/attempts", headers=tok(1)).json()["items"]] == ["completed"]
    vid = client.get(f"/api/jobs/{job['id']}/annotated-video", headers=tok(3))
    assert vid.status_code == 200 and len(vid.content) > 1000
    assert len(client.get("/api/jobs?status=completed", headers=tok(1)).json()["items"]) == 1


def test_annotated_video_is_a_real_readable_video(client, ctx, auth_db, store, tmp_path):
    org, pid, uid, base = ctx
    jid = queue(client, base).json()["job"]["id"]
    worker(auth_db, store).process_one()
    p = tmp_path / "out.mp4"
    p.write_bytes(client.get(f"/api/jobs/{jid}/annotated-video", headers=tok(1)).content)
    cap = cv2.VideoCapture(str(p))
    ok, frame = cap.read()
    assert ok and frame.shape[:2] == (H, W)
    n = 1
    while cap.read()[0]:
        n += 1
    assert abs(n - N) <= 2


def test_same_idempotency_key_gives_one_job_even_when_sent_at_once(client, ctx):
    org, pid, uid, base = ctx
    with ThreadPoolExecutor(4) as ex:
        res = list(ex.map(lambda _: queue(client, base, key="queue-key-0001"), range(4)))
    assert {r.status_code for r in res} <= {200, 201, 409}
    assert scalar(org.maker, "select count(*) from jobs") == 1
    again = queue(client, base, key="queue-key-0001")
    assert again.status_code == 200 and again.json()["replayed"] is True
    assert queue(client, base, key="bad key").status_code == 422


def test_other_organisation_cannot_see_cancel_or_download(client, ctx, auth_db, store):
    org, pid, uid, base = ctx
    jid = queue(client, base).json()["job"]["id"]
    worker(auth_db, store).process_one()
    Org(client, org.maker, owner=9, name="Other")
    for method, path in (("get", f"/api/jobs/{jid}"), ("get", f"/api/jobs/{jid}/results"), ("get", f"/api/jobs/{jid}/annotated-video"),
                         ("get", f"/api/jobs/{jid}/events"), ("post", f"/api/jobs/{jid}/cancel"), ("post", f"/api/jobs/{jid}/retry"),
                         ("post", f"/api/jobs/{jid}/rerun")):
        assert getattr(client, method)(path, headers=tok(9)).status_code == 404, path
    assert client.get("/api/jobs", headers=tok(9)).json()["total"] == 0
    assert queue(client, base, who=9).status_code == 404


def test_cancel_queued_job_is_immediate_and_nothing_runs(client, ctx, auth_db, store):
    org, pid, uid, base = ctx
    jid = queue(client, base).json()["job"]["id"]
    c = client.post(f"/api/jobs/{jid}/cancel", headers=tok(3))
    assert c.status_code == 200 and c.json()["job"]["status"] == "cancelled"
    assert worker(auth_db, store).process_one() is False
    assert client.post(f"/api/jobs/{jid}/cancel", headers=tok(1)).status_code == 409
    assert client.get(f"/api/jobs/{jid}/results", headers=tok(1)).status_code == 404


def test_cancel_running_job_stops_it_and_leaves_no_result_or_file(client, ctx, auth_db, store):
    org, pid, uid, base = ctx
    jid = queue(client, base).json()["job"]["id"]
    w = worker(auth_db, store, BlobDetector(delay=0.15))
    t = threading.Thread(target=w.process_one)
    t.start()
    for _ in range(100):
        if client.get(f"/api/jobs/{jid}", headers=tok(1)).json()["job"]["status"] == "running":
            break
        time.sleep(0.05)
    c = client.post(f"/api/jobs/{jid}/cancel", headers=tok(1))
    assert c.status_code == 200 and c.json()["job"]["cancelRequested"] is True
    assert client.post(f"/api/jobs/{jid}/cancel", headers=tok(1)).status_code == 200      # double click is harmless
    t.join(30)
    j = client.get(f"/api/jobs/{jid}", headers=tok(1)).json()["job"]
    assert j["status"] == "cancelled"
    assert scalar(org.maker, "select count(*) from job_results") == 0 and scalar(org.maker, "select count(*) from job_artifacts") == 0
    assert [f for f in (store.root / "outputs").rglob("*") if f.is_file()] == []
    assert scalar(org.maker, "select count(*) from audit_events where action = 'job_cancel_requested'") == 1


def test_two_workers_claim_a_job_exactly_once(client, ctx, auth_db, store):
    org, pid, uid, base = ctx
    queue(client, base)
    with ThreadPoolExecutor(2) as ex:
        got = list(ex.map(lambda i: worker(auth_db, store).process_one(), range(2)))
    assert sorted(got) == [False, True]
    assert scalar(org.maker, "select count(*) from job_attempts") == 1


def test_missing_source_file_fails_the_job_with_a_plain_message(client, ctx, auth_db, store):
    org, pid, uid, base = ctx
    jid = queue(client, base).json()["job"]["id"]
    key = scalar(org.maker, "select storage_key from uploads")
    store.delete("sources", key)
    worker(auth_db, store).process_one()
    j = client.get(f"/api/jobs/{jid}", headers=tok(1)).json()["job"]
    assert j["status"] == "failed" and j["error"]["code"] == "source_missing" and j["retryable"] is False and j["error"]["diagnosticId"]
    assert client.post(f"/api/jobs/{jid}/retry", headers=tok(1)).status_code == 409
    assert queue(client, base).status_code == 410                                       # creating a new job is refused too


def test_failure_then_retry_is_a_new_attempt_of_the_same_job(client, ctx, auth_db, store):
    org, pid, uid, base = ctx
    jid = queue(client, base).json()["job"]["id"]

    def broken(_ctx):
        raise RuntimeError("model file not found: C:\\secret\\path.pt")

    Worker(auth_db, store, detector_factory=broken, heartbeat_seconds=0.1).process_one()
    j = client.get(f"/api/jobs/{jid}", headers=tok(1)).json()["job"]
    assert j["status"] == "failed" and j["error"]["code"] == "detector_unavailable" and j["retryable"] is True
    assert "secret" not in str(j) and "C:" not in str(j)                                # no path or raw error reaches the client
    r = client.post(f"/api/jobs/{jid}/retry", headers=tok(3))
    assert r.status_code == 200 and r.json()["job"]["status"] == "queued" and r.json()["job"]["attempt"] == 2
    worker(auth_db, store).process_one()
    j2 = client.get(f"/api/jobs/{jid}", headers=tok(1)).json()["job"]
    assert j2["status"] == "completed" and j2["error"] is None
    assert [a["outcome"] for a in client.get(f"/api/jobs/{jid}/attempts", headers=tok(1)).json()["items"]] == ["failed", "completed"]


def test_stale_worker_is_recovered_and_cannot_write_afterwards(client, ctx, auth_db, store):
    org, pid, uid, base = ctx
    jid = queue(client, base).json()["job"]["id"]
    with auth_db() as db:
        job = jobs.claim_next(db, "dead-worker")
    with auth_db() as db:
        db.execute(text("update jobs set last_heartbeat_at = now() - interval '1 hour'"))
        db.commit()
    assert Worker(auth_db, store).recover() == [jid]
    j = client.get(f"/api/jobs/{jid}", headers=tok(1)).json()["job"]
    assert j["status"] == "failed" and j["error"]["code"] == "worker_lost" and j["retryable"] is True
    with auth_db() as db, pytest.raises(jobs.LostOwnership):
        jobs.progress(db, job["id"], "dead-worker", 1, frames_done=5, frames_total=40, percent=12, fps=1.0)
    client.post(f"/api/jobs/{jid}/retry", headers=tok(1))
    with auth_db() as db, pytest.raises(jobs.LostOwnership):                            # old worker, new attempt: still refused
        jobs.progress(db, job["id"], "dead-worker", 1, frames_done=5, frames_total=40, percent=12, fps=1.0)
    assert scalar(org.maker, "select progress_percent from jobs") == 0


def test_rerun_makes_a_new_job_and_only_after_the_first_finished(client, ctx, auth_db, store):
    org, pid, uid, base = ctx
    jid = queue(client, base).json()["job"]["id"]
    assert client.post(f"/api/jobs/{jid}/rerun", headers=tok(1)).status_code == 409
    worker(auth_db, store).process_one()
    r = client.post(f"/api/jobs/{jid}/rerun", headers=tok(1))
    assert r.status_code == 201 and r.json()["job"]["rerunOfJobId"] == jid and r.json()["job"]["id"] != jid
    assert scalar(org.maker, "select count(*) from jobs") == 2


def test_queue_position_follows_creation_order(client, ctx):
    org, pid, uid, base = ctx
    a = queue(client, base).json()["job"]
    b = queue(client, base).json()["job"]
    assert (a["queuePosition"], client.get(f"/api/jobs/{b['id']}", headers=tok(1)).json()["job"]["queuePosition"]) == (1, 2)


def test_job_needs_ready_video_and_saved_settings(client, ctx, auth_db, store, avi):
    org, pid, uid, base = ctx
    other = client.post(f"/api/projects/{pid}/uploads", files={"file": ("v2.avi", avi, "video/x-msvideo")}, headers=tok(1)).json()["upload"]["id"]
    r = queue(client, f"/api/projects/{pid}/uploads/{other}")
    assert r.status_code == 409 and r.json()["error"]["code"] == "configuration_missing"
    client.delete(f"/api/projects/{pid}/uploads/{other}", headers=tok(1))
    assert queue(client, f"/api/projects/{pid}/uploads/{other}").status_code == 410     # removed video: gone, not "never existed"
    client.post(f"/api/projects/{pid}/archive", headers=tok(1))
    assert queue(client, base).json()["error"]["code"] == "project_archived"


def test_storage_down_is_503_and_a_database_move_to_completed_without_result_is_refused(client, ctx, auth_db, store, monkeypatch, tmp_path):
    org, pid, uid, base = ctx
    blocker = tmp_path / "blocker"
    blocker.write_text("x")
    monkeypatch.setattr("app.routers.jobs.storage", LocalStorage(blocker))
    r = queue(client, base)
    assert r.status_code in (410, 503)                                                  # unusable storage never queues a job
    monkeypatch.setattr("app.routers.jobs.storage", store)
    jid = queue(client, base).json()["job"]["id"]
    with auth_db() as db:
        jobs.claim_next(db, "w1")
    with auth_db() as db, pytest.raises(Exception):
        db.execute(text("update jobs set status = 'completed', progress_percent = 100 where id = :j"), {"j": jid})
        db.commit()
