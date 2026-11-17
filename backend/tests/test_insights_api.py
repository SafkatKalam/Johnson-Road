"""F37-F40: analytics, reports and CSV, notifications, activity and audit log. Real PostgreSQL, real worker on a real video."""
import csv
import io

import pytest
from test_jobs_api import avi, ctx, queue, store, worker  # noqa: F401  (fixtures and helpers shared with the jobs tests)
from test_org_api import Org, scalar, tok

pytestmark = pytest.mark.usefixtures("confirmed_email")


@pytest.fixture()
def done(client, ctx, auth_db, store):
    org, pid, uid, base = ctx
    jid = queue(client, base).json()["job"]["id"]
    assert worker(auth_db, store).process_one() is True
    return org, pid, uid, base, jid


# --- F37 ---

def test_analytics_use_the_latest_completed_job_per_video_and_keep_methods_apart(client, done, auth_db, store):
    org, pid, uid, base, jid = done
    s = client.get("/api/analytics/summary", headers=tok(3)).json()
    assert s["isEstimate"] is True and s["videosAnalysed"] == 1
    assert s["lineCrossing"]["total"] == 1 and s["zonePresence"]["total"] == 0 and s["lineCrossing"]["byClass"] == {"car": 1}
    client.post(f"/api/jobs/{jid}/rerun", headers=tok(1))
    worker(auth_db, store).process_one()
    again = client.get("/api/analytics/summary", headers=tok(1)).json()
    assert again["lineCrossing"]["total"] == 1 and again["videosAnalysed"] == 1          # a rerun replaces, never doubles
    assert again["jobsByStatus"] == {"completed": 2}
    assert client.get("/api/analytics/summary?from=2100-01-01T00:00:00Z", headers=tok(1)).json()["videosAnalysed"] == 0
    assert client.get("/api/analytics/summary?from=2030-01-02T00:00:00Z&to=2030-01-01T00:00:00Z", headers=tok(1)).status_code == 422
    Org(client, org.maker, owner=9, name="Other")
    assert client.get("/api/analytics/summary", headers=tok(9)).json()["lineCrossing"]["total"] == 0


# --- F38 ---

def test_report_is_made_once_per_options_and_a_new_version_on_request(client, done):
    org, pid, uid, base, jid = done
    r1 = client.post(f"/api/jobs/{jid}/reports", json={"type": "summary"}, headers=tok(3))
    assert r1.status_code == 201, r1.text
    rep = r1.json()["report"]
    assert rep["version"] == 1 and rep["vehiclesCounted"] == 1 and rep["peak"]["count"] == 1 and rep["totalsByDirection"] == {"forward": 1}
    assert "configuration v1" in rep["analysisVersion"]
    r2 = client.post(f"/api/jobs/{jid}/reports", json={"type": "summary"}, headers=tok(1))
    assert r2.status_code == 200 and r2.json()["existing"] is True and r2.json()["report"]["id"] == rep["id"]
    r3 = client.post(f"/api/jobs/{jid}/reports", json={"type": "summary", "newVersion": True}, headers=tok(1))
    assert r3.status_code == 201 and r3.json()["report"]["version"] == 2
    filtered = client.post(f"/api/jobs/{jid}/reports", json={"type": "summary", "classes": ["bus"]}, headers=tok(1)).json()["report"]
    assert filtered["vehiclesCounted"] == 0 and filtered["id"] != rep["id"]
    assert client.get("/api/reports", headers=tok(1)).json()["total"] == 3
    assert client.post(f"/api/jobs/{jid}/reports", json={"type": "daily"}, headers=tok(1)).status_code == 422
    assert client.post(f"/api/jobs/{jid}/reports", json={"type": "summary", "classes": ["plane"]}, headers=tok(1)).status_code == 422


def test_report_needs_a_completed_job_and_stays_in_its_organisation(client, ctx, done):
    org, pid, uid, base, jid = done
    queued = queue(client, base).json()["job"]["id"]
    assert client.post(f"/api/jobs/{queued}/reports", json={}, headers=tok(1)).json()["error"]["code"] == "job_not_completed"
    rid = client.post(f"/api/jobs/{jid}/reports", json={}, headers=tok(1)).json()["report"]["id"]
    Org(client, org.maker, owner=9, name="Other")
    assert client.get(f"/api/reports/{rid}", headers=tok(9)).status_code == 404
    assert client.get(f"/api/reports/{rid}/export.csv", headers=tok(9)).status_code == 404
    assert client.post(f"/api/jobs/{jid}/reports", json={}, headers=tok(9)).status_code == 404


