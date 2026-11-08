"""Users and memberships in backend PostgreSQL (O48). Plain SQL; one place that touches these tables for sign-in."""
from __future__ import annotations

from typing import Any

from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.auth.tokens import Identity
from app.core.errors import AppError

_USER_COLUMNS = "id, auth_subject, email, full_name, avatar_url, status"


def get_or_create_user(db: Session, identity: Identity) -> dict[str, Any]:
    """The backend user for this sign-in identity, created on first sight.

    Safe when two requests for a new person arrive at the same moment: the insert is
    "ON CONFLICT DO NOTHING" on the unique auth_subject, then the row is read back, so there is exactly one row.
    """
    try:
        db.execute(
            text("INSERT INTO users (auth_subject, email) VALUES (:sub, :email) ON CONFLICT (auth_subject) DO NOTHING"),
            {"sub": identity.subject, "email": identity.email},
        )
        user = db.execute(
            text(f"SELECT {_USER_COLUMNS} FROM users WHERE auth_subject = :sub"), {"sub": identity.subject}
        ).mappings().one()
        if user["email"] != identity.email:
            # The sign-in provider is the source of the email address; keep our copy in step.
            db.execute(
                text("UPDATE users SET email = :email, updated_at = now() WHERE id = :id"),
                {"email": identity.email, "id": user["id"]},
            )
            user = db.execute(
                text(f"SELECT {_USER_COLUMNS} FROM users WHERE id = :id"), {"id": user["id"]}
            ).mappings().one()
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        # Only the one expected conflict is translated. Anything else is a real fault and must surface as a 500.
        if "users_email_lower_uq" not in str(exc.orig):
            raise
        # Another account already holds this email address (for example the person's Supabase account was
        # deleted and created again, so their sign-in id changed). Needs an administrator to relink it.
        raise AppError(
            "email_in_use", 409,
            "This email address is already linked to a different sign-in. Please contact support.",
        ) from None
    return dict(user)


_EDITABLE_PROFILE_COLUMNS = {"full_name", "avatar_url"}


def update_profile(db: Session, user_id: Any, changes: dict[str, Any]) -> dict[str, Any]:
    """Change the person's own name or avatar. Only these two columns can ever be written here."""
    unknown = set(changes) - _EDITABLE_PROFILE_COLUMNS
    if unknown:  # a programming mistake, never user input: the API model already refuses other fields
        raise ValueError(f"not editable: {sorted(unknown)}")
    assignments = ", ".join(f"{column} = :{column}" for column in changes)
    row = db.execute(
        text(f"UPDATE users SET {assignments}, updated_at = now() WHERE id = :id RETURNING {_USER_COLUMNS}"),
        {**changes, "id": user_id},
    ).mappings().one()
    db.commit()
    return dict(row)


def get_membership(db: Session, user_id: Any) -> dict[str, Any] | None:
    """The user's organisation and role, or None before onboarding. One organisation per person (O67)."""
    row = db.execute(
        text(
            """SELECT m.role, m.status AS member_status, o.id AS org_id, o.name AS org_name, o.slug AS org_slug, o.plan AS org_plan
               FROM organization_members m JOIN organizations o ON o.id = m.organization_id
               WHERE m.user_id = :uid"""
        ),
        {"uid": user_id},
    ).mappings().first()
    return dict(row) if row else None
