"""F07: /api/me and route protection against a real database."""
from concurrent.futures import ThreadPoolExecutor

import pytest
from auth_support import bearer, token
from sqlalchemy import text

from app.main import app

SUB = "11111111-1111-1111-1111-111111111111"


def rows(maker, sql, **params):
    with maker() as db:
        return db.execute(text(sql), params).mappings().all()


def join_org(maker, subject=SUB, role="owner", member_status="active"):
    with maker() as db:
        uid = db.execute(text("select id from users where auth_subject=:s"), {"s": subject}).scalar_one()
        org = db.execute(text("insert into organizations (name, slug) values ('Acme','acme') returning id")).scalar_one()
        db.execute(text("insert into organization_members (organization_id, user_id, role, status) values (:o,:u,:r,:s)"),
                   {"o": org, "u": uid, "r": role, "s": member_status})
        db.commit()
    return org


# --- /api/me ---------------------------------------------------------------------

def test_me_without_a_token_is_401_in_the_standard_shape(client, verifier, auth_db):
    r = client.get("/api/me")
    assert r.status_code == 401
    assert r.json()["error"]["code"] == "invalid_token" and r.json()["error"]["diagnosticId"] is None
    assert r.headers["www-authenticate"] == "Bearer" and "x-request-id" in r.headers


@pytest.mark.parametrize("header", ["Basic dXNlcjpwYXNz", "Bearer", "bearer ", "Token abc", "Bearer a.b.c"])
def test_me_with_a_wrong_authorization_header_is_401(client, verifier, auth_db, header):
    assert client.get("/api/me", headers={"Authorization": header}).status_code == 401


def test_first_call_creates_the_backend_user_and_needs_onboarding(client, verifier, auth_db):
    r = client.get("/api/me", headers=bearer(token()))
    assert r.status_code == 200
    body = r.json()
    assert body["user"]["email"] == "person@example.com"
    assert "emailVerified" not in body["user"]  # the token cannot prove it, so the API does not claim it
    assert body["organization"] is None and body["role"] is None and body["needsOnboarding"] is True
    assert len(rows(auth_db, "select id from users")) == 1


def test_second_call_returns_the_same_user_without_a_second_row(client, verifier, auth_db):
    first = client.get("/api/me", headers=bearer(token())).json()["user"]["id"]
    second = client.get("/api/me", headers=bearer(token())).json()["user"]["id"]
    assert first == second and len(rows(auth_db, "select id from users")) == 1


def test_many_simultaneous_first_calls_create_exactly_one_user(client, verifier, auth_db):
    tok = token()
    with ThreadPoolExecutor(max_workers=8) as pool:
        results = list(pool.map(lambda _: client.get("/api/me", headers=bearer(tok)), range(16)))
    assert {r.status_code for r in results} == {200}
    assert len({r.json()["user"]["id"] for r in results}) == 1
    assert len(rows(auth_db, "select id from users")) == 1


def test_changed_email_in_the_token_updates_our_copy(client, verifier, auth_db):
    client.get("/api/me", headers=bearer(token()))
    r = client.get("/api/me", headers=bearer(token(email="new@example.com")))
    assert r.json()["user"]["email"] == "new@example.com"
    assert rows(auth_db, "select email from users")[0]["email"] == "new@example.com"


def test_email_already_used_by_another_account_is_409(client, verifier, auth_db):
    client.get("/api/me", headers=bearer(token()))
    other = token(sub="22222222-2222-2222-2222-222222222222", email="PERSON@example.com")
    r = client.get("/api/me", headers=bearer(other))
    assert r.status_code == 409 and r.json()["error"]["code"] == "email_in_use"
    assert len(rows(auth_db, "select id from users")) == 1  # nothing half-created


def test_caller_cannot_name_their_own_role_or_organisation(client, verifier, auth_db):
    tok = token(role="service_role", user_metadata={"role": "owner", "organization_id": "x", "email_verified": True})
    r = client.get("/api/me", headers={**bearer(tok), "X-Role": "owner", "X-Org-Id": "anything", "X-User-Id": "1"})
    assert r.status_code == 200 and r.json()["role"] is None and r.json()["organization"] is None


