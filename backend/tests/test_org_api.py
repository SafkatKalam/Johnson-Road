"""F15 to F18: onboarding, organisation, members, invitations. Real PostgreSQL, real routes, local test keys."""
import uuid
from concurrent.futures import ThreadPoolExecutor

import pytest
from auth_support import bearer, token
from sqlalchemy import text

from app.repositories.user_repository import slugify

pytestmark = pytest.mark.usefixtures("confirmed_email")  # no test here calls the real Supabase


def person(n: int, email: str | None = None) -> tuple[str, str]:
    return f"{n:08d}-0000-0000-0000-000000000000", email or f"person{n}@example.com"


def tok(n: int, email: str | None = None) -> dict:
    sub, mail = person(n, email)
    return bearer(token(sub=sub, email=mail))


def q(maker, sql, **params):
    with maker() as db:
        return db.execute(text(sql), params).mappings().all()


def scalar(maker, sql, **params):
    return q(maker, sql, **params)[0][list(q(maker, sql, **params)[0].keys())[0]]


class Org:
    """An organisation with an owner (made through the real onboarding route) and helper members."""

    def __init__(self, client, maker, owner=1, name="Acme Roads"):
        self.client, self.maker = client, maker
        self.owner = owner
        r = client.post("/api/onboarding", json={"organizationName": name}, headers=tok(owner))
        assert r.status_code == 201, r.text
        self.id = r.json()["organization"]["id"]

    def add(self, n: int, role: str):
        """Make person n a member with `role` straight in the database (the invite flow is tested separately)."""
        self.client.get("/api/me", headers=tok(n))
        with self.maker() as db:
            db.execute(text("""INSERT INTO organization_members (organization_id, user_id, role)
                               SELECT :o, id, :r FROM users WHERE auth_subject = :s"""),
                       {"o": self.id, "r": role, "s": person(n)[0]})
            db.commit()
        return n

    def member_id(self, n: int) -> str:
        return str(scalar(self.maker, "select m.id from organization_members m join users u on u.id=m.user_id where u.auth_subject=:s",
                          s=person(n)[0]))


@pytest.fixture()
def org(client, verifier, auth_db):
    return Org(client, auth_db)


# =============================================================== F15 onboarding

def test_onboarding_creates_the_organisation_and_an_owner_membership(client, verifier, auth_db):
    r = client.post("/api/onboarding", json={"organizationName": "  Greater London Transport  "}, headers=tok(1))
    assert r.status_code == 201
    body = r.json()
    assert body["needsOnboarding"] is False and body["role"] == "owner"
    assert body["organization"]["name"] == "Greater London Transport" and body["organization"]["slug"] == "greater-london-transport"
    assert body["organization"]["plan"] == "starter"
    assert scalar(auth_db, "select count(*) from organizations") == 1
    assert q(auth_db, "select role, status from organization_members")[0]["role"] == "owner"
    assert q(auth_db, "select action from audit_events where action='organization_created'")


@pytest.mark.parametrize("name", ["", "   ", "x" * 121, "bad\x00name", "line\nbreak"])
def test_onboarding_refuses_bad_names(client, verifier, auth_db, name):
    assert client.post("/api/onboarding", json={"organizationName": name}, headers=tok(1)).status_code == 422
    assert scalar(auth_db, "select count(*) from organizations") == 0


@pytest.mark.parametrize("extra", [{"plan": "enterprise"}, {"role": "owner"}, {"ownerId": "x"}, {"slug": "mine"}])
def test_onboarding_cannot_name_plan_role_or_slug(client, verifier, auth_db, extra):
    r = client.post("/api/onboarding", json={"organizationName": "Acme", **extra}, headers=tok(1))
    assert r.status_code == 422 and scalar(auth_db, "select count(*) from organizations") == 0


def test_onboarding_needs_a_token(client, verifier, auth_db):
    assert client.post("/api/onboarding", json={"organizationName": "A"}).status_code == 401


def test_second_onboarding_is_409_and_creates_nothing(client, verifier, auth_db):
    client.post("/api/onboarding", json={"organizationName": "First"}, headers=tok(1))
    r = client.post("/api/onboarding", json={"organizationName": "Second"}, headers=tok(1))
    assert r.status_code == 409 and r.json()["error"]["code"] == "already_member"
    assert scalar(auth_db, "select count(*) from organizations") == 1 and scalar(auth_db, "select count(*) from organization_members") == 1


