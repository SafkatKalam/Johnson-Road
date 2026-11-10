"""Users and memberships in backend PostgreSQL (O48). Plain SQL; one place that touches these tables for sign-in."""
from __future__ import annotations

import re
import secrets
from typing import Any

from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.auth.tokens import Identity
from app.core.errors import AppError
from app.repositories import audit_repository

_USER_COLUMNS = "id, auth_subject, email, full_name, avatar_url, status"


def get_or_create_user(db: Session, identity: Identity) -> dict[str, Any]:
    """The backend user for this sign-in identity, created on first sight.

    Safe when two requests for a new person arrive at the same moment. The insert says "ON CONFLICT DO NOTHING"
    with NO target, so a clash on ANY unique rule is skipped: both the sign-in id and the email address are
    unique, and the second request of the same person clashes on both. (With a target on the sign-in id only,
    the email clash raised an error and the person was told, wrongly, that their address was taken.)
    Afterwards the row is read back by sign-in id. If there is none, the clash was with somebody ELSE's row.
    """
    try:
        db.execute(
            text("INSERT INTO users (auth_subject, email) VALUES (:sub, :email) ON CONFLICT DO NOTHING"),
            {"sub": identity.subject, "email": identity.email},
        )
        found = db.execute(
            text(f"SELECT {_USER_COLUMNS} FROM users WHERE auth_subject = :sub"), {"sub": identity.subject}
        ).mappings().first()
        if found is None:
            # Nothing inserted and nothing found for this sign-in id: another account holds this email address.
            raise IntegrityError("insert", {}, Exception("users_email_lower_uq"))
        user = found
        if user["email"] != identity.email:
            # The sign-in provider is the source of the email address; keep our copy in step.
            db.execute(
                text("UPDATE users SET email = :email, updated_at = now() WHERE id = :id"),
                {"email": identity.email, "id": user["id"]},
            )
            user = db.execute(
                text(f"SELECT {_USER_COLUMNS} FROM users WHERE id = :id"), {"id": user["id"]}
            ).mappings().one()
            audit_repository.record(db, action="email_synced", actor_user_id=user["id"], actor_kind="system",
                                    entity_type="user", entity_id=user["id"])  # no addresses in the log
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


def slugify(name: str) -> str:
    """A short address-safe version of an organisation name ('Acme Roads Ltd.' -> 'acme-roads-ltd')."""
    slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")[:40].strip("-")
    return slug or "org"


def create_first_organization(db: Session, user_id: Any, name: str) -> dict[str, Any]:
    """Create an organisation and make the person its owner, as ONE transaction (F15).

    Either both rows exist afterwards or neither does. A person can belong to one organisation (O67): the
    UNIQUE(user_id) rule on organization_members decides, so two requests at the same moment still give one
    organisation, and the loser gets 409 with nothing left behind.
    """
    if get_membership(db, user_id) is not None:
        audit_repository.record_refusal(db, action="organization_create_refused", actor_user_id=user_id, reason_code="already_member")
        raise AppError("already_member", 409, "You already belong to an organisation.")
    base = slugify(name)
    for attempt in range(6):
        slug = base if attempt == 0 else f"{base}-{secrets.token_hex(3)}"
        try:
            with db.begin_nested():  # a slug clash undoes only this attempt, then the next one tries a new slug
                org_id = db.execute(
                    text("INSERT INTO organizations (name, slug) VALUES (:name, :slug) RETURNING id"),
                    {"name": name, "slug": slug},
                ).scalar_one()
                db.execute(
                    text("INSERT INTO organization_members (organization_id, user_id, role) VALUES (:org, :user, 'owner')"),
                    {"org": org_id, "user": user_id},
                )
            audit_repository.record(db, action="organization_created", organization_id=org_id, actor_user_id=user_id,
                                    entity_type="organization", entity_id=org_id, details={"slug": slug})
            db.commit()
            membership = get_membership(db, user_id)
            if membership is None:  # cannot happen (just committed); an explicit error, unlike assert, survives python -O
                raise RuntimeError("organisation was created but its membership cannot be read")
            return membership
        except IntegrityError as exc:
            detail = str(exc.orig)
            if "organizations_slug_key" in detail:
                continue  # that address is taken: try another
            db.rollback()
            if "organization_members_user_id_key" in detail:
                audit_repository.record_refusal(db, action="organization_create_refused", actor_user_id=user_id, reason_code="already_member")
                raise AppError("already_member", 409, "You already belong to an organisation.") from None
            raise
    db.rollback()
    raise AppError("organization_name_unavailable", 409, "Could not find a free address for that name. Try a different name.")


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
    audit_repository.record(db, action="profile_updated", actor_user_id=user_id, entity_type="user", entity_id=user_id,
                            details={"fields": sorted(changes)})  # which fields changed, never their values
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
