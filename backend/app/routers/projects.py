"""Projects (F20): create, list and search, read, edit, archive and restore. Real PostgreSQL, scoped to the caller's
organisation. Defaults (not yet confirmed by the client): any member can create and edit a project; only an owner or
administrator can archive or restore one; an archived project is read-only."""
import re
from typing import Any, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, ConfigDict, field_validator, model_validator
from sqlalchemy.orm import Session

from app.auth.deps import Principal, current_member
from app.core.errors import AppError
from app.database.database import get_db
from app.repositories import audit_repository, project_db_repository

router = APIRouter(prefix="/projects", tags=["projects"])

_CONTROL_CHARS = re.compile(r"[\x00-\x1f\x7f]")


def _clean(value: str, field: str, *, max_len: int, required: bool, multiline: bool = False) -> str:
    value = value.strip()
    pattern = re.compile(r"[\x00-\x08\x0b-\x1f\x7f]") if multiline else _CONTROL_CHARS
    if (required and not value) or len(value) > max_len or pattern.search(value):
        raise ValueError(f"{field} must be {'1' if required else '0'} to {max_len} characters without control characters")
    return value


class ProjectCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str
    location: str = ""
    description: str = ""

    @field_validator("name")
    @classmethod
    def _name(cls, v: str) -> str:
        return _clean(v, "name", max_len=120, required=True)

    @field_validator("location")
    @classmethod
    def _location(cls, v: str) -> str:
        return _clean(v, "location", max_len=200, required=False)

    @field_validator("description")
    @classmethod
    def _description(cls, v: str) -> str:
        return _clean(v, "description", max_len=2000, required=False, multiline=True)


class ProjectUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")  # not the organisation, owner or archive state

    name: str | None = None
    location: str | None = None
    description: str | None = None

    @field_validator("name")
    @classmethod
    def _name(cls, v: str | None) -> str | None:
        return None if v is None else _clean(v, "name", max_len=120, required=True)

    @field_validator("location")
    @classmethod
    def _location(cls, v: str | None) -> str | None:
        return None if v is None else _clean(v, "location", max_len=200, required=False)

    @field_validator("description")
    @classmethod
    def _description(cls, v: str | None) -> str | None:
        return None if v is None else _clean(v, "description", max_len=2000, required=False, multiline=True)

    @model_validator(mode="after")
    def _something_to_change(self) -> "ProjectUpdate":
        if self.name is None and self.location is None and self.description is None:
            raise ValueError("send at least one of name, location, description")
        return self


def _view(p: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": str(p["id"]), "name": p["name"], "location": p["location"], "description": p["description"],
        "ownerUserId": str(p["owner_user_id"]) if p["owner_user_id"] else None,
        "archived": p["archived_at"] is not None,
        "archivedAt": p["archived_at"].isoformat() if p["archived_at"] else None,
        "createdAt": p["created_at"].isoformat(), "updatedAt": p["updated_at"].isoformat(),
        # Counted from stored records; no invented vehicle totals, flows or thumbnails.
        "uploadCount": p["upload_count"], "jobCount": p["job_count"], "reportCount": p["report_count"],
    }


def _can_archive(role: str) -> bool:
    return role in ("owner", "admin")


@router.post("", status_code=201, summary="Create a project")
def create_project(body: ProjectCreate, who: Principal = Depends(current_member), db: Session = Depends(get_db)):
    p = project_db_repository.create(db, organization_id=who.organization_id, user_id=who.user["id"],
                                      name=body.name, location=body.location, description=body.description)
    return {"project": _view(p)}


@router.get("", summary="List and search projects")
def list_projects(
    q: str | None = Query(None, max_length=120, description="Matches name or location"),
    state: Literal["active", "archived", "all"] = "active",
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0, le=100000),
    who: Principal = Depends(current_member),
    db: Session = Depends(get_db),
):
    items, total = project_db_repository.list_projects(db, who.organization_id, q=(q or "").strip() or None, state=state,
                                                       limit=limit, offset=offset)
    return {"items": [_view(p) for p in items], "total": total, "limit": limit, "offset": offset}


@router.get("/location-suggestions", summary="Locations already used in your organisation")
def location_suggestions(prefix: str | None = Query(None, max_length=100), who: Principal = Depends(current_member),
                         db: Session = Depends(get_db)):
    return {"suggestions": project_db_repository.location_suggestions(db, who.organization_id, (prefix or "").strip() or None)}


@router.get("/{project_id}", summary="Project detail")
def read_project(project_id: UUID, who: Principal = Depends(current_member), db: Session = Depends(get_db)):
    return {"project": _view(project_db_repository.get(db, who.organization_id, project_id))}


@router.patch("/{project_id}", summary="Edit a project")
def update_project(project_id: UUID, body: ProjectUpdate, who: Principal = Depends(current_member), db: Session = Depends(get_db)):
    changes = {k: v for k, v in body.model_dump().items() if v is not None}
    p = project_db_repository.update(db, organization_id=who.organization_id, user_id=who.user["id"], project_id=project_id,
                                     changes=changes)
    return {"project": _view(p)}


def _archive(project_id: UUID, archived: bool, who: Principal, db: Session) -> dict[str, Any]:
    if not _can_archive(who.role):
        audit_repository.record_refusal(db, action="project_archive_refused", organization_id=who.organization_id,
                                        actor_user_id=who.user["id"], entity_type="project", entity_id=project_id,
                                        reason_code="role")
        raise AppError("forbidden", 403, "You are not allowed to do this.")
    p = project_db_repository.set_archived(db, organization_id=who.organization_id, user_id=who.user["id"],
                                           project_id=project_id, archived=archived)
    return {"project": _view(p)}


@router.post("/{project_id}/archive", summary="Archive a project (it is kept, read-only)")
def archive_project(project_id: UUID, who: Principal = Depends(current_member), db: Session = Depends(get_db)):
    return _archive(project_id, True, who, db)


@router.post("/{project_id}/restore", summary="Restore an archived project")
def restore_project(project_id: UUID, who: Principal = Depends(current_member), db: Session = Depends(get_db)):
    return _archive(project_id, False, who, db)
