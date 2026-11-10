"""Round 1 audit of F15-F19: cases that were missing, and the new guarantees (locked re-check, audit of every
refusal, email-confirmation gate on acceptance)."""
import http.client
import io
import json as _json
import urllib.error
import uuid
from concurrent.futures import ThreadPoolExecutor  # noqa: F401

import pytest
from sqlalchemy import text
from test_org_api import Org, invite, org, person, q, raw_token, scalar, tok  # noqa: F401  (org is a fixture)

pytestmark = pytest.mark.usefixtures("confirmed_email")


def refusals(maker, action=None):
    sql = "select action, reason_code, organization_id, actor_user_id from audit_events where outcome='refused'"
    return q(maker, sql + (" and action=:a" if action else ""), **({"a": action} if action else {}))


def test_every_kind_of_refusal_leaves_an_audit_row(org, client, auth_db):
    org.add(2, "admin")
    org.add(3, "researcher")
    mid1, mid3 = org.member_id(1), org.member_id(3)
    inv = invite(client, 1, "pending@example.com", "admin").json()["invite"]["id"]
    client.delete(f"/api/organization/members/{mid1}", headers=tok(3))                                          # researcher vs owner
    client.delete(f"/api/organization/members/{uuid.uuid4()}", headers=tok(1))                                  # guessed member id
    client.patch(f"/api/organization/members/{mid3}", json={"role": "admin"}, headers=tok(2))                   # admin promoting
    client.post("/api/organization/invites", json={"email": "x@example.com", "role": "admin"}, headers=tok(2))  # admin inviting admin
    client.get("/api/organization/invites", headers=tok(3))                                                     # researcher listing
    client.delete(f"/api/organization/invites/{inv}", headers=tok(3))                                           # researcher revoking
    client.delete(f"/api/organization/invites/{inv}", headers=tok(2))                                           # admin vs admin invite
    client.delete(f"/api/organization/invites/{uuid.uuid4()}", headers=tok(1))                                  # guessed invite id
    invite(client, 1, "pending@example.com", "admin")                                                           # duplicate open invite
    invite(client, 1, person(3)[1])                                                                             # already a member
    client.post("/api/onboarding", json={"organizationName": "Again"}, headers=tok(1))                          # already a member
    client.post("/api/invites/accept", json={"token": "n" * 43}, headers=tok(8))                                # unknown token
    seen = {(r["action"], r["reason_code"]) for r in refusals(auth_db)}
    expected = {("member_remove_refused", "owner"), ("member_remove_refused", "not_found"), ("member_role_change_refused", "role"),
                ("invite_refused", "role"), ("invite_list_refused", "role"), ("invite_revoke_refused", "role"),
                ("invite_revoke_refused", "not_found"), ("invite_refused", "already_open"), ("invite_refused", "already_member"),
                ("organization_create_refused", "already_member"), ("invite_accept_refused", "unknown_token")}
    assert expected <= seen, f"missing: {expected - seen}"


def test_audit_rows_of_refusals_do_not_carry_emails_or_tokens(org, client, auth_db):
    t = raw_token(invite(client, 1, "private.person@example.com"))
    client.post("/api/invites/accept", json={"token": t}, headers=tok(8, "someone.else@example.com"))
    dump = str(q(auth_db, "select details, reason_code, entity_id from audit_events"))
    assert t not in dump and "private.person" not in dump and "someone.else" not in dump


def test_invalid_token_attempts_are_recorded_against_the_caller_once_per_minute(org, client, auth_db):
    client.get("/api/me", headers=tok(8))
    for i in range(3):
        client.post("/api/invites/accept", json={"token": f"guess-{i}-" + "z" * 30}, headers=tok(8))
    rows = refusals(auth_db, "invite_accept_refused")
    # the same person refused for the same reason is written once per minute (the log cannot be pruned)
    assert len(rows) == 1 and rows[0]["organization_id"] is None and rows[0]["actor_user_id"] is not None


def test_a_suspended_membership_and_a_suspended_account_are_refused_by_the_organisation_routes(org, client, auth_db):
    org.add(2, "researcher")
    org.add(3, "researcher")
    with auth_db() as db:
        db.execute(text("update organization_members set status='suspended' where user_id=(select id from users where auth_subject=:s)"), {"s": person(2)[0]})
        db.execute(text("update users set status='suspended' where auth_subject=:s"), {"s": person(3)[0]})
        db.commit()
    for n, code in ((2, "membership_suspended"), (3, "account_suspended")):
        r = client.get("/api/organization", headers=tok(n))
        assert r.status_code == 403 and r.json()["error"]["code"] == code
    assert any(r["reason_code"] == "membership_suspended" for r in refusals(auth_db))