def test_simultaneous_onboarding_gives_exactly_one_organisation(client, verifier, auth_db):
    headers = tok(1)
    with ThreadPoolExecutor(max_workers=8) as pool:
        results = list(pool.map(lambda i: client.post("/api/onboarding", json={"organizationName": f"Org {i}"}, headers=headers), range(8)))
    codes = sorted(r.status_code for r in results)
    assert codes.count(201) == 1 and set(codes) <= {201, 409}, codes
    assert scalar(auth_db, "select count(*) from organizations") == 1 and scalar(auth_db, "select count(*) from organization_members") == 1


def test_two_people_may_use_the_same_organisation_name(client, verifier, auth_db):
    a = client.post("/api/onboarding", json={"organizationName": "Acme"}, headers=tok(1)).json()["organization"]["slug"]
    b = client.post("/api/onboarding", json={"organizationName": "Acme"}, headers=tok(2)).json()["organization"]["slug"]
    assert a == "acme" and b.startswith("acme-") and a != b


def test_a_failure_halfway_leaves_no_organisation_behind(client, verifier, auth_db, monkeypatch):
    from app.repositories import audit_repository

    def boom(*a, **k):
        raise RuntimeError("simulated failure after both inserts")

    monkeypatch.setattr(audit_repository, "record", boom)
    r = client.post("/api/onboarding", json={"organizationName": "Halfway"}, headers=tok(1))
    assert r.status_code == 500
    assert scalar(auth_db, "select count(*) from organizations") == 0 and scalar(auth_db, "select count(*) from organization_members") == 0


@pytest.mark.parametrize("name,slug", [("Acme Roads Ltd.", "acme-roads-ltd"), ("  --Hi!!  ", "hi"), ("日本語", "org"), ("x" * 100, "x" * 40)])
def test_slugify(name, slug):
    assert slugify(name) == slug


# =============================================================== F16 organisation

def test_member_sees_their_organisation_and_permissions(org, client):
    org.add(2, "researcher")
    body = client.get("/api/organization", headers=tok(2)).json()
    assert body["organization"]["name"] == "Acme Roads" and body["role"] == "researcher"
    assert body["permissions"] == {"canEdit": False, "canInvite": False, "canSeeUsage": False}
    assert body["usage"] is None and body["limits"] is None


def test_owner_sees_usage_counted_from_real_records(org, client, auth_db):
    with auth_db() as db:
        pid = db.execute(text("insert into projects (organization_id, name) values (:o,'P1') returning id"), {"o": org.id}).scalar_one()
        db.execute(text("insert into projects (organization_id, name, archived_at) values (:o,'Old', now())"), {"o": org.id})
        db.execute(text("""insert into uploads (organization_id, project_id, original_name, storage_key, extension, status,
                             size_bytes, checksum_sha256, duration_seconds, width_px, height_px, frame_rate)
                           values (:o,:p,'a.mp4','k1','mp4','ready',1000,'x',5,640,480,25),
                                  (:o,:p,'b.mp4','k2','mp4','ready',2500,'x',5,640,480,25)"""), {"o": org.id, "p": pid})
        db.commit()
    usage = client.get("/api/organization", headers=tok(1)).json()["usage"]
    assert usage["projects"] == 1 and usage["uploads"] == 2 and usage["storageBytes"] == 3500
    assert usage["members"] == 1 and usage["jobsTotal"] == 0 and usage["reports"] == 0


def test_usage_never_counts_another_organisations_records(org, client, auth_db):
    other = Org(client, auth_db, owner=9, name="Other")
    with auth_db() as db:
        db.execute(text("insert into projects (organization_id, name) values (:o,'Theirs')"), {"o": other.id})
        db.commit()
    assert client.get("/api/organization", headers=tok(1)).json()["usage"]["projects"] == 0


def test_owner_and_admin_can_rename_and_it_persists(org, client):
    org.add(2, "admin")
    assert client.patch("/api/organization", json={"name": " New Name "}, headers=tok(1)).json()["organization"]["name"] == "New Name"
    assert client.patch("/api/organization", json={"name": "Admin Name"}, headers=tok(2)).status_code == 200
    assert client.get("/api/organization", headers=tok(1)).json()["organization"]["name"] == "Admin Name"