def test_member_sees_their_organisation_and_role(client, verifier, auth_db):
    client.get("/api/me", headers=bearer(token()))
    org = join_org(auth_db, role="admin")
    body = client.get("/api/me", headers=bearer(token())).json()
    assert body["needsOnboarding"] is False and body["role"] == "admin"
    assert body["organization"] == {"id": str(org), "name": "Acme", "slug": "acme", "plan": "starter"}


def test_suspended_account_is_403(client, verifier, auth_db):
    client.get("/api/me", headers=bearer(token()))
    with auth_db() as db:
        db.execute(text("update users set status='suspended'"))
        db.commit()
    r = client.get("/api/me", headers=bearer(token()))
    assert r.status_code == 403 and r.json()["error"]["code"] == "account_suspended"


def test_expired_token_is_refused_on_the_real_route(client, verifier, auth_db):
    import time

    assert client.get("/api/me", headers=bearer(token(exp=int(time.time()) - 600))).status_code == 401


def test_signing_key_outage_is_503_on_the_real_route(client, verifier, auth_db):
    verifier.fail = "Fail to fetch data from the url, err: connection refused"
    r = client.get("/api/me", headers=bearer(token()))
    assert r.status_code == 503 and r.json()["error"]["code"] == "auth_unavailable"


# --- PATCH /api/me (F14) ------------------------------------------------------------

def patch(client, body, tok=None):
    return client.patch("/api/me", json=body, headers=bearer(tok or token()))


def test_patch_me_needs_a_token(client, verifier, auth_db):
    assert client.patch("/api/me", json={"fullName": "X"}).status_code == 401


def test_patch_changes_the_name_trims_it_and_keeps_it(client, verifier, auth_db):
    r = patch(client, {"fullName": "  Ada Lovelace  "})
    assert r.status_code == 200 and r.json()["user"]["fullName"] == "Ada Lovelace"
    assert client.get("/api/me", headers=bearer(token())).json()["user"]["fullName"] == "Ada Lovelace"
    assert rows(auth_db, "select full_name from users")[0]["full_name"] == "Ada Lovelace"


@pytest.mark.parametrize("name", ["", "   ", "x" * 121, "bad\x00name", "line\nbreak"])
def test_patch_refuses_bad_names(client, verifier, auth_db, name):
    r = patch(client, {"fullName": name})
    assert r.status_code == 422 and r.json()["error"]["code"] == "invalid_input"
    assert name.strip() not in r.text or name.strip() == ""  # the bad value is never echoed back


def test_patch_accepts_the_longest_name(client, verifier, auth_db):
    assert patch(client, {"fullName": "x" * 120}).status_code == 200


@pytest.mark.parametrize("url", ["http://example.com/a.png", "javascript:alert(1)", "data:image/png;base64,AAAA",
                                 "https://", "ftp://example.com/a.png", "https://exa mple.com/a.png",
                                 "https://example.com/" + "a" * 500])
def test_patch_refuses_unsafe_avatar_addresses(client, verifier, auth_db, url):
    assert patch(client, {"avatarUrl": url}).status_code == 422


def test_patch_sets_and_removes_the_avatar(client, verifier, auth_db):
    r = patch(client, {"avatarUrl": "https://example.com/me.png"})
    assert r.json()["user"]["avatarUrl"] == "https://example.com/me.png"
    assert patch(client, {"avatarUrl": ""}).json()["user"]["avatarUrl"] is None
    patch(client, {"avatarUrl": "https://example.com/me.png"})
    assert patch(client, {"avatarUrl": None}).json()["user"]["avatarUrl"] is None


@pytest.mark.parametrize("field", ["role", "organizationId", "organization_id", "email", "status", "id", "authSubject",
                                   "plan", "isAdmin"])
def test_patch_cannot_name_protected_fields(client, verifier, auth_db, field):
    client.get("/api/me", headers=bearer(token()))
    before = rows(auth_db, "select email, status, auth_subject from users")[0]
    r = patch(client, {"fullName": "Mallory", field: "owner" if field == "role" else "x"})
    assert r.status_code == 422
    assert rows(auth_db, "select email, status, auth_subject, full_name from users")[0]["full_name"] == ""  # nothing applied
    after = rows(auth_db, "select email, status, auth_subject from users")[0]
    assert after == before


