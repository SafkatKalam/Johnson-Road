"""Projects in PostgreSQL (F20). Every query is scoped to the caller's organisation: a project id from another
organisation behaves exactly like an id that does not exist (404), so ids cannot be probed."""
from __future__ import annotations

from typing import Any
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.repositories import audit_repository

_COLUMNS = """p.id, p.name, p.location, p.description, p.owner_user_id, p.created_by, p.archived_at,
              p.created_at, p.updated_at,
              (SELECT count(*) FROM uploads u WHERE u.project_id = p.id AND u.source_deleted_at IS NULL) AS upload_count,
              (SELECT count(*) FROM jobs j WHERE j.project_id = p.id) AS job_count,
              (SELECT count(*) FROM reports r WHERE r.project_id = p.id) AS report_count"""


def _like_escape(value: str) -> str:
    """So a search for "50%" finds "50%", not everything."""
    return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def _not_found() -> AppError:
    return AppError("project_not_found", 404, "That project was not found.")


def _name_taken() -> AppError:
    return AppError("project_name_taken", 409, "A project with that name already exists.")


def create(db: Session, *, organization_id: Any, user_id: Any, name: str, location: str, description: str) -> dict[str, Any]:
    try:
        with db.begin_nested():
            row = db.execute(
                text("""INSERT INTO projects (organization_id, name, location, description, owner_user_id, created_by)
                        VALUES (:org, :name, :loc, :desc, :uid, :uid) RETURNING id"""),
                {"org": organization_id, "name": name, "loc": location, "desc": description, "uid": user_id},
            ).mappings().one()
    except IntegrityError:
        db.rollback()
        raise _name_taken()
    audit_repository.record(db, action="project_created", organization_id=organization_id, actor_user_id=user_id,
                            entity_type="project", entity_id=row["id"])
    db.commit()
    return get(db, organization_id, row["id"])


def get(db: Session, organization_id: Any, project_id: UUID) -> dict[str, Any]:
    row = db.execute(
        text(f"SELECT {_COLUMNS} FROM projects p WHERE p.id = :id AND p.organization_id = :org"),
        {"id": project_id, "org": organization_id},
    ).mappings().first()
    if row is None:
        raise _not_found()
    return dict(row)


def list_projects(db: Session, organization_id: Any, *, q: str | None, state: str, limit: int, offset: int) -> tuple[list[dict[str, Any]], int]:
    where = ["p.organization_id = :org"]
    params: dict[str, Any] = {"org": organization_id, "limit": limit, "offset": offset}
    if state == "active":
        where.append("p.archived_at IS NULL")
    elif state == "archived":
        where.append("p.archived_at IS NOT NULL")
    if q:
        where.append("(p.name ILIKE :q ESCAPE '\\' OR p.location ILIKE :q ESCAPE '\\')")
        params["q"] = f"%{_like_escape(q)}%"
    clause = " AND ".join(where)
    total = db.execute(text(f"SELECT count(*) FROM projects p WHERE {clause}"), params).scalar_one()
    rows = db.execute(
        text(f"SELECT {_COLUMNS} FROM projects p WHERE {clause} ORDER BY p.created_at DESC, p.id LIMIT :limit OFFSET :offset"),
        params,
    ).mappings().all()
    return [dict(r) for r in rows], int(total)


def update(db: Session, *, organization_id: Any, user_id: Any, project_id: UUID, changes: dict[str, str]) -> dict[str, Any]:
    """Rename or edit location/description. An archived project is read-only (default decision, see F20)."""
    row = db.execute(
        text("SELECT id, archived_at FROM projects WHERE id = :id AND organization_id = :org FOR UPDATE"),
        {"id": project_id, "org": organization_id},
    ).mappings().first()
    if row is None:
        raise _not_found()
    if row["archived_at"] is not None:
        db.rollback()
        raise AppError("project_archived", 409, "This project is archived. Restore it before changing it.")
    sets = ", ".join(f"{col} = :{col}" for col in changes)  # column names come from a fixed allow-list in the router
    try:
        with db.begin_nested():
            db.execute(text(f"UPDATE projects SET {sets}, updated_at = now() WHERE id = :id"), {**changes, "id": project_id})
    except IntegrityError:
        db.rollback()
        raise _name_taken()
    audit_repository.record(db, action="project_updated", organization_id=organization_id, actor_user_id=user_id,
                            entity_type="project", entity_id=project_id, details={"fields": sorted(changes)})
    db.commit()
    return get(db, organization_id, project_id)


def set_archived(db: Session, *, organization_id: Any, user_id: Any, project_id: UUID, archived: bool) -> dict[str, Any]:
    row = db.execute(
        text("SELECT id, archived_at FROM projects WHERE id = :id AND organization_id = :org FOR UPDATE"),
        {"id": project_id, "org": organization_id},
    ).mappings().first()
    if row is None:
        raise _not_found()
    if (row["archived_at"] is not None) == archived:
        db.rollback()
        return get(db, organization_id, project_id)  # already in the wanted state: nothing to change or audit
    try:
        with db.begin_nested():
            db.execute(
                text("UPDATE projects SET archived_at = CASE WHEN :a THEN now() ELSE NULL END, updated_at = now() WHERE id = :id"),
                {"a": archived, "id": project_id},
            )
    except IntegrityError:
        db.rollback()  # restoring when an active project already has this name
        raise _name_taken()
    audit_repository.record(db, action="project_archived" if archived else "project_restored", organization_id=organization_id,
                            actor_user_id=user_id, entity_type="project", entity_id=project_id)
    db.commit()
    return get(db, organization_id, project_id)


def location_suggestions(db: Session, organization_id: Any, prefix: str | None) -> list[str]:
    """Locations already used by this organisation's projects (a real source, not a fixed list)."""
    params: dict[str, Any] = {"org": organization_id}
    extra = ""
    if prefix:
        extra = "AND location ILIKE :p ESCAPE '\\'"
        params["p"] = f"{_like_escape(prefix)}%"
    rows = db.execute(
        text(f"""SELECT location FROM projects WHERE organization_id = :org AND location <> '' {extra}
                 GROUP BY location ORDER BY count(*) DESC, location LIMIT 10"""),
        params,
    ).scalars().all()
    return list(rows)
