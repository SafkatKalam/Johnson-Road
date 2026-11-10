"""FastAPI dependencies that decide who the caller is (F07; FD16).

current_identity   a valid Supabase token (nothing else is checked)
current_user_only  FD16: a valid token and a backend user row; no organisation needed
                   (account, onboarding and invite-accept routes use this)
current_member     FD16: current_user_only plus an active organisation membership; every other route uses this

The caller can never name their own role or organisation: both come from backend PostgreSQL.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.auth.tokens import Identity, get_verifier
from app.core.errors import AppError
from app.database.database import get_db
from app.repositories import audit_repository, user_repository

_bearer = HTTPBearer(auto_error=False)


@dataclass(frozen=True)
class CurrentUser:
    user: dict[str, Any]
    identity: Identity


@dataclass(frozen=True)
class Principal:
    user: dict[str, Any]
    identity: Identity
    organization_id: Any
    organization: dict[str, Any]
    role: str


def current_identity(credentials: HTTPAuthorizationCredentials | None = Depends(_bearer)) -> Identity:
    token = credentials.credentials if credentials and credentials.scheme.lower() == "bearer" else ""
    return get_verifier().verify(token)


def current_user_only(identity: Identity = Depends(current_identity), db: Session = Depends(get_db)) -> CurrentUser:
    user = user_repository.get_or_create_user(db, identity)
    if user["status"] != "active":
        raise AppError("account_suspended", 403, "This account is suspended.")
    return CurrentUser(user=user, identity=identity)


def current_member(current: CurrentUser = Depends(current_user_only), db: Session = Depends(get_db)) -> Principal:
    membership = user_repository.get_membership(db, current.user["id"])
    if membership is None:
        raise AppError("onboarding_required", 403, "Finish setting up your organisation first.")
    if membership["member_status"] != "active":
        audit_repository.record_refusal(db, action="request_refused", organization_id=membership["org_id"],
                                        actor_user_id=current.user["id"], reason_code="membership_suspended")
        raise AppError("membership_suspended", 403, "Your membership of this organisation is suspended.")
    return Principal(
        user=current.user,
        identity=current.identity,
        organization_id=membership["org_id"],
        organization={"id": membership["org_id"], "name": membership["org_name"],
                      "slug": membership["org_slug"], "plan": membership["org_plan"]},
        role=membership["role"],
    )