def test_an_administrator_can_leave_but_an_owner_cannot(org, client):
    org.add(2, "admin")
    assert client.delete(f"/api/organization/members/{org.member_id(1)}", headers=tok(1)).status_code == 403
    assert client.delete(f"/api/organization/members/{org.member_id(2)}", headers=tok(2)).status_code == 204


@pytest.mark.parametrize("body", [{"role": "admin", "status": "suspended"}, {"role": "admin", "userId": "x"}, {}, {"role": None}, {"status": "active"}])
def test_member_patch_rejects_extra_or_missing_fields(org, client, body):
    org.add(2, "researcher")
    assert client.patch(f"/api/organization/members/{org.member_id(2)}", json=body, headers=tok(1)).status_code == 422


def test_admin_and_owner_see_usage(org, client):
    org.add(2, "admin")
    assert client.get("/api/organization", headers=tok(1)).json()["permissions"]["canSeeUsage"] is True
    admin_view = client.get("/api/organization", headers=tok(2)).json()
    assert admin_view["permissions"]["canSeeUsage"] is True and admin_view["usage"]["members"] == 2


def test_tokens_are_long_random_and_never_repeat(org, client):
    tokens = {raw_token(invite(client, 1, f"u{i}@example.com")) for i in range(5)}
    assert len(tokens) == 5 and all(len(t) >= 43 for t in tokens)


def test_invite_email_is_trimmed_and_lower_cased(org, client):
    r = client.post("/api/organization/invites", json={"email": "  Mixed.Case@Example.COM  ", "role": "researcher"}, headers=tok(1))
    assert r.status_code == 201 and r.json()["invite"]["email"] == "mixed.case@example.com"


def test_expiry_boundary_an_invitation_expiring_this_second_is_dead(org, client, auth_db):
    t = raw_token(invite(client, 1, person(7)[1]))
    with auth_db() as db:
        db.execute(text("update organization_invites set expires_at = now()"))
        db.commit()
    r = client.post("/api/invites/accept", json={"token": t}, headers=tok(7))
    assert r.status_code == 400 and r.json()["error"]["code"] == "invite_invalid"


def test_an_admin_cannot_probe_or_revoke_another_organisations_invitation(org, client, auth_db):
    org.add(2, "admin")
    other = Org(client, auth_db, owner=9, name="Other")
    foreign = invite(client, 9, "f@example.com").json()["invite"]["id"]
    assert client.delete(f"/api/organization/invites/{foreign}", headers=tok(2)).status_code == 404
    assert client.get("/api/organization/invites", headers=tok(2)).json()["items"] == []
    assert other.id != org.id


def test_an_invitation_ends_when_its_inviter_leaves_or_is_removed(org, client):
    org.add(2, "admin")
    org.add(3, "admin")
    t2 = raw_token(invite(client, 2, person(7)[1], "researcher"))
    t3 = raw_token(invite(client, 3, person(8)[1], "researcher"))
    assert client.delete(f"/api/organization/members/{org.member_id(2)}", headers=tok(2)).status_code == 204   # leaves
    assert client.delete(f"/api/organization/members/{org.member_id(3)}", headers=tok(1)).status_code == 204   # removed
    for t, n in ((t2, 7), (t3, 8)):
        r = client.post("/api/invites/accept", json={"token": t}, headers=tok(n))
        assert r.status_code == 400 and r.json()["error"]["code"] == "invite_invalid"


def test_a_member_of_another_organisation_can_be_invited_but_cannot_accept(org, client, auth_db):
    Org(client, auth_db, owner=9, name="Other")
    r = invite(client, 1, person(9)[1])
    assert r.status_code == 201
    assert client.post("/api/invites/accept", json={"token": raw_token(r)}, headers=tok(9)).status_code == 409


def test_a_no_change_role_update_writes_no_audit_row(org, client, auth_db):
    org.add(2, "researcher")
    client.patch(f"/api/organization/members/{org.member_id(2)}", json={"role": "researcher"}, headers=tok(1))
    assert scalar(auth_db, "select count(*) from audit_events where action='member_role_changed'") == 0


