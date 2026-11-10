"""Organisation, members and invitations in backend PostgreSQL (F15 to F18). Every query is scoped to one
organisation id taken from the caller's membership, never from the request.

Authorisation is checked TWICE for changes: once in the route (fast answer) and again here, inside the transaction,
after the rows involved are locked. The second check is the one that counts: between the route's check and the
change, someone else may have changed the caller's or the target's role, and the check must see the current roles.
"""
from __future__ import annotations

import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.auth import permissions
from app.core.errors import AppError
from app.repositories import audit_repository

INVITE_LIFETIME = timedelta(days=7)  # open item O69: default 7 days
INVITE_LIST_LIMIT = 100


def _refuse(db: Session, *, org_id: Any, actor_id: Any, action: str, reason: str, entity_type: str | None = None,
            entity_id: Any = None, status: int = 403, code: str = "forbidden",
            message: str = "You are not allowed to do this.") -> AppError:
    """Undo the open transaction, write the refusal to the audit log, and return the error to raise (AC-14)."""
    db.rollback()
    audit_repository.record_refusal(db, action=action, organization_id=org_id, actor_user_id=actor_id,
                                    entity_type=entity_type, entity_id=entity_id, reason_code=reason)
    return AppError(code, status, message)


# --- organisation -----------------------------------------------------------------

def get_organization(db: Session, org_id: Any) -> dict[str, Any]:
    row = db.execute(
        text("SELECT id, name, slug, plan, created_at FROM organizations WHERE id = :id"), {"id": org_id}
    ).mappings().first()
    if row is None:
        raise AppError("not_found", 404, "That organisation was not found.")
    return dict(row)


def rename_organization(db: Session, org_id: Any, name: str, actor_id: Any) -> dict[str, Any]:
    actor = db.execute(
        text("SELECT role FROM organization_members WHERE organization_id = :o AND user_id = :u FOR SHARE"),
        {"o": org_id, "u": actor_id},
    ).scalar()
    if actor is None or not permissions.can_edit_organization(actor):
        raise _refuse(db, org_id=org_id, actor_id=actor_id, action="organization_rename_refused", reason="role",
                      entity_type="organization", entity_id=org_id)
    old = get_organization(db, org_id)["name"]
    db.execute(text("UPDATE organizations SET name = :name, updated_at = now() WHERE id = :id"), {"name": name, "id": org_id})
    audit_repository.record(db, action="organization_renamed", organization_id=org_id, actor_user_id=actor_id,
                            entity_type="organization", entity_id=org_id, details={"old": old, "new": name})
    db.commit()
    return get_organization(db, org_id)


def usage(db: Session, org_id: Any) -> dict[str, Any]:
    """Real counts from the stored records. Nothing is estimated and no plan limit is invented."""
    one = lambda sql: db.execute(text(sql), {"o": org_id}).scalar_one()  # noqa: E731
    return {
        "members": one("SELECT count(*) FROM organization_members WHERE organization_id = :o"),
        "projects": one("SELECT count(*) FROM projects WHERE organization_id = :o AND archived_at IS NULL"),
        "uploads": one("SELECT count(*) FROM uploads WHERE organization_id = :o AND source_deleted_at IS NULL"),
        "storageBytes": one("SELECT coalesce(sum(size_bytes), 0) FROM uploads WHERE organization_id = :o AND source_deleted_at IS NULL"),
        "jobsTotal": one("SELECT count(*) FROM jobs WHERE organization_id = :o"),
        "jobsRunning": one("SELECT count(*) FROM jobs WHERE organization_id = :o AND status IN ('queued','running')"),
        "reports": one("SELECT count(*) FROM reports WHERE organization_id = :o"),
    }


# --- members ----------------------------------------------------------------------

_MEMBER_SELECT = """SELECT m.id, m.user_id, m.role, m.status, m.created_at AS joined_at, u.email, u.full_name, u.avatar_url
                    FROM organization_members m JOIN users u ON u.id = m.user_id"""


def list_members(db: Session, org_id: Any) -> list[dict[str, Any]]:
    rows = db.execute(
        text(f"{_MEMBER_SELECT} WHERE m.organization_id = :o ORDER BY (m.role = 'owner') DESC, m.created_at"), {"o": org_id}
    ).mappings().all()
    return [dict(r) for r in rows]


def get_member(db: Session, org_id: Any, member_id: UUID) -> dict[str, Any]:
    """A member of THIS organisation. A guessed id from another organisation answers 404, never 403."""
    row = db.execute(text(f"{_MEMBER_SELECT} WHERE m.id = :id AND m.organization_id = :o"), {"id": member_id, "o": org_id}).mappings().first()
    if row is None:
        raise AppError("not_found", 404, "That member was not found.")
    return dict(row)


