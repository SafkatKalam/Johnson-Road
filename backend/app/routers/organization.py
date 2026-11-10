"""Organisation, members and invitations (F15 to F18). Authorisation is decided here and again inside the
repository's locked transactions, from the caller's role in PostgreSQL (see app/auth/permissions.py).
The browser only hides buttons."""
import re
from typing import Any, Callable, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, Response
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy.orm import Session

from app.auth import permissions
from app.auth.deps import CurrentUser, Principal, current_member, current_user_only
from app.auth.email_confirmation import get_email_confirmation_check
from app.core.config import settings
from app.core.errors import AppError
from app.database.database import get_db
from app.repositories import audit_repository, organization_repository, user_repository
from app.routers.account import _account_body

router = APIRouter(tags=["organization"])           # every route needs an active membership (added in main.py)
public_router = APIRouter(tags=["organization"])    # signed in, no organisation needed (FD16)

_CONTROL_CHARS = re.compile(r"[\x00-\x1f\x7f]")
_EMAIL = re.compile(r"^[A-Za-z0-9._%+\-']+@[A-Za-z0-9\-]+(\.[A-Za-z0-9\-]+)+$")


def _forbid(db: Session, who: Principal, action: str, reason: str, entity_type: str | None = None, entity_id: Any = None) -> AppError:
    """Record the refusal in the audit log (AC-14) and return the 403 to raise."""
    audit_repository.record_refusal(db, action=action, organization_id=who.organization_id, actor_user_id=who.user["id"],
                                    entity_type=entity_type, entity_id=entity_id, reason_code=reason)
    return AppError("forbidden", 403, "You are not allowed to do this.")


def _member_or_404(db: Session, who: Principal, member_id: UUID, action: str) -> dict[str, Any]:
    """The member, or a 404 that is also written to the audit log (a guessed id from another organisation)."""
    try:
        return organization_repository.get_member(db, who.organization_id, member_id)
    except AppError as exc:
        if exc.http_status == 404:
            audit_repository.record_refusal(db, action=action, organization_id=who.organization_id,
                                            actor_user_id=who.user["id"], entity_type="member", entity_id=member_id,
                                            reason_code="not_found")
        raise


# --- views ------------------------------------------------------------------------

def _member_view(m: dict[str, Any], me: Principal) -> dict[str, Any]:
    is_me = str(m["user_id"]) == str(me.user["id"])
    return {
        "id": str(m["id"]), "userId": str(m["user_id"]), "name": m["full_name"], "email": m["email"],
        "avatarUrl": m["avatar_url"], "role": m["role"], "status": m["status"],
        "joinedAt": m["joined_at"].isoformat(), "isYou": is_me,
        # What THIS caller may do to this member: lets the screen hide buttons; the server still decides.
        # Only an owner may set the role to administrator, so only an owner is offered a role control.
        "canChangeRole": (not is_me) and permissions.can_manage_member(me.role, m["role"]) and permissions.can_invite_as(me.role, "admin"),
        "canRemove": permissions.can_manage_member(me.role, m["role"]) or (is_me and m["role"] != "owner"),
    }


def _invite_view(i: dict[str, Any], me: Principal) -> dict[str, Any]:
    return {
        "id": str(i["id"]), "email": i["email"], "role": i["role"], "state": i["state"],
        "expiresAt": i["expires_at"].isoformat(), "createdAt": i["created_at"].isoformat(),
        "invitedBy": i["invited_by_name"] or i["invited_by_email"],
        "canRevoke": i["state"] in ("open", "expired") and permissions.can_invite_as(me.role, i["role"]),
    }


# --- organisation (F16) -----------------------------------------------------------

@router.get("/organization", summary="Your organisation, plan, and real usage")
def get_organization(who: Principal = Depends(current_member), db: Session = Depends(get_db)):
    org = organization_repository.get_organization(db, who.organization_id)
    return {
        "organization": {"id": str(org["id"]), "name": org["name"], "slug": org["slug"], "plan": org["plan"],
                         "createdAt": org["created_at"].isoformat()},
        "role": who.role,
        "permissions": {
            "canEdit": permissions.can_edit_organization(who.role),
            "canInvite": who.role in ("owner", "admin"),
            "canSeeUsage": permissions.can_see_usage(who.role),
        },
        # Counted from the stored records (AC-9: owner and admin only).
        "usage": organization_repository.usage(db, who.organization_id) if permissions.can_see_usage(who.role) else None,
        # Plan limits are not decided (open item O39): shown as unset, never invented.
        "limits": None,
    }


class OrganizationUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")  # only the name can change here: not the plan, slug or owner

    name: str = Field(description="1 to 120 characters")

    @field_validator("name")
    @classmethod
    def check_name(cls, value: str) -> str:
        value = value.strip()
        if not 1 <= len(value) <= 120 or _CONTROL_CHARS.search(value):
            raise ValueError("must be 1 to 120 characters without control characters")
        return value


@router.patch("/organization", summary="Rename your organisation")
def update_organization(body: OrganizationUpdate, who: Principal = Depends(current_member), db: Session = Depends(get_db)):
    if not permissions.can_edit_organization(who.role):
        raise _forbid(db, who, "organization_rename_refused", "role", "organization", who.organization_id)
    org = organization_repository.rename_organization(db, who.organization_id, body.name, who.user["id"])
    return {"organization": {"id": str(org["id"]), "name": org["name"], "slug": org["slug"], "plan": org["plan"],
                             "createdAt": org["created_at"].isoformat()}}