def test_the_expiry_sweep_is_audited(org, client, auth_db):
    invite(client, 1, "late@example.com")
    with auth_db() as db:
        db.execute(text("update organization_invites set expires_at = now() - interval '1 day'"))
        db.commit()
    invite(client, 1, "late@example.com")
    assert q(auth_db, "select action from audit_events where action='invite_expired_revoked'")


def test_button_flags_follow_the_real_rules(org, client):
    org.add(2, "admin")
    org.add(3, "researcher")
    owner_view = {m["email"]: m for m in client.get("/api/organization/members", headers=tok(1)).json()["items"]}
    assert owner_view[person(3)[1]]["canChangeRole"] and owner_view[person(2)[1]]["canRemove"]
    assert not owner_view[person(1)[1]]["canChangeRole"] and not owner_view[person(1)[1]]["canRemove"]
    admin_view = {m["email"]: m for m in client.get("/api/organization/members", headers=tok(2)).json()["items"]}
    assert admin_view[person(3)[1]]["canRemove"] is True and admin_view[person(3)[1]]["canChangeRole"] is False
    assert admin_view[person(1)[1]]["canRemove"] is False


def test_invite_revoke_flag_is_false_for_an_admin_on_an_admin_invite(org, client):
    org.add(2, "admin")
    invite(client, 1, "adm@example.com", "admin")
    invite(client, 1, "res@example.com", "researcher")
    flags = {i["email"]: i["canRevoke"] for i in client.get("/api/organization/invites", headers=tok(2)).json()["items"]}
    assert flags == {"adm@example.com": False, "res@example.com": True}


def test_invite_list_says_when_it_was_cut_off(org, client, auth_db):
    from app.repositories import organization_repository as repo

    with auth_db() as db:
        owner = db.execute(text("select id from users where auth_subject=:s"), {"s": person(1)[0]}).scalar_one()
        for i in range(repo.INVITE_LIST_LIMIT + 1):
            db.execute(text("insert into organization_invites (organization_id, email, role, token_hash, invited_by, expires_at, revoked_at) "
                            "values (:o, :e, 'researcher', :h, :u, now() + interval '1 day', now())"),
                       {"o": org.id, "e": f"bulk{i}@example.com", "h": f"{i:064d}", "u": owner})
        db.commit()
    body = client.get("/api/organization/invites", headers=tok(1)).json()
    assert len(body["items"]) == repo.INVITE_LIST_LIMIT and body["truncated"] is True


# --- the email-confirmation gate on acceptance -----------------------------------------

def test_acceptance_asks_supabase_about_the_signed_in_person(org, client, confirmed_email):
    t = raw_token(invite(client, 1, person(7)[1]))
    assert client.post("/api/invites/accept", json={"token": t}, headers=tok(7)).status_code == 200
    assert confirmed_email["calls"] == [person(7)[0]]


def test_an_unconfirmed_address_cannot_accept_and_the_invitation_stays_usable(org, client, confirmed_email, auth_db):
    t = raw_token(invite(client, 1, person(7)[1]))
    confirmed_email["answer"] = False
    r = client.post("/api/invites/accept", json={"token": t}, headers=tok(7))
    assert r.status_code == 403 and r.json()["error"]["code"] == "email_not_confirmed"
    assert scalar(auth_db, "select count(*) from organization_members") == 1
    confirmed_email["answer"] = True
    assert client.post("/api/invites/accept", json={"token": t}, headers=tok(7)).status_code == 200


def test_when_supabase_cannot_be_asked_acceptance_fails_closed(org, client, confirmed_email, auth_db):
    from app.core.errors import AppError

    t = raw_token(invite(client, 1, person(7)[1]))
    confirmed_email["answer"] = AppError("auth_unavailable", 503, "down")
    assert client.post("/api/invites/accept", json={"token": t}, headers=tok(7)).status_code == 503
    assert scalar(auth_db, "select count(*) from organization_members") == 1


def test_without_a_secret_key_acceptance_fails_closed_and_the_invitation_stays_usable(org, client, confirmed_email, auth_db):
    """No way to ask Supabase is NOT a pass (a security review flagged the earlier fail-open behaviour)."""
    confirmed_email["answer"] = None
    t = raw_token(invite(client, 1, person(7)[1]))
    assert client.post("/api/invites/accept", json={"token": t}, headers=tok(8, "wrong@example.com")).status_code == 403
    r = client.post("/api/invites/accept", json={"token": t}, headers=tok(7))
    assert r.status_code == 503 and r.json()["error"]["code"] == "confirmation_unavailable"
    assert scalar(auth_db, "select count(*) from organization_members") == 1
    assert q(auth_db, "select 1 from audit_events where reason_code='confirmation_unavailable'")
    confirmed_email["answer"] = True  # once the setup is finished the same link works
    assert client.post("/api/invites/accept", json={"token": t}, headers=tok(7)).status_code == 200