def _lock_actor_and_target(db: Session, org_id: Any, actor_id: Any, member_id: UUID, action: str) -> tuple[dict, dict]:
    """Lock the caller's membership row and the target's (always in id order, so two requests cannot deadlock) and
    return both as they are NOW."""
    rows = db.execute(
        text("""SELECT id, user_id, role FROM organization_members
                WHERE organization_id = :o AND (id = :t OR user_id = :a) ORDER BY id FOR UPDATE"""),
        {"o": org_id, "t": member_id, "a": actor_id},
    ).mappings().all()
    actor = next((dict(r) for r in rows if str(r["user_id"]) == str(actor_id)), None)
    target = next((dict(r) for r in rows if str(r["id"]) == str(member_id)), None)
    if actor is None:  # removed from the organisation between the route's check and now
        raise _refuse(db, org_id=org_id, actor_id=actor_id, action=action, reason="no_longer_member",
                      entity_type="member", entity_id=member_id)
    if target is None:
        raise _refuse(db, org_id=org_id, actor_id=actor_id, action=action, reason="not_found",
                      entity_type="member", entity_id=member_id, status=404, code="not_found",
                      message="That member was not found.")
    return actor, target


def change_member_role(db: Session, org_id: Any, member_id: UUID, new_role: str, actor_id: Any) -> dict[str, Any]:
    actor, target = _lock_actor_and_target(db, org_id, actor_id, member_id, "member_role_change_refused")
    if str(target["user_id"]) == str(actor_id):
        raise _refuse(db, org_id=org_id, actor_id=actor_id, action="member_role_change_refused", reason="self",
                      entity_type="member", entity_id=member_id)
    if not permissions.can_manage_member(actor["role"], target["role"]) or not permissions.can_invite_as(actor["role"], new_role):
        raise _refuse(db, org_id=org_id, actor_id=actor_id, action="member_role_change_refused", reason="role",
                      entity_type="member", entity_id=member_id)
    if target["role"] != new_role:  # a change to the same role writes nothing and is not logged as a change
        db.execute(text("UPDATE organization_members SET role = :r, updated_at = now() WHERE id = :id"), {"r": new_role, "id": member_id})
        audit_repository.record(db, action="member_role_changed", organization_id=org_id, actor_user_id=actor_id,
                                entity_type="member", entity_id=member_id,
                                details={"userId": str(target["user_id"]), "old": target["role"], "new": new_role})
    db.commit()
    return get_member(db, org_id, member_id)


def remove_member(db: Session, org_id: Any, member_id: UUID, actor_id: Any) -> None:
    actor, target = _lock_actor_and_target(db, org_id, actor_id, member_id, "member_remove_refused")
    is_self = str(target["user_id"]) == str(actor_id)
    if not (permissions.can_manage_member(actor["role"], target["role"]) or (is_self and target["role"] != "owner")):
        raise _refuse(db, org_id=org_id, actor_id=actor_id, action="member_remove_refused",
                      reason="owner" if target["role"] == "owner" else "role", entity_type="member", entity_id=member_id)
    db.execute(text("DELETE FROM organization_members WHERE id = :id"), {"id": member_id})
    # Whoever leaves or is removed no longer has the authority their open invitations were created with.
    cancelled = db.execute(
        text("""UPDATE organization_invites SET revoked_at = now(), updated_at = now()
                WHERE organization_id = :o AND invited_by = :u AND accepted_at IS NULL AND revoked_at IS NULL"""),
        {"o": org_id, "u": target["user_id"]},
    ).rowcount
    audit_repository.record(db, action="member_removed", organization_id=org_id, actor_user_id=actor_id,
                            entity_type="member", entity_id=member_id,
                            details={"userId": str(target["user_id"]), "role": target["role"], "invitesRevoked": cancelled})
    db.commit()


# --- invitations ------------------------------------------------------------------

def _hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


_INVITE_SELECT = """SELECT i.id, i.email, i.role, i.expires_at, i.accepted_at, i.revoked_at, i.created_at,
                           u.full_name AS invited_by_name, u.email AS invited_by_email
                    FROM organization_invites i JOIN users u ON u.id = i.invited_by"""


def _invite_state(row: dict[str, Any]) -> str:
    if row["accepted_at"] is not None:
        return "accepted"
    if row["revoked_at"] is not None:
        return "revoked"
    if row["expires_at"] <= datetime.now(timezone.utc):
        return "expired"
    return "open"


def invite_view(row: dict[str, Any]) -> dict[str, Any]:
    return {**row, "state": _invite_state(row)}


def _actor_role_locked(db: Session, org_id: Any, actor_id: Any) -> str | None:
    return db.execute(
        text("SELECT role FROM organization_members WHERE organization_id = :o AND user_id = :u FOR SHARE"),
        {"o": org_id, "u": actor_id},
    ).scalar()