def test_patch_with_no_fields_changes_nothing(client, verifier, auth_db):
    r = patch(client, {})
    assert r.status_code == 200 and r.json()["user"]["fullName"] == ""


def test_patch_only_touches_the_callers_own_row(client, verifier, auth_db):
    other = token(sub="22222222-2222-2222-2222-222222222222", email="other@example.com")
    client.get("/api/me", headers=bearer(other))
    patch(client, {"fullName": "Mine"})
    names = {r["email"]: r["full_name"] for r in rows(auth_db, "select email, full_name from users")}
    assert names == {"person@example.com": "Mine", "other@example.com": ""}


def test_patch_keeps_role_and_organisation(client, verifier, auth_db):
    client.get("/api/me", headers=bearer(token()))
    org = join_org(auth_db, role="admin")
    body = patch(client, {"fullName": "Admin Person"}).json()
    assert body["role"] == "admin" and body["organization"]["id"] == str(org) and body["needsOnboarding"] is False


def test_patch_by_a_suspended_account_is_refused(client, verifier, auth_db):
    client.get("/api/me", headers=bearer(token()))
    with auth_db() as db:
        db.execute(text("update users set status='suspended'"))
        db.commit()
    assert patch(client, {"fullName": "Still me"}).status_code == 403


# --- route protection -------------------------------------------------------------

def _protected_routes():
    """Every (method, path) under /api except /api/me, whatever the method."""
    import re

    found = []
    for route in app.routes:
        path = getattr(route, "path", "")
        if not path.startswith("/api/") or path == "/api/me":
            continue
        concrete = re.sub(r"\{[^}]+\}", "x1", path)
        for method in sorted((getattr(route, "methods", None) or set()) - {"HEAD", "OPTIONS"}):
            found.append((method, concrete))
    return sorted(set(found))


def test_the_legacy_routes_exist_to_be_protected():
    routes = _protected_routes()
    assert len(routes) >= 8
    assert {m for m, _ in routes} >= {"GET", "POST"}  # not only reads


def test_no_route_under_api_is_mounted_without_the_membership_check():
    from app.auth.deps import current_member
    from fastapi.routing import APIRoute

    unprotected = []
    for route in app.routes:
        if isinstance(route, APIRoute) and route.path.startswith("/api/") and route.path != "/api/me":
            uses = any(d.call is current_member for d in route.dependant.dependencies)
            if not uses:
                unprotected.append(route.path)
    assert unprotected == []


@pytest.mark.parametrize("method,path", _protected_routes())
def test_every_legacy_route_refuses_a_caller_with_no_token(client, verifier, auth_db, method, path):
    assert client.request(method, path).status_code == 401


@pytest.mark.parametrize("method,path", _protected_routes())
def test_every_legacy_route_asks_a_signed_in_person_without_an_organisation_to_onboard(client, verifier, auth_db, method, path):
    r = client.request(method, path, headers=bearer(token()))
    assert r.status_code == 403 and r.json()["error"]["code"] == "onboarding_required"


def test_legacy_routes_open_up_for_a_member(client, verifier, auth_db):
    client.get("/api/me", headers=bearer(token()))
    join_org(auth_db)
    assert client.get("/api/projects", headers=bearer(token())).status_code == 200


def test_removed_membership_is_refused_on_the_next_request(client, verifier, auth_db):
    client.get("/api/me", headers=bearer(token()))
    join_org(auth_db)
    assert client.get("/api/projects", headers=bearer(token())).status_code == 200
    with auth_db() as db:
        db.execute(text("delete from organization_members"))
        db.commit()
    r = client.get("/api/projects", headers=bearer(token()))
    assert r.status_code == 403 and r.json()["error"]["code"] == "onboarding_required"


def test_suspended_membership_is_refused(client, verifier, auth_db):
    client.get("/api/me", headers=bearer(token()))
    join_org(auth_db, member_status="suspended")
    r = client.get("/api/projects", headers=bearer(token()))
    assert r.status_code == 403 and r.json()["error"]["code"] == "membership_suspended"


@pytest.mark.parametrize("path", ["/", "/live", "/health", "/ready"])
def test_health_and_root_stay_public(client, path):
    assert client.get(path).status_code in (200, 503)  # 503 only if the database were down; never 401
    assert client.get(path).status_code != 401