def test_researcher_cannot_rename_and_the_refusal_is_audited(org, client, auth_db):
    org.add(2, "researcher")
    r = client.patch("/api/organization", json={"name": "Hacked"}, headers=tok(2))
    assert r.status_code == 403 and client.get("/api/organization", headers=tok(1)).json()["organization"]["name"] == "Acme Roads"
    refused = q(auth_db, "select outcome, reason_code from audit_events where action='organization_rename_refused'")
    assert refused and refused[0]["outcome"] == "refused"


@pytest.mark.parametrize("body", [{"name": ""}, {"name": "x" * 121}, {"name": "A", "plan": "enterprise"}, {"name": "A", "slug": "x"}, {}])
def test_rename_validation(org, client, body):
    assert client.patch("/api/organization", json=body, headers=tok(1)).status_code == 422


def test_renaming_in_one_organisation_never_touches_another(org, client, auth_db):
    other = Org(client, auth_db, owner=9, name="Other")
    client.patch("/api/organization", json={"name": "Renamed"}, headers=tok(1))
    assert client.get("/api/organization", headers=tok(9)).json()["organization"]["name"] == "Other"
    assert other.id != org.id


def test_organisation_routes_need_membership(client, verifier, auth_db):
    client.get("/api/me", headers=tok(5))
    for method, path in [("GET", "/api/organization"), ("GET", "/api/organization/members"), ("GET", "/api/organization/invites")]:
        r = client.request(method, path, headers=tok(5))
        assert r.status_code == 403 and r.json()["error"]["code"] == "onboarding_required"


# =============================================================== F17 members

def test_everyone_in_the_organisation_can_list_members_with_flags(org, client):
    org.add(2, "admin")
    org.add(3, "researcher")
    items = client.get("/api/organization/members", headers=tok(3)).json()["items"]
    assert [m["role"] for m in items] == ["owner", "admin", "researcher"]
    me = next(m for m in items if m["isYou"])
    assert me["role"] == "researcher" and me["canChangeRole"] is False


def test_owner_changes_roles_both_ways(org, client):
    org.add(2, "researcher")
    mid = org.member_id(2)
    assert client.patch(f"/api/organization/members/{mid}", json={"role": "admin"}, headers=tok(1)).json()["role"] == "admin"
    assert client.patch(f"/api/organization/members/{mid}", json={"role": "researcher"}, headers=tok(1)).json()["role"] == "researcher"


def test_admin_can_only_touch_researchers_and_cannot_promote_to_admin(org, client):
    org.add(2, "admin")
    org.add(3, "researcher")
    org.add(4, "admin")
    mid3, mid4, mid1 = org.member_id(3), org.member_id(4), org.member_id(1)
    assert client.patch(f"/api/organization/members/{mid3}", json={"role": "admin"}, headers=tok(2)).status_code == 403
    assert client.patch(f"/api/organization/members/{mid4}", json={"role": "researcher"}, headers=tok(2)).status_code == 403
    assert client.patch(f"/api/organization/members/{mid1}", json={"role": "researcher"}, headers=tok(2)).status_code == 403
    assert client.patch(f"/api/organization/members/{mid3}", json={"role": "researcher"}, headers=tok(2)).status_code == 200  # no-op but allowed


def test_nobody_can_change_the_owner_or_make_an_owner(org, client, auth_db):
    org.add(2, "admin")
    org.add(3, "researcher")
    mid1, mid3 = org.member_id(1), org.member_id(3)
    for actor in (1, 2, 3):
        assert client.patch(f"/api/organization/members/{mid1}", json={"role": "admin"}, headers=tok(actor)).status_code == 403
    assert client.patch(f"/api/organization/members/{mid3}", json={"role": "owner"}, headers=tok(1)).status_code == 422
    assert scalar(auth_db, "select count(*) from organization_members where role='owner'") == 1


def test_no_self_promotion_and_no_self_role_change(org, client):
    org.add(2, "admin")
    org.add(3, "researcher")
    assert client.patch(f"/api/organization/members/{org.member_id(3)}", json={"role": "admin"}, headers=tok(3)).status_code == 403
    assert client.patch(f"/api/organization/members/{org.member_id(2)}", json={"role": "researcher"}, headers=tok(2)).status_code == 403
    assert client.patch(f"/api/organization/members/{org.member_id(1)}", json={"role": "admin"}, headers=tok(1)).status_code == 403


