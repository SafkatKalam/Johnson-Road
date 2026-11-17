"""F20: projects. Real PostgreSQL, real routes."""
import uuid

import pytest
from sqlalchemy import text
from test_org_api import Org, q, scalar, tok

pytestmark = pytest.mark.usefixtures("confirmed_email")


@pytest.fixture()
def org(client, verifier, auth_db):
    o = Org(client, auth_db)
    o.add(2, "admin")
    o.add(3, "researcher")
    return o


def make(client, who, name="M5 Junction 14", **extra):
    return client.post("/api/projects", json={"name": name, **extra}, headers=tok(who))


def test_member_creates_and_reads_a_project_with_real_counts(client, org):
    r = make(client, 3, location="Bristol", description="North side")
    assert r.status_code == 201, r.text
    p = r.json()["project"]
    assert p["name"] == "M5 Junction 14" and p["location"] == "Bristol" and p["archived"] is False
    assert (p["uploadCount"], p["jobCount"], p["reportCount"]) == (0, 0, 0)
    got = client.get(f"/api/projects/{p['id']}", headers=tok(1))
    assert got.status_code == 200 and got.json()["project"]["id"] == p["id"]


def test_input_is_validated(client, org):
    assert make(client, 1, name="   ").status_code == 422
    assert make(client, 1, name="x" * 121).status_code == 422
    assert make(client, 1, name="bad\x00name").status_code == 422
    assert client.post("/api/projects", json={"name": "ok", "organizationId": str(uuid.uuid4())}, headers=tok(1)).status_code == 422


def test_duplicate_name_in_same_organisation_is_refused_case_insensitively(client, org):
    assert make(client, 1, name="Ring Road").status_code == 201
    r = make(client, 2, name="ring road")
    assert r.status_code == 409 and r.json()["error"]["code"] == "project_name_taken"


def test_same_name_in_another_organisation_is_fine(client, org):
    assert make(client, 1, name="Ring Road").status_code == 201
    other = Org(client, org.maker, owner=9, name="Other Org")
    assert make(client, 9, name="Ring Road").status_code == 201
    assert other.id != org.id


def test_another_organisation_cannot_see_or_change_a_project(client, org):
    pid = make(client, 1).json()["project"]["id"]
    Org(client, org.maker, owner=9, name="Other Org")
    assert client.get(f"/api/projects/{pid}", headers=tok(9)).status_code == 404
    assert client.patch(f"/api/projects/{pid}", json={"name": "x"}, headers=tok(9)).status_code == 404
    assert client.post(f"/api/projects/{pid}/archive", headers=tok(9)).status_code == 404
    assert client.get("/api/projects", headers=tok(9)).json()["total"] == 0


def test_bad_and_unknown_ids(client, org):
    assert client.get("/api/projects/not-a-uuid", headers=tok(1)).status_code == 422
    r = client.get(f"/api/projects/{uuid.uuid4()}", headers=tok(1))
    assert r.status_code == 404 and r.json()["error"]["code"] == "project_not_found"


def test_search_pagination_and_wildcards_are_literal(client, org):
    for n in ("Alpha 50%", "Alpha 500", "Beta_1", "BetaX1"):
        assert make(client, 1, name=n, location="Leeds" if n.startswith("Alpha") else "York").status_code == 201
    body = client.get("/api/projects?q=50%25", headers=tok(1)).json()
    assert [i["name"] for i in body["items"]] == ["Alpha 50%"] and body["total"] == 1     # % is not a wildcard
    assert client.get("/api/projects?q=beta_1", headers=tok(1)).json()["total"] == 1      # _ is not a wildcard
    assert client.get("/api/projects?q=york", headers=tok(1)).json()["total"] == 2          # location search, any case
    page = client.get("/api/projects?limit=3&offset=3", headers=tok(1)).json()
    assert page["total"] == 4 and len(page["items"]) == 1
    assert client.get("/api/projects?limit=0", headers=tok(1)).status_code == 422
    assert client.get("/api/projects?limit=101", headers=tok(1)).status_code == 422
    assert client.get("/api/projects?state=bogus", headers=tok(1)).status_code == 422


def test_edit_changes_only_what_was_sent_and_is_audited(client, org):
    pid = make(client, 1, location="Bristol").json()["project"]["id"]
    r = client.patch(f"/api/projects/{pid}", json={"name": "Renamed"}, headers=tok(3))
    assert r.status_code == 200 and r.json()["project"]["name"] == "Renamed" and r.json()["project"]["location"] == "Bristol"
    assert client.patch(f"/api/projects/{pid}", json={}, headers=tok(1)).status_code == 422
    assert client.patch(f"/api/projects/{pid}", json={"archived": True}, headers=tok(1)).status_code == 422
    n = scalar(org.maker, "select count(*) from audit_events where action='project_updated' and entity_id=:i", i=pid)
    assert n == 1


def test_researcher_cannot_archive_admin_can_and_archived_is_read_only(client, org):
    pid = make(client, 3).json()["project"]["id"]
    r = client.post(f"/api/projects/{pid}/archive", headers=tok(3))
    assert r.status_code == 403
    assert scalar(org.maker, "select count(*) from audit_events where action='project_archive_refused'") == 1
    assert client.post(f"/api/projects/{pid}/archive", headers=tok(2)).json()["project"]["archived"] is True
    assert client.post(f"/api/projects/{pid}/archive", headers=tok(2)).status_code == 200   # repeat: no error, no second audit row
    assert scalar(org.maker, "select count(*) from audit_events where action='project_archived'") == 1
    e = client.patch(f"/api/projects/{pid}", json={"name": "x"}, headers=tok(1))
    assert e.status_code == 409 and e.json()["error"]["code"] == "project_archived"
    assert client.get("/api/projects", headers=tok(1)).json()["total"] == 0
    assert client.get("/api/projects?state=archived", headers=tok(1)).json()["total"] == 1
    assert client.post(f"/api/projects/{pid}/restore", headers=tok(1)).json()["project"]["archived"] is False


def test_archived_name_can_be_reused_but_restore_then_conflicts(client, org):
    old = make(client, 1, name="Ring Road").json()["project"]["id"]
    client.post(f"/api/projects/{old}/archive", headers=tok(1))
    assert make(client, 1, name="Ring Road").status_code == 201
    r = client.post(f"/api/projects/{old}/restore", headers=tok(1))
    assert r.status_code == 409 and r.json()["error"]["code"] == "project_name_taken"


def test_location_suggestions_come_from_real_projects(client, org):
    make(client, 1, name="a", location="Bristol")
    make(client, 1, name="b", location="Bristol")
    make(client, 1, name="c", location="Bath")
    assert client.get("/api/projects/location-suggestions", headers=tok(1)).json()["suggestions"] == ["Bristol", "Bath"]
    assert client.get("/api/projects/location-suggestions?prefix=ba", headers=tok(1)).json()["suggestions"] == ["Bath"]


def test_sign_in_and_membership_are_required(client, org):
    assert client.get("/api/projects").status_code == 401
    assert client.get("/api/projects", headers=tok(77)).status_code == 403   # signed in, no organisation