def test_csv_export_matches_the_report_is_cached_and_safe(client, done, store):
    org, pid, uid, base, jid = done
    with org.maker() as db:   # a hostile line name must not become a spreadsheet formula
        from sqlalchemy import text
        db.execute(text("ALTER TABLE counting_lines DISABLE TRIGGER lines_locked_trg"))
        db.execute(text("UPDATE counting_lines SET name = '=HYPERLINK(\"x\")'"))
        db.execute(text("ALTER TABLE counting_lines ENABLE TRIGGER lines_locked_trg"))
        db.commit()
    rid = client.post(f"/api/jobs/{jid}/reports", json={}, headers=tok(1)).json()["report"]["id"]
    r = client.get(f"/api/reports/{rid}/export.csv", headers=tok(3))
    assert r.status_code == 200 and r.headers["content-type"].startswith("text/csv") and "attachment" in r.headers["content-disposition"]
    rows = list(csv.reader(io.StringIO(r.content.decode("utf-8-sig"))))
    header = rows.index(["bucket_index", "bucket_start_seconds", "vehicle_class", "direction", "line", "zone", "count"])
    data = rows[header + 1:]
    assert sum(int(x[6]) for x in data) == 1 and data[0][4].startswith("'=")
    assert ["Counts are estimates", "yes"] in rows
    again = client.get(f"/api/reports/{rid}/export.csv", headers=tok(1))
    assert again.content == r.content and scalar(org.maker, "select count(*) from report_files") == 1
    assert client.get(f"/api/reports/{rid}/export.pdf", headers=tok(1)).status_code == 501


# --- F39 ---

def test_notifications_follow_upload_job_and_report_and_only_reach_their_owner(client, done, auth_db, store):
    org, pid, uid, base, jid = done
    n = client.get("/api/notifications", headers=tok(1)).json()
    kinds = [i["kind"] for i in n["items"]]
    assert "upload_ready" in kinds and "job_completed" in kinds and n["unreadCount"] == len(kinds)
    assert all(i["link"].startswith("/") for i in n["items"])
    assert client.get("/api/notifications", headers=tok(3)).json()["total"] == 0          # another member is not told about my job
    one = n["items"][0]["id"]
    assert client.post(f"/api/notifications/{one}/read", headers=tok(3)).status_code == 404   # not theirs
    assert client.post(f"/api/notifications/{one}/read", headers=tok(1)).json()["changed"] == 1
    assert client.post("/api/notifications/read-all", headers=tok(1)).json()["changed"] == len(kinds) - 1
    assert client.get("/api/notifications?unread=true", headers=tok(1)).json()["total"] == 0


def test_failed_job_tells_its_owner(client, ctx, auth_db, store):
    org, pid, uid, base = ctx
    queue(client, base, who=3)
    from app.worker.service import Worker

    def broken(_c):
        raise RuntimeError("x")

    Worker(auth_db, store, detector_factory=broken).process_one()
    kinds = [i["kind"] for i in client.get("/api/notifications", headers=tok(3)).json()["items"]]
    assert kinds == ["job_failed"]


# --- F40 ---

def test_project_activity_shows_project_video_job_and_report_events(client, done):
    org, pid, uid, base, jid = done
    client.post(f"/api/jobs/{jid}/reports", json={}, headers=tok(1))
    acts = [a["action"] for a in client.get(f"/api/projects/{pid}/activity", headers=tok(3)).json()["items"]]
    for a in ("project_created", "upload_created", "analysis_configuration_saved", "job_created", "job_completed", "report_created"):
        assert a in acts, a
    Org(client, org.maker, owner=9, name="Other")
    assert client.get(f"/api/projects/{pid}/activity", headers=tok(9)).status_code == 404


def test_audit_log_is_for_owner_and_admin_only(client, done):
    org, pid, uid, base, jid = done
    assert client.get("/api/organization/audit", headers=tok(3)).status_code == 403
    log = client.get("/api/organization/audit?limit=2", headers=tok(1)).json()
    assert len(log["items"]) == 2 and log["nextBefore"] is not None
    older = client.get(f"/api/organization/audit?before={log['nextBefore']}", headers=tok(1)).json()["items"]
    assert all(x["id"] < log["nextBefore"] for x in older)
    assert any(x["action"] == "audit_read_refused" for x in client.get("/api/organization/audit?limit=200", headers=tok(1)).json()["items"])