def test_researcher_cannot_change_or_remove_anyone(org, client):
    org.add(2, "researcher")
    org.add(3, "researcher")
    mid3 = org.member_id(3)
    assert client.patch(f"/api/organization/members/{mid3}", json={"role": "admin"}, headers=tok(2)).status_code == 403
    assert client.delete(f"/api/organization/members/{mid3}", headers=tok(2)).status_code == 403


def test_guessed_and_foreign_member_ids_are_404_never_403(org, client, auth_db):
    other = Org(client, auth_db, owner=9, name="Other")
    other.add(10, "researcher")
    foreign = other.member_id(10)
    for method, kwargs in (("PATCH", {"json": {"role": "admin"}}), ("DELETE", {})):
        assert client.request(method, f"/api/organization/members/{foreign}", headers=tok(1), **kwargs).status_code == 404
        assert client.request(method, f"/api/organization/members/{uuid.uuid4()}", headers=tok(1), **kwargs).status_code == 404
        assert client.request(method, "/api/organization/members/not-a-uuid", headers=tok(1), **kwargs).status_code == 422
    assert scalar(auth_db, "select count(*) from organization_members") == 3  # nothing changed in either organisation


def test_owner_removes_admins_and_researchers_admin_removes_researchers_only(org, client):
    org.add(2, "admin")
    org.add(3, "researcher")
    org.add(4, "researcher")
    org.add(5, "admin")
    assert client.delete(f"/api/organization/members/{org.member_id(5)}", headers=tok(2)).status_code == 403   # admin vs admin
    assert client.delete(f"/api/organization/members/{org.member_id(1)}", headers=tok(2)).status_code == 403   # admin vs owner
    assert client.delete(f"/api/organization/members/{org.member_id(3)}", headers=tok(2)).status_code == 204   # admin vs researcher
    assert client.delete(f"/api/organization/members/{org.member_id(5)}", headers=tok(1)).status_code == 204   # owner vs admin
    assert client.delete(f"/api/organization/members/{org.member_id(4)}", headers=tok(1)).status_code == 204


def test_the_owner_can_never_be_removed_or_leave(org, client, auth_db):
    org.add(2, "admin")
    mid1 = org.member_id(1)
    assert client.delete(f"/api/organization/members/{mid1}", headers=tok(1)).status_code == 403
    assert client.delete(f"/api/organization/members/{mid1}", headers=tok(2)).status_code == 403
    assert scalar(auth_db, "select count(*) from organization_members where role='owner'") == 1


def test_a_non_owner_can_leave_and_then_needs_onboarding(org, client):
    org.add(2, "researcher")
    assert client.delete(f"/api/organization/members/{org.member_id(2)}", headers=tok(2)).status_code == 204
    r = client.get("/api/organization", headers=tok(2))
    assert r.status_code == 403 and r.json()["error"]["code"] == "onboarding_required"
    assert client.get("/api/me", headers=tok(2)).json()["needsOnboarding"] is True


def test_a_removed_member_is_refused_on_their_very_next_request(org, client):
    org.add(2, "researcher")
    assert client.get("/api/organization/members", headers=tok(2)).status_code == 200
    client.delete(f"/api/organization/members/{org.member_id(2)}", headers=tok(1))
    assert client.get("/api/organization/members", headers=tok(2)).status_code == 403


def test_member_changes_and_refusals_are_audited(org, client, auth_db):
    org.add(2, "researcher")
    org.add(3, "researcher")
    mid2, mid3 = org.member_id(2), org.member_id(3)
    client.patch(f"/api/organization/members/{mid2}", json={"role": "admin"}, headers=tok(1))
    client.patch(f"/api/organization/members/{mid3}", json={"role": "admin"}, headers=tok(2))     # refused
    client.delete(f"/api/organization/members/{org.member_id(3)}", headers=tok(1))
    actions = {(r["action"], r["outcome"]) for r in q(auth_db, "select action, outcome from audit_events")}
    assert ("member_role_changed", "success") in actions and ("member_role_change_refused", "refused") in actions
    assert ("member_removed", "success") in actions


def test_concurrent_role_changes_keep_exactly_one_owner(org, client, auth_db):
    for n in range(2, 8):
        org.add(n, "researcher")
    mids = [org.member_id(n) for n in range(2, 8)]
    jobs = [(mid, role) for mid in mids for role in ("admin", "researcher", "admin")]

    def go(job):
        return client.patch(f"/api/organization/members/{job[0]}", json={"role": job[1]}, headers=tok(1)).status_code

    with ThreadPoolExecutor(max_workers=8) as pool:
        assert set(pool.map(go, jobs)) == {200}
    assert scalar(auth_db, "select count(*) from organization_members where role='owner'") == 1


