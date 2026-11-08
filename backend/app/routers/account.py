import re
from typing import Any
from urllib.parse import urlparse

from fastapi import APIRouter, Depends
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy.orm import Session

from app.auth.deps import CurrentUser, current_user_only
from app.database.database import get_db
from app.repositories import user_repository

router = APIRouter(tags=["account"])

_CONTROL_CHARS = re.compile(r"[\x00-\x1f\x7f]")


def _account_body(user: dict[str, Any], membership: dict[str, Any] | None) -> dict[str, Any]:
    organization = None
    if membership is not None:
        organization = {"id": str(membership["org_id"]), "name": membership["org_name"],
                        "slug": membership["org_slug"], "plan": membership["org_plan"]}
    return {
        "user": {
            "id": str(user["id"]),
            "email": user["email"],
            "fullName": user["full_name"],
            "avatarUrl": user["avatar_url"],
            "status": user["status"],
        },
        "organization": organization,
        "role": membership["role"] if membership else None,
        "membershipStatus": membership["member_status"] if membership else None,
        "needsOnboarding": membership is None,
    }


@router.get("/me", summary="Who the caller is, and their organisation if they have one")
def get_me(current: CurrentUser = Depends(current_user_only), db: Session = Depends(get_db)):
    return _account_body(current.user, user_repository.get_membership(db, current.user["id"]))


class ProfileUpdate(BaseModel):
    """The only fields a person may change about themselves. Anything else (role, organisation, email,
    status) is refused with 422, so a request cannot even name them."""

    model_config = ConfigDict(extra="forbid")

    fullName: str | None = Field(default=None, description="1 to 120 characters")
    avatarUrl: str | None = Field(default=None, description="An https:// address, or empty/null to remove")

    @field_validator("fullName")
    @classmethod
    def check_name(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = value.strip()
        if not 1 <= len(value) <= 120:
            raise ValueError("must be 1 to 120 characters")
        if _CONTROL_CHARS.search(value):
            raise ValueError("must not contain control characters")
        return value

    @field_validator("avatarUrl")
    @classmethod
    def check_avatar(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = value.strip()
        if value == "":
            return ""  # means "remove the avatar"
        parsed = urlparse(value)
        if len(value) > 500 or parsed.scheme != "https" or not parsed.netloc or re.search(r"\s", value):
            raise ValueError("must be an https:// address of at most 500 characters")
        return value


@router.patch("/me", summary="Change your own name or avatar address")
def update_me(body: ProfileUpdate, current: CurrentUser = Depends(current_user_only), db: Session = Depends(get_db)):
    changes: dict[str, Any] = {}
    if "fullName" in body.model_fields_set and body.fullName is not None:
        changes["full_name"] = body.fullName
    if "avatarUrl" in body.model_fields_set:
        changes["avatar_url"] = body.avatarUrl or None  # "" or null removes it
    user = user_repository.update_profile(db, current.user["id"], changes) if changes else current.user
    return _account_body(user, user_repository.get_membership(db, user["id"]))
