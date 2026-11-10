"""Who may do what inside an organisation (F17; REQUIREMENTS AC-1 to AC-17; open items O15, O67).

Roles live only in backend PostgreSQL (organization_members.role). Hiding a button in the browser is never
the control: every route below checks the caller's role on the server.

Rules (defaults, not yet confirmed by the client):
- owner       one per organisation. Cannot be removed or demoted: there is no ownership transfer yet, so an
              organisation can never be left without an owner.
- admin       manages researchers only (invite, remove). Cannot touch owners or other admins.
- researcher  can see the organisation and its members, nothing more here.
"""
from __future__ import annotations

ROLES = ("owner", "admin", "researcher")
ASSIGNABLE_ROLES = ("admin", "researcher")  # "owner" is never given to anyone through the API


def can_edit_organization(role: str) -> bool:
    return role in ("owner", "admin")


def can_invite_as(actor_role: str, invited_role: str) -> bool:
    """May this actor invite someone into `invited_role`?"""
    if invited_role not in ASSIGNABLE_ROLES:
        return False
    if actor_role == "owner":
        return True
    return actor_role == "admin" and invited_role == "researcher"


def can_manage_member(actor_role: str, target_role: str) -> bool:
    """May this actor change the role of, or remove, a member who currently has `target_role`?"""
    if target_role == "owner":
        return False  # never, through the API
    if actor_role == "owner":
        return True
    return actor_role == "admin" and target_role == "researcher"


def can_see_usage(role: str) -> bool:
    return role in ("owner", "admin")  # AC-9