def test_an_admin_can_never_remove_someone_who_was_an_admin_even_when_roles_change_at_the_same_moment(org, client, auth_db):
    """The route's check and the change used to be separate steps: the owner promoting a researcher while an admin
    removed that 'researcher' could end with an admin removing an admin. The check now repeats under the row lock."""
    org.add(2, "admin")
    for round_no in range(12):
        n = 10 + round_no
        org.add(n, "researcher")
        mid = org.member_id(n)
        with ThreadPoolExecutor(max_workers=2) as pool:
            a = pool.submit(lambda: client.patch(f"/api/organization/members/{mid}", json={"role": "admin"}, headers=tok(1)).status_code)
            b = pool.submit(lambda: client.delete(f"/api/organization/members/{mid}", headers=tok(2)).status_code)
            a.result(), b.result()
    bad = q(auth_db, """select details from audit_events where action='member_removed'
                        and actor_user_id=(select id from users where auth_subject=:s) and details->>'role' = 'admin'""",
            s=person(2)[0])
    assert bad == [], "an administrator removed an administrator"
    assert scalar(auth_db, "select count(*) from organization_members where role='owner'") == 1


def test_a_demoted_or_removed_actor_is_refused_by_the_locked_recheck(org, client, auth_db):
    """The repository must refuse even when the route's check passed on an old role."""
    from app.core.errors import AppError
    from app.repositories import organization_repository as repo

    org.add(2, "admin")
    org.add(3, "researcher")
    mid3 = uuid.UUID(org.member_id(3))
    actor = scalar(auth_db, "select id from users where auth_subject=:s", s=person(2)[0])
    with auth_db() as db:  # the admin was demoted after the route looked
        db.execute(text("update organization_members set role='researcher' where user_id=:u"), {"u": actor})
        db.commit()
    with auth_db() as db, pytest.raises(AppError) as info:
        repo.remove_member(db, uuid.UUID(org.id), mid3, actor)
    assert info.value.http_status == 403
    with auth_db() as db:  # and a removed actor
        db.execute(text("delete from organization_members where user_id=:u"), {"u": actor})
        db.commit()
    with auth_db() as db, pytest.raises(AppError) as info:
        repo.change_member_role(db, uuid.UUID(org.id), mid3, "admin", actor)
    assert info.value.http_status == 403
    assert q(auth_db, "select reason_code from audit_events where reason_code in ('role','no_longer_member')")


# =============================================================== F18 invitations

def invite(client, n, email, role="researcher"):
    return client.post("/api/organization/invites", json={"email": email, "role": role}, headers=tok(n))


def raw_token(r) -> str:
    return r.json()["acceptUrl"].split("#token=")[1]


def test_owner_invites_and_gets_a_one_time_link_that_is_not_emailed(org, client, auth_db):
    r = invite(client, 1, "New.Person@Example.com", "admin")
    assert r.status_code == 201
    body = r.json()
    assert body["delivery"] == "not_sent"
    assert body["invite"]["email"] == "new.person@example.com" and body["invite"]["state"] == "open"
    assert "/accept-invite#token=" in body["acceptUrl"]  # token is in the fragment, never the query


def test_only_the_hash_is_stored_never_the_token_or_the_address_in_the_audit(org, client, auth_db):
    r = invite(client, 1, "secret.person@example.com")
    t = raw_token(r)
    stored = q(auth_db, "select token_hash from organization_invites")[0]["token_hash"]
    assert stored != t and t not in stored and len(stored) == 64
    audit = str(q(auth_db, "select details, entity_id from audit_events where action='invite_created'"))
    assert t not in audit and "secret.person" not in audit


def test_admin_may_invite_researchers_only_and_researchers_nobody(org, client):
    org.add(2, "admin")
    org.add(3, "researcher")
    assert invite(client, 2, "a@example.com", "researcher").status_code == 201
    assert invite(client, 2, "b@example.com", "admin").status_code == 403
    assert invite(client, 3, "c@example.com", "researcher").status_code == 403