def create_invite(db: Session, org_id: Any, email: str, role: str, actor_id: Any) -> tuple[dict[str, Any], str]:
    """Create an invitation and return (invite, token). The token is shown once and only its hash is stored."""
    actor_role = _actor_role_locked(db, org_id, actor_id)
    if actor_role is None or not permissions.can_invite_as(actor_role, role):
        raise _refuse(db, org_id=org_id, actor_id=actor_id, action="invite_refused", reason="role", entity_type="invite")
    # An invitation that ran out of time still blocks a new one for the same address (the index cannot test the
    # clock), so mark it revoked first (open item O74), and say so in the audit log.
    swept = db.execute(
        text("""UPDATE organization_invites SET revoked_at = now(), updated_at = now()
                WHERE organization_id = :o AND lower(email) = lower(:e) AND accepted_at IS NULL AND revoked_at IS NULL
                  AND expires_at <= now() RETURNING id"""),
        {"o": org_id, "e": email},
    ).scalars().all()
    for invite_id in swept:
        audit_repository.record(db, action="invite_expired_revoked", organization_id=org_id, actor_user_id=actor_id,
                                entity_type="invite", entity_id=invite_id)
    already = db.execute(
        text("""SELECT 1 FROM organization_members m JOIN users u ON u.id = m.user_id
                WHERE m.organization_id = :o AND lower(u.email) = lower(:e)"""),
        {"o": org_id, "e": email},
    ).first()
    if already:
        raise _refuse(db, org_id=org_id, actor_id=actor_id, action="invite_refused", reason="already_member",
                      entity_type="invite", status=409, code="already_member",
                      message="That person is already a member of this organisation.")
    token = secrets.token_urlsafe(32)
    try:
        invite_id = db.execute(
            text("""INSERT INTO organization_invites (organization_id, email, role, token_hash, invited_by, expires_at)
                    VALUES (:o, :e, :r, :h, :by, :exp) RETURNING id"""),
            {"o": org_id, "e": email, "r": role, "h": _hash(token), "by": actor_id,
             "exp": datetime.now(timezone.utc) + INVITE_LIFETIME},
        ).scalar_one()
    except IntegrityError as exc:
        if "organization_invites_open_uq" not in str(exc.orig):
            db.rollback()
            raise
        raise _refuse(db, org_id=org_id, actor_id=actor_id, action="invite_refused", reason="already_open",
                      entity_type="invite", status=409, code="invite_already_open",
                      message="There is already an open invitation for that address. Revoke it first to send a new one.") from None
    audit_repository.record(db, action="invite_created", organization_id=org_id, actor_user_id=actor_id,
                            entity_type="invite", entity_id=invite_id, details={"role": role})  # no address, no token
    db.commit()
    return get_invite(db, org_id, invite_id), token


def get_invite(db: Session, org_id: Any, invite_id: UUID) -> dict[str, Any]:
    row = db.execute(text(f"{_INVITE_SELECT} WHERE i.id = :id AND i.organization_id = :o"), {"id": invite_id, "o": org_id}).mappings().first()
    if row is None:
        raise AppError("not_found", 404, "That invitation was not found.")
    return invite_view(dict(row))


def list_invites(db: Session, org_id: Any) -> tuple[list[dict[str, Any]], bool]:
    """(invitations, truncated). The list is capped; `truncated` says there were more."""
    rows = db.execute(
        text(f"{_INVITE_SELECT} WHERE i.organization_id = :o ORDER BY i.created_at DESC LIMIT :n"),
        {"o": org_id, "n": INVITE_LIST_LIMIT + 1},
    ).mappings().all()
    return [invite_view(dict(r)) for r in rows[:INVITE_LIST_LIMIT]], len(rows) > INVITE_LIST_LIMIT


def revoke_invite(db: Session, org_id: Any, invite_id: UUID, actor_id: Any) -> dict[str, Any]:
    actor_role = _actor_role_locked(db, org_id, actor_id)
    row = db.execute(
        text("SELECT role, accepted_at, revoked_at, expires_at FROM organization_invites WHERE id = :id AND organization_id = :o FOR UPDATE"),
        {"id": invite_id, "o": org_id},
    ).mappings().first()
    if row is None:
        raise _refuse(db, org_id=org_id, actor_id=actor_id, action="invite_revoke_refused", reason="not_found",
                      entity_type="invite", entity_id=invite_id, status=404, code="not_found", message="That invitation was not found.")
    if actor_role is None or not permissions.can_invite_as(actor_role, row["role"]):
        raise _refuse(db, org_id=org_id, actor_id=actor_id, action="invite_revoke_refused", reason="role",
                      entity_type="invite", entity_id=invite_id)
    state = _invite_state(dict(row))
    if state not in ("open", "expired"):
        raise _refuse(db, org_id=org_id, actor_id=actor_id, action="invite_revoke_refused", reason=state,
                      entity_type="invite", entity_id=invite_id, status=409, code="invite_not_open",
                      message=f"That invitation is already {state}.")
    db.execute(text("UPDATE organization_invites SET revoked_at = now(), updated_at = now() WHERE id = :id"), {"id": invite_id})
    audit_repository.record(db, action="invite_revoked", organization_id=org_id, actor_user_id=actor_id,
                            entity_type="invite", entity_id=invite_id)
    db.commit()
    return get_invite(db, org_id, invite_id)


