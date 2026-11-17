"""F24-F26: analysis settings, counting lines, zones. Real PostgreSQL."""
import pytest
from sqlalchemy import text
from test_org_api import Org, scalar, tok

pytestmark = pytest.mark.usefixtures("confirmed_email")

LINE = {"start": {"x": 0.1, "y": 0.5}, "end": {"x": 0.9, "y": 0.5}}
ZONE = {"points": [{"x": 0.1, "y": 0.1}, {"x": 0.9, "y": 0.1}, {"x": 0.5, "y": 0.9}]}


@pytest.fixture()
def ctx(client, verifier, auth_db):
    org = Org(client, auth_db)
    org.add(3, "researcher")
    pid = client.post("/api/projects", json={"name": "Ring Road"}, headers=tok(1)).json()["project"]["id"]
    with auth_db() as db:   # a ready upload straight in the database (the upload route has its own tests)
        uid = db.execute(text("""INSERT INTO uploads (organization_id, project_id, original_name, storage_key, extension, status, size_bytes,
                                   checksum_sha256, duration_seconds, width_px, height_px, frame_rate, frame_count)
                                 SELECT organization_id, id, 'a.avi', gen_random_uuid()::text || '.avi', 'avi', 'ready', 1, 'x', 3, 64, 48, 10, 30
                                 FROM projects WHERE id = :p RETURNING id"""), {"p": pid}).scalar_one()
        db.commit()
    return org, pid, str(uid), f"/api/projects/{pid}/uploads/{uid}/configuration"


def put(client, url, who=1, **body):
    return client.put(url, json=body, headers=tok(who))


def test_defaults_are_resolved_and_stored_and_options_are_listed(client, ctx):
    org, pid, uid, url = ctx
    o = client.get(url + "/options", headers=tok(1)).json()
    assert o["trackers"] == ["bytetrack", "sort"] and "car" in o["classes"] and o["defaults"]["bucketSeconds"] == 900
    r = put(client, url, lines=[LINE])
    assert r.status_code == 201, r.text
    c = r.json()["configuration"]
    assert c["version"] == 1 and c["classes"] == ["car", "motorcycle", "bus", "truck"] and c["bucketSeconds"] == 900
    assert c["lines"][0]["direction"] == "forward" and c["lines"][0]["start"] == {"x": 0.1, "y": 0.5}
    assert client.get(url, headers=tok(3)).json()["configuration"]["id"] == c["id"]


def test_each_save_is_a_new_version_and_old_ones_are_kept(client, ctx):
    org, pid, uid, url = ctx
    assert put(client, url, lines=[LINE]).json()["configuration"]["version"] == 1
    v2 = put(client, url, 3, zones=[ZONE], tracker="sort", confidenceThreshold=0.4).json()["configuration"]
    assert v2["version"] == 2 and v2["tracker"] == "sort" and v2["zones"][0]["points"][2] == {"x": 0.5, "y": 0.9}
    assert scalar(org.maker, "select count(*) from analysis_configurations") == 2
    assert client.get(url, headers=tok(1)).json()["configuration"]["version"] == 2


def test_validation(client, ctx):
    org, pid, uid, url = ctx
    bad = [
        {},                                                                                   # no line and no zone (O42)
        {"lines": [{"start": {"x": 0.5, "y": 0.5}, "end": {"x": 0.5, "y": 0.5}}]},          # zero length
        {"lines": [{"start": {"x": -0.1, "y": 0.5}, "end": {"x": 0.9, "y": 0.5}}]},         # out of range
        {"lines": [{"start": {"x": 0.1, "y": 1.5}, "end": {"x": 0.9, "y": 0.5}}]},
        {"lines": [{**LINE, "direction": "sideways"}]},
        {"zones": [{"points": [{"x": 0.1, "y": 0.1}, {"x": 0.9, "y": 0.1}]}]},               # too few points
        {"zones": [{"points": [{"x": 0.1, "y": 0.1}, {"x": 0.2, "y": 0.1}, {"x": 0.3, "y": 0.1}]}]},   # no area
        {"lines": [LINE], "tracker": "deepsort"},
        {"lines": [LINE], "tracker": "botsort"},                                              # not implemented by the engine
        {"lines": [LINE], "model": "other.pt"},
        {"lines": [LINE], "classes": ["spaceship"]},
        {"lines": [LINE], "classes": ["car", "car"]},
        {"lines": [LINE], "confidenceThreshold": 0.05},
        {"lines": [LINE], "iouThreshold": 0},
        {"lines": [LINE], "frameSkip": 0},
        {"lines": [LINE], "bucketSeconds": 10},
        {"lines": [LINE], "organizationId": "x"},                                             # unknown field
        {"lines": [LINE] * 21},
    ]
    for body in bad:
        r = put(client, url, **body)
        assert r.status_code == 422, (body, r.status_code)
    assert scalar(org.maker, "select count(*) from analysis_configurations") == 0


def test_empty_class_list_is_resolved_once_not_stored_empty(client, ctx):
    org, pid, uid, url = ctx
    c = put(client, url, lines=[LINE], classes=[]).json()["configuration"]
    assert c["classes"] == ["car", "motorcycle", "bus", "truck"]


def test_line_and_zone_modes_both_work_together(client, ctx):
    org, pid, uid, url = ctx
    c = put(client, url, lines=[LINE, {**LINE, "direction": "both", "name": "B"}], zones=[ZONE, ZONE]).json()["configuration"]
    assert len(c["lines"]) == 2 and len(c["zones"]) == 2 and c["lines"][1]["direction"] == "both"


def test_two_saves_at_once_get_distinct_versions(client, ctx):
    org, pid, uid, url = ctx
    from concurrent.futures import ThreadPoolExecutor
    with ThreadPoolExecutor(4) as ex:
        codes = list(ex.map(lambda _: put(client, url, lines=[LINE]).status_code, range(4)))
    assert codes == [201] * 4
    assert sorted(r[0] for r in org.maker().execute(text("select version_no from analysis_configurations")).all()) == [1, 2, 3, 4]


def test_used_version_is_locked_by_the_database(client, ctx):
    org, pid, uid, url = ctx
    cid = put(client, url, lines=[LINE]).json()["configuration"]["id"]
    with org.maker() as db:
        db.execute(text("UPDATE analysis_configurations SET locked_at = now() WHERE id = :i"), {"i": cid})
        db.commit()
    assert client.get(url, headers=tok(1)).json()["configuration"]["locked"] is True
    with org.maker() as db, pytest.raises(Exception):
        db.execute(text("UPDATE analysis_configurations SET tracker = 'sort' WHERE id = :i"), {"i": cid})
    assert put(client, url, lines=[LINE]).json()["configuration"]["version"] == 2     # a change is a new version


def test_scope_archive_and_auth(client, ctx):
    org, pid, uid, url = ctx
    Org(client, org.maker, owner=9, name="Other")
    assert put(client, url, 9, lines=[LINE]).status_code == 404
    assert client.get(url, headers=tok(9)).status_code == 404
    assert client.get(url + "/options").status_code == 401
    client.post(f"/api/projects/{pid}/archive", headers=tok(1))
    r = put(client, url, lines=[LINE])
    assert r.status_code == 409 and r.json()["error"]["code"] == "project_archived"