@pytest.mark.parametrize("body", [{"email": "nope", "role": "admin"}, {"email": "a@b", "role": "admin"}, {"email": "a@example.com", "role": "owner"},
                                  {"email": "a@example.com", "role": "root"}, {"email": "a@example.com"}, {"role": "admin"},
                                  {"email": "a@example.com", "role": "admin", "token": "x"}, {"email": ("x" * 250) + "@example.com", "role": "admin"}])
def test_invite_validation(org, client, body):
    assert client.post("/api/organization/invites", json=body, headers=tok(1)).status_code == 422


def test_second_open_invite_for_the_same_address_is_409_until_revoked(org, client):
    first = invite(client, 1, "dup@example.com")
    assert invite(client, 1, "DUP@example.com").status_code == 409
    client.delete(f"/api/organization/invites/{first.json()['invite']['id']}", headers=tok(1))
    assert invite(client, 1, "dup@example.com").status_code == 201


def test_an_expired_open_invite_does_not_block_a_new_one(org, client, auth_db):
    invite(client, 1, "late@example.com")
    with auth_db() as db:
        db.execute(text("update organization_invites set expires_at = now() - interval '1 day'"))
        db.commit()
    assert invite(client, 1, "late@example.com").status_code == 201
    states = {i["state"] for i in client.get("/api/organization/invites", headers=tok(1)).json()["items"]}
    assert states == {"open", "revoked"}


def test_inviting_an_existing_member_is_409(org, client):
    org.add(2, "researcher")
    assert invite(client, 1, person(2)[1]).status_code == 409


def test_invite_list_is_for_owner_and_admin_only_and_scoped_to_the_organisation(org, client, auth_db):
    org.add(2, "admin")
    org.add(3, "researcher")
    other = Org(client, auth_db, owner=9, name="Other")
    invite(client, 1, "mine@example.com")
    invite(client, 9, "theirs@example.com")
    mine = client.get("/api/organization/invites", headers=tok(2)).json()["items"]
    assert [i["email"] for i in mine] == ["mine@example.com"]
    assert client.get("/api/organization/invites", headers=tok(3)).status_code == 403
    assert other.id != org.id


def test_revoke_rules(org, client, auth_db):
    org.add(2, "admin")
    other = Org(client, auth_db, owner=9, name="Other")
    a = invite(client, 1, "a@example.com", "admin").json()["invite"]["id"]
    r = invite(client, 1, "r@example.com", "researcher").json()["invite"]["id"]
    foreign = invite(client, 9, "f@example.com").json()["invite"]["id"]
    assert client.delete(f"/api/organization/invites/{a}", headers=tok(2)).status_code == 403          # admin vs admin invite
    assert client.delete(f"/api/organization/invites/{r}", headers=tok(2)).status_code == 200          # admin vs researcher invite
    assert client.delete(f"/api/organization/invites/{r}", headers=tok(1)).status_code == 409          # already revoked
    assert client.delete(f"/api/organization/invites/{foreign}", headers=tok(1)).status_code == 404   # another organisation
    assert client.delete(f"/api/organization/invites/{uuid.uuid4()}", headers=tok(1)).status_code == 404
    assert client.delete("/api/organization/invites/nope", headers=tok(1)).status_code == 422
    assert other.id != org.id


def test_acceptance_gives_membership_with_the_invited_role(org, client, auth_db):
    t = raw_token(invite(client, 1, person(7)[1], "admin"))
    r = client.post("/api/invites/accept", json={"token": t}, headers=tok(7))
    assert r.status_code == 200
    assert r.json()["role"] == "admin" and r.json()["organization"]["name"] == "Acme Roads" and r.json()["needsOnboarding"] is False
    assert client.get("/api/organization/members", headers=tok(7)).status_code == 200
    states = client.get("/api/organization/invites", headers=tok(1)).json()["items"]
    assert states[0]["state"] == "accepted"
    assert q(auth_db, "select action from audit_events where action='invite_accepted'")


def test_acceptance_matches_the_address_ignoring_case(org, client):
    t = raw_token(invite(client, 1, "mixed@example.com"))
    assert client.post("/api/invites/accept", json={"token": t}, headers=tok(7, "MiXeD@Example.com")).status_code == 200


