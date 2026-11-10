"""Round 2 audit of F15-F19: the acceptance order, the lock re-check proven deterministically, the audit flood guard,
and other cases the second reviewer asked for."""
import threading
import time
import uuid
from concurrent.futures import ThreadPoolExecutor

import pytest
from sqlalchemy import text
from test_org_api import Org, invite, org, person, q, raw_token, scalar, tok  # noqa: F401  (org is a fixture)

pytestmark = pytest.mark.usefixtures("confirmed_email")


# --- the outside call is only made when it can matter ---------------------------------

def test_junk_used_and_foreign_tokens_cause_no_call_to_supabase(org, client, confirmed_email):
    client.post("/api/invites/accept", json={"token": "j" * 43}, headers=tok(8))                          # made-up token
    t = raw_token(invite(client, 1, person(7)[1]))
    client.post("/api/invites/accept", json={"token": t}, headers=tok(8, "someone.else@example.com"))   # someone else's link
    assert confirmed_email["calls"] == []
    assert client.post("/api/invites/accept", json={"token": t}, headers=tok(7)).status_code == 200
    assert confirmed_email["calls"] == [person(7)[0]]
    client.post("/api/invites/accept", json={"token": t}, headers=tok(7))                                # used token
    assert confirmed_email["calls"] == [person(7)[0]]


def test_an_expired_or_revoked_link_causes_no_call_to_supabase(org, client, auth_db, confirmed_email):
    r = invite(client, 1, person(7)[1])
    client.delete(f"/api/organization/invites/{r.json()['invite']['id']}", headers=tok(1))
    client.post("/api/invites/accept", json={"token": raw_token(r)}, headers=tok(7))
    assert confirmed_email["calls"] == []


def test_the_confirmation_check_is_given_the_address_from_the_token(org, client, confirmed_email):
    seen = []
    confirmed_email["answer"] = True
    original = confirmed_email["calls"]

    from app.auth.email_confirmation import get_email_confirmation_check
    from app.main import app

    def check(subject, email):
        seen.append((subject, email))
        return True

    app.dependency_overrides[get_email_confirmation_check] = lambda: check
    t = raw_token(invite(client, 1, person(7)[1]))
    assert client.post("/api/invites/accept", json={"token": t}, headers=tok(7)).status_code == 200
    assert seen == [person(7)] and original == []


# --- already a member of the SAME organisation is a clean 409, not a crash --------------

def test_accepting_when_already_in_the_same_organisation_is_409_not_500(org, client, auth_db):
    t = raw_token(invite(client, 1, "latecomer@example.com"))
    client.get("/api/me", headers=tok(5, "latecomer@example.com"))
    org.add(5, "researcher")  # became a member by another route after the invitation was made
    r = client.post("/api/invites/accept", json={"token": t}, headers=tok(5, "latecomer@example.com"))
    assert r.status_code == 409 and r.json()["error"]["code"] == "already_member"
    assert scalar(auth_db, "select count(*) from organization_members") == 2


# --- audit growth and completeness --------------------------------------------------------

def test_a_flood_of_refused_requests_writes_one_audit_row_per_minute(org, client, auth_db):
    org.add(2, "researcher")
    for _ in range(40):
        client.patch("/api/organization", json={"name": "No"}, headers=tok(2))
        client.post("/api/invites/accept", json={"token": "f" * 43}, headers=tok(8))
    assert scalar(auth_db, "select count(*) from audit_events where action='organization_rename_refused'") == 1
    assert scalar(auth_db, "select count(*) from audit_events where action='invite_accept_refused'") == 1


def test_different_refusals_are_still_all_recorded(org, client, auth_db):
    org.add(2, "researcher")
    org.add(3, "researcher")
    for target in (org.member_id(1), org.member_id(3)):
        client.delete(f"/api/organization/members/{target}", headers=tok(2))
    assert scalar(auth_db, "select count(*) from audit_events where action='member_remove_refused'") == 2  # two targets


def test_profile_changes_are_audited_without_values(client, verifier, auth_db):
    client.patch("/api/me", json={"fullName": "Secret Name Here"}, headers=tok(1))
    rows = q(auth_db, "select details from audit_events where action='profile_updated'")
    assert len(rows) == 1 and rows[0]["details"] == {"fields": ["full_name"]}  # the field name, never the value
    assert "Secret Name Here" not in str(q(auth_db, "select * from audit_events"))


def test_an_email_change_in_the_token_is_audited_without_addresses(client, verifier, auth_db):
    from auth_support import bearer, token

    sub = person(1)[0]
    client.get("/api/me", headers=bearer(token(sub=sub, email="before@example.com")))
    client.get("/api/me", headers=bearer(token(sub=sub, email="after@example.com")))
    assert q(auth_db, "select 1 from audit_events where action='email_synced'")
    dump = str(q(auth_db, "select * from audit_events"))
    assert "before@example" not in dump and "after@example" not in dump


# --- the locked re-check, proven with two real database sessions -------------------------