def test_the_real_confirmation_lookup_reads_supabases_answer_and_fails_closed(monkeypatch):
    from app.auth import email_confirmation as ec
    from app.core.config import settings
    from app.core.errors import AppError

    monkeypatch.setattr(settings, "supabase_url", "https://example.supabase.co")
    monkeypatch.setattr(settings, "supabase_secret_key", "sb_secret_test")
    seen = {}

    class FakeOpener:
        def open(self, request, timeout):
            seen["url"], seen["auth"], seen["apikey"], seen["timeout"] = (
                request.full_url, request.headers.get("Authorization"), request.headers.get("Apikey"), timeout)
            if isinstance(seen.get("raise"), Exception):
                raise seen["raise"]
            return io.BytesIO(seen["raw"] if "raw" in seen else _json.dumps(seen["body"]).encode())

    monkeypatch.setattr(ec, "_opener", FakeOpener())
    seen["body"] = {"email": "A@Example.com", "email_confirmed_at": "2026-11-10T00:00:00Z"}
    assert ec.email_is_confirmed("a/b?c", "a@example.com") is True
    assert seen["url"].endswith("/auth/v1/admin/users/a%2Fb%3Fc") and seen["auth"] == "Bearer sb_secret_test"
    assert seen["apikey"] == "sb_secret_test" and seen["timeout"] <= 5
    seen["body"] = {"email": "a@example.com", "email_confirmed_at": None}
    assert ec.email_is_confirmed("x", "a@example.com") is False
    seen["body"] = {"email": "a@example.com", "confirmed_at": "2026-11-10", "email_confirmed_at": None}  # phone-confirmed only
    assert ec.email_is_confirmed("x", "a@example.com") is False
    seen["body"] = {"email": "someone-else@example.com", "email_confirmed_at": "2026-11-10T00:00:00Z"}
    assert ec.email_is_confirmed("x", "a@example.com") is False  # Supabase holds a different address

    for failure in (urllib.error.URLError("down"), urllib.error.HTTPError("u", 401, "no", {}, None), ConnectionResetError(),
                    TimeoutError(), http.client.IncompleteRead(b"")):
        seen["raise"] = failure
        with pytest.raises(AppError) as info:
            ec.email_is_confirmed("x", "a@example.com")
        assert info.value.http_status == 503, type(failure).__name__
    seen.pop("raise")
    for raw in (b"[1, 2]", b"not json", b"null"):
        seen["raw"] = raw
        with pytest.raises(AppError) as info:
            ec.email_is_confirmed("x", "a@example.com")
        assert info.value.http_status == 503
    monkeypatch.setattr(settings, "supabase_url", "http://localhost:54321")  # the secret is never sent over plain http
    assert ec.email_is_confirmed("x", "a@example.com") is None
    monkeypatch.setattr(settings, "supabase_url", "https://example.supabase.co")
    monkeypatch.setattr(settings, "supabase_secret_key", None)
    assert ec.email_is_confirmed("x", "a@example.com") is None


def test_the_confirmation_lookup_never_follows_a_redirect():
    import urllib.request

    from app.auth import email_confirmation as ec

    handler = next(h for h in ec._opener.handlers if isinstance(h, ec._NoRedirect))
    req = urllib.request.Request("https://example.supabase.co/auth/v1/admin/users/x")
    assert handler.redirect_request(req, None, 302, "Found", {}, "https://evil.example/") is None


def test_slug_attempts_running_out_is_a_clean_409_with_nothing_created(client, verifier, auth_db, monkeypatch):
    import secrets as secrets_module

    monkeypatch.setattr(secrets_module, "token_hex", lambda n: "abcdef")
    with auth_db() as db:
        for slug in ["taken", "taken-abcdef"]:
            db.execute(text("insert into organizations (name, slug) values ('x', :s)"), {"s": slug})
        db.commit()
    r = client.post("/api/onboarding", json={"organizationName": "Taken"}, headers=tok(1))
    assert r.status_code == 409 and r.json()["error"]["code"] == "organization_name_unavailable"
    assert scalar(auth_db, "select count(*) from organizations") == 2 and scalar(auth_db, "select count(*) from organization_members") == 0