def test_wrong_account_cannot_accept_and_the_invite_stays_usable(org, client, auth_db):
    t = raw_token(invite(client, 1, "right@example.com"))
    r = client.post("/api/invites/accept", json={"token": t}, headers=tok(7, "wrong@example.com"))
    assert r.status_code == 403 and r.json()["error"]["code"] == "invite_wrong_account"
    assert client.get("/api/me", headers=tok(7, "wrong@example.com")).json()["needsOnboarding"] is True
    assert q(auth_db, "select outcome from audit_events where action='invite_accept_refused'")[0]["outcome"] == "refused"
    assert client.post("/api/invites/accept", json={"token": t}, headers=tok(8, "right@example.com")).status_code == 200


def test_a_used_token_cannot_be_replayed(org, client):
    t = raw_token(invite(client, 1, person(7)[1]))
    assert client.post("/api/invites/accept", json={"token": t}, headers=tok(7)).status_code == 200
    r = client.post("/api/invites/accept", json={"token": t}, headers=tok(7))
    assert r.status_code == 400 and r.json()["error"]["code"] == "invite_invalid"


@pytest.mark.parametrize("how", ["revoked", "expired", "unknown", "garbage"])
def test_dead_tokens_all_get_the_same_answer(org, client, auth_db, how):
    r = invite(client, 1, person(7)[1])
    t = raw_token(r)
    if how == "revoked":
        client.delete(f"/api/organization/invites/{r.json()['invite']['id']}", headers=tok(1))
    elif how == "expired":
        with auth_db() as db:
            db.execute(text("update organization_invites set expires_at = now() - interval '1 second'"))
            db.commit()
    elif how == "unknown":
        t = "x" * 43
    else:
        t = "not-a-real-token-at-all-1234"
    out = client.post("/api/invites/accept", json={"token": t}, headers=tok(7))
    assert out.status_code == 400 and out.json()["error"]["code"] == "invite_invalid"
    assert client.get("/api/me", headers=tok(7)).json()["needsOnboarding"] is True


def test_someone_who_already_belongs_somewhere_gets_409(org, client, auth_db):
    Org(client, auth_db, owner=9, name="Other")
    t = raw_token(invite(client, 1, person(9)[1]))
    r = client.post("/api/invites/accept", json={"token": t}, headers=tok(9))
    assert r.status_code == 409 and r.json()["error"]["code"] == "already_member"
    assert scalar(auth_db, "select count(*) from organization_members where user_id=(select id from users where auth_subject=:s)", s=person(9)[0]) == 1


def test_accept_needs_sign_in_and_a_well_formed_body(org, client):
    assert client.post("/api/invites/accept", json={"token": "x" * 30}).status_code == 401
    assert client.post("/api/invites/accept", json={"token": "short"}, headers=tok(7)).status_code == 422
    assert client.post("/api/invites/accept", json={"token": "x" * 30, "role": "owner"}, headers=tok(7)).status_code == 422


def test_simultaneous_acceptance_of_one_invitation_succeeds_once(org, client, auth_db):
    t = raw_token(invite(client, 1, person(7)[1]))
    headers = tok(7)
    with ThreadPoolExecutor(max_workers=8) as pool:
        codes = sorted(pool.map(lambda _: client.post("/api/invites/accept", json={"token": t}, headers=headers).status_code, range(8)))
    assert codes.count(200) == 1 and set(codes) <= {200, 400, 409}, codes
    assert scalar(auth_db, "select count(*) from organization_members") == 2


def test_a_second_account_with_a_different_address_cannot_use_a_used_invitation(org, client, auth_db):
    t = raw_token(invite(client, 1, person(7)[1]))
    assert client.post("/api/invites/accept", json={"token": t}, headers=tok(7)).status_code == 200
    other = client.post("/api/invites/accept", json={"token": t}, headers=tok(8))
    assert other.status_code == 400 and other.json()["error"]["code"] == "invite_invalid"
    assert scalar(auth_db, "select count(*) from organization_members") == 2


def test_two_accounts_racing_for_one_invitation_only_the_invited_address_can_win(org, client, auth_db):
    t = raw_token(invite(client, 1, person(7)[1]))
    jobs = [7, 8, 8, 9, 7, 8, 9, 7]

    def go(n):
        return n, client.post("/api/invites/accept", json={"token": t}, headers=tok(n)).status_code

    with ThreadPoolExecutor(max_workers=8) as pool:
        results = list(pool.map(go, jobs))
    assert sum(1 for n, c in results if c == 200) == 1 and all(n == 7 for n, c in results if c == 200)
    assert scalar(auth_db, "select count(*) from organization_members") == 2