def test_the_repository_recheck_sees_a_role_change_made_while_it_waits_for_the_lock(org, client, auth_db):
    """Deterministic version of the race: the admin's removal request is in flight while the owner promotes the target
    (and commits). The removal must wait for the lock, then see the NEW role and refuse."""
    from app.core.errors import AppError
    from app.repositories import organization_repository as repo

    org.add(2, "admin")
    org.add(3, "researcher")
    mid3 = uuid.UUID(org.member_id(3))
    actor = scalar(auth_db, "select id from users where auth_subject=:s", s=person(2)[0])
    outcome = {}

    with auth_db() as owner_session:
        # the owner's request has the target row locked and is about to promote it
        owner_session.execute(text("select id from organization_members where id=:i for update"), {"i": mid3})

        def admin_request():
            with auth_db() as db:
                try:
                    repo.remove_member(db, uuid.UUID(org.id), mid3, actor)
                    outcome["result"] = "removed"
                except AppError as exc:
                    outcome["result"] = exc.http_status

        thread = threading.Thread(target=admin_request)
        thread.start()
        time.sleep(0.8)  # the admin's request is now blocked on the lock
        assert thread.is_alive(), "the removal did not wait for the lock"
        owner_session.execute(text("update organization_members set role='admin' where id=:i"), {"i": mid3})
        owner_session.commit()
        thread.join(timeout=10)
    assert outcome["result"] == 403
    assert scalar(auth_db, "select count(*) from organization_members where id=:i", i=mid3) == 1  # still a member


def test_role_change_waits_for_the_lock_and_uses_the_current_actor_role(org, client, auth_db):
    """An owner-demoted admin must not be able to complete a promotion that was already waiting."""
    from app.core.errors import AppError
    from app.repositories import organization_repository as repo

    org.add(2, "admin")
    org.add(3, "researcher")
    mid2, mid3 = uuid.UUID(org.member_id(2)), uuid.UUID(org.member_id(3))
    actor = scalar(auth_db, "select id from users where auth_subject=:s", s=person(2)[0])
    outcome = {}
    with auth_db() as other:
        other.execute(text("select id from organization_members where id=:i for update"), {"i": mid2})  # the admin's own row

        def request():
            with auth_db() as db:
                try:
                    repo.change_member_role(db, uuid.UUID(org.id), mid3, "admin", actor)
                    outcome["result"] = "changed"
                except AppError as exc:
                    outcome["result"] = exc.http_status

        thread = threading.Thread(target=request)
        thread.start()
        time.sleep(0.8)
        other.execute(text("update organization_members set role='researcher' where id=:i"), {"i": mid2})  # demoted meanwhile
        other.commit()
        thread.join(timeout=10)
    assert outcome["result"] == 403
    assert scalar(auth_db, "select role from organization_members where id=:i", i=mid3) == "researcher"


# --- smaller cases --------------------------------------------------------------------

@pytest.mark.parametrize("address", ["a..b@example.com", ".a@example.com", "a.@example.com", "a b@example.com", "@example.com"])
def test_invite_addresses_with_bad_dots_or_spaces_are_refused(org, client, address):
    assert client.post("/api/organization/invites", json={"email": address, "role": "researcher"}, headers=tok(1)).status_code == 422


def test_member_list_never_includes_another_organisations_members(org, client, auth_db):
    other = Org(client, auth_db, owner=9, name="Other")
    other.add(10, "researcher")
    emails = {m["email"] for m in client.get("/api/organization/members", headers=tok(1)).json()["items"]}
    assert emails == {person(1)[1]} and other.id != org.id


def test_acceptance_by_a_suspended_account_is_refused(org, client, auth_db):
    t = raw_token(invite(client, 1, person(7)[1]))
    client.get("/api/me", headers=tok(7))
    with auth_db() as db:
        db.execute(text("update users set status='suspended' where auth_subject=:s"), {"s": person(7)[0]})
        db.commit()
    assert client.post("/api/invites/accept", json={"token": t}, headers=tok(7)).status_code == 403


def test_refusal_rows_for_wrong_address_and_unconfirmed_carry_no_email_or_token(org, client, auth_db, confirmed_email):
    t = raw_token(invite(client, 1, "owner.of.link@example.com"))
    client.post("/api/invites/accept", json={"token": t}, headers=tok(8, "intruder@example.com"))
    confirmed_email["answer"] = False
    client.post("/api/invites/accept", json={"token": t}, headers=tok(5, "owner.of.link@example.com"))
    dump = str(q(auth_db, "select * from audit_events"))
    assert t not in dump and "intruder@" not in dump and "owner.of.link@" not in dump


def test_concurrent_invite_creation_and_inviter_removal_do_not_deadlock(org, client, auth_db):
    org.add(2, "admin")

    def create(i):
        return client.post("/api/organization/invites", json={"email": f"d{i}@example.com", "role": "researcher"}, headers=tok(2)).status_code

    def remove():
        return client.delete(f"/api/organization/members/{org.member_id(2)}", headers=tok(1)).status_code

    with ThreadPoolExecutor(max_workers=8) as pool:
        futures = [pool.submit(create, i) for i in range(6)] + [pool.submit(remove)]
        codes = [f.result(timeout=60) for f in futures]  # a deadlock would time out here
    assert set(codes) <= {201, 403, 204} and codes[-1] == 204
    # an invitation made just before the removal is revoked with its inviter; one made after it was refused (403)
    open_by_removed = scalar(
        auth_db, "select count(*) from organization_invites where accepted_at is null and revoked_at is null "
                 "and invited_by=(select id from users where auth_subject=:s)", s=person(2)[0])
    assert open_by_removed == 0