# --- members (F17) ----------------------------------------------------------------

@router.get("/organization/members", summary="Members of your organisation")
def list_members(who: Principal = Depends(current_member), db: Session = Depends(get_db)):
    return {"items": [_member_view(m, who) for m in organization_repository.list_members(db, who.organization_id)],
            "nextCursor": None}


class MemberUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")  # only the role; "owner" is not a value that exists here

    role: Literal["admin", "researcher"]


@router.patch("/organization/members/{member_id}", summary="Change a member's role")
def update_member(member_id: UUID, body: MemberUpdate, who: Principal = Depends(current_member), db: Session = Depends(get_db)):
    target = _member_or_404(db, who, member_id, "member_role_change_refused")
    if str(target["user_id"]) == str(who.user["id"]):
        raise _forbid(db, who, "member_role_change_refused", "self", "member", member_id)  # no self-promotion
    if not permissions.can_manage_member(who.role, target["role"]) or not permissions.can_invite_as(who.role, body.role):
        raise _forbid(db, who, "member_role_change_refused", "role", "member", member_id)
    # The repository checks again after locking both rows: the roles may have changed since the checks above.
    updated = organization_repository.change_member_role(db, who.organization_id, member_id, body.role, who.user["id"])
    return _member_view(updated, who)


@router.delete("/organization/members/{member_id}", status_code=204, summary="Remove a member, or leave yourself")
def remove_member(member_id: UUID, who: Principal = Depends(current_member), db: Session = Depends(get_db)):
    target = _member_or_404(db, who, member_id, "member_remove_refused")
    is_self = str(target["user_id"]) == str(who.user["id"])
    if not (permissions.can_manage_member(who.role, target["role"]) or (is_self and target["role"] != "owner")):
        raise _forbid(db, who, "member_remove_refused", "owner" if target["role"] == "owner" else "role", "member", member_id)
    organization_repository.remove_member(db, who.organization_id, member_id, who.user["id"])
    return Response(status_code=204)


# --- invitations (F18) ------------------------------------------------------------

class InviteCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    email: str
    role: Literal["admin", "researcher"]

    @field_validator("email")
    @classmethod
    def check_email(cls, value: str) -> str:
        value = value.strip().lower()
        local = value.split("@")[0]
        if len(value) > 254 or not _EMAIL.match(value) or ".." in local or local.startswith(".") or local.endswith("."):
            raise ValueError("must be an email address")
        return value


@router.post("/organization/invites", status_code=201, summary="Invite someone (the link is returned once; nothing is emailed yet)")
def create_invite(body: InviteCreate, who: Principal = Depends(current_member), db: Session = Depends(get_db)):
    if not permissions.can_invite_as(who.role, body.role):
        raise _forbid(db, who, "invite_refused", "role", "invite")
    invite, token = organization_repository.create_invite(db, who.organization_id, body.email, body.role, who.user["id"])
    return {
        "invite": _invite_view(invite, who),
        # The token is in the address FRAGMENT (after #) so it is never sent to a server or written to a log.
        "acceptUrl": f"{settings.frontend_origin}/accept-invite#token={token}",
        "delivery": "not_sent",  # honest: no email has been sent (email delivery is not connected yet)
    }


@router.get("/organization/invites", summary="Invitations of your organisation")
def list_invites(who: Principal = Depends(current_member), db: Session = Depends(get_db)):
    if who.role not in ("owner", "admin"):
        raise _forbid(db, who, "invite_list_refused", "role", "invite")
    items, truncated = organization_repository.list_invites(db, who.organization_id)
    return {"items": [_invite_view(i, who) for i in items], "nextCursor": None, "truncated": truncated}


@router.delete("/organization/invites/{invite_id}", summary="Revoke an invitation")
def revoke_invite(invite_id: UUID, who: Principal = Depends(current_member), db: Session = Depends(get_db)):
    if who.role not in ("owner", "admin"):  # checked before any lookup, so a researcher learns nothing about ids
        raise _forbid(db, who, "invite_revoke_refused", "role", "invite", invite_id)
    revoked = organization_repository.revoke_invite(db, who.organization_id, invite_id, who.user["id"])
    return {"invite": _invite_view(revoked, who)}


class InviteAccept(BaseModel):
    model_config = ConfigDict(extra="forbid")

    token: str = Field(min_length=20, max_length=200)


@public_router.post("/invites/accept", summary="Join the organisation an invitation names")
def accept_invite(
    body: InviteAccept,
    current: CurrentUser = Depends(current_user_only),
    db: Session = Depends(get_db),
    confirmed_check: Callable[[str, str], bool | None] = Depends(get_email_confirmation_check),
):
    # Ask Supabase (server to server) whether this address was really confirmed: the invitation is only as safe as
    # that. Only worth asking when a real, open invitation for THIS address exists, so junk tokens, used links and
    # other people's links cost no outside call (and no waiting thread).
    confirmed = None
    if organization_repository.invite_is_open_for(db, body.token, current.user["email"]):
        confirmed = confirmed_check(current.identity.subject, current.user["email"])
    organization_repository.accept_invite(db, body.token, current.user["id"], current.user["email"], email_confirmed=confirmed)
    return _account_body(current.user, user_repository.get_membership(db, current.user["id"]))