def invite_is_open_for(db: Session, token: str, user_email: str) -> bool:
    """Read-only look: is there an open invitation behind this token for this address? Used to decide whether it is
    worth asking Supabase anything. accept_invite re-checks everything under a row lock, so this is only a filter."""
    row = db.execute(
        text("SELECT email, expires_at, accepted_at, revoked_at FROM organization_invites WHERE token_hash = :h"),
        {"h": _hash(token)},
    ).mappings().first()
    db.rollback()  # nothing was written; end the read transaction
    return bool(row) and _invite_state(dict(row)) == "open" and row["email"].strip().lower() == user_email.strip().lower()


def accept_invite(db: Session, token: str, user_id: Any, user_email: str, *, email_confirmed: bool | None = None) -> dict[str, Any]:
    """Join the organisation an invitation names. One transaction; the invitation row is locked so a replayed or
    simultaneous acceptance cannot succeed twice. `email_confirmed` is Supabase's answer to "was this address
    really confirmed?" (None = could not be checked)."""
    row = db.execute(
        text("""SELECT id, organization_id, email, role, expires_at, accepted_at, revoked_at
                FROM organization_invites WHERE token_hash = :h FOR UPDATE"""),
        {"h": _hash(token)},
    ).mappings().first()
    invalid = dict(status=400, code="invite_invalid", message="This invitation is not valid, has expired, or was already used.")
    if row is None:
        # Nobody to attribute it to but the caller; a pattern of these is what guessing looks like.
        raise _refuse(db, org_id=None, actor_id=user_id, action="invite_accept_refused", reason="unknown_token", **invalid)
    invite = dict(row)
    org_id = invite["organization_id"]
    if _invite_state(invite) != "open":
        raise _refuse(db, org_id=org_id, actor_id=user_id, action="invite_accept_refused", reason=_invite_state(invite),
                      entity_type="invite", entity_id=invite["id"], **invalid)
    if invite["email"].strip().lower() != user_email.strip().lower():
        raise _refuse(db, org_id=org_id, actor_id=user_id, action="invite_accept_refused", reason="wrong_email",
                      entity_type="invite", entity_id=invite["id"], code="invite_wrong_account",
                      message="This invitation was sent to a different email address. Sign in with the address it was sent to.")
    # Fail closed: the invitation is only as safe as "this address was really confirmed". Anything other than a clear
    # yes from Supabase (a no, or no way to ask) refuses, and leaves the invitation usable.
    if email_confirmed is False:
        raise _refuse(db, org_id=org_id, actor_id=user_id, action="invite_accept_refused", reason="email_not_confirmed",
                      entity_type="invite", entity_id=invite["id"], code="email_not_confirmed",
                      message="Confirm your email address first (open the link in the email we sent you), then accept the invitation.")
    if email_confirmed is not True:
        raise _refuse(db, org_id=org_id, actor_id=user_id, action="invite_accept_refused", reason="confirmation_unavailable",
                      entity_type="invite", entity_id=invite["id"], status=503, code="confirmation_unavailable",
                      message="Invitations cannot be accepted right now because the server cannot confirm email addresses. "
                              "Ask your administrator to finish the sign-in setup.")
    try:
        db.execute(
            text("INSERT INTO organization_members (organization_id, user_id, role) VALUES (:o, :u, :r)"),
            {"o": org_id, "u": user_id, "r": invite["role"]},
        )
    except IntegrityError as exc:
        # Either rule means "this person is already a member": one organisation per person, or already in this one.
        if not any(name in str(exc.orig) for name in ("organization_members_user_id_key", "organization_members_organization_id_user_id_key")):
            db.rollback()
            raise
        raise _refuse(db, org_id=org_id, actor_id=user_id, action="invite_accept_refused", reason="already_member",
                      entity_type="invite", entity_id=invite["id"], status=409, code="already_member",
                      message="You already belong to an organisation.") from None
    db.execute(text("UPDATE organization_invites SET accepted_at = now(), updated_at = now() WHERE id = :id"), {"id": invite["id"]})
    audit_repository.record(db, action="invite_accepted", organization_id=org_id, actor_user_id=user_id,
                            entity_type="invite", entity_id=invite["id"], details={"role": invite["role"]})
    db.commit()
    return {"organizationId": org_id, "role": invite["role"]}
