"""Video uploads inside a project (F22, F23). One request stores one video, validates it with the real reader, makes a real
preview frame and only then marks it ready. It never creates a job (FD8). Any member can add or edit a video; the
organisation and project come from the caller's membership, never from the request body."""
import logging
import re
from datetime import date, time
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, Header, Query, Response, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel, ConfigDict, ValidationError, field_validator
from sqlalchemy.orm import Session

from app.auth.deps import Principal, current_member
from app.core.config import settings
from app.core.errors import AppError
from app.database.database import get_db
from app.media import probe as media
from app.repositories import upload_db_repository as repo
from app.storage import (
    StorageKeyError,
    StorageNotFound,
    StorageTooLarge,
    StorageUnavailable,
    key_belongs_to,
    make_key,
    storage,
)

logger = logging.getLogger("johnsonroad.upload")
router = APIRouter(prefix="/projects/{project_id}/uploads", tags=["uploads"])

_EXTENSIONS = ("mp4", "mkv", "avi")
_IDEMPOTENCY_KEY = re.compile(r"^[A-Za-z0-9._:\-]{8,100}$")
_CONTROL = re.compile(r"[\x00-\x1f\x7f]")
_CHUNK = 1024 * 1024

_FAILURES = {
    media.NOT_A_VIDEO: (415, "That file is not the kind of video its name says it is."),
    media.UNREADABLE: (422, "That video could not be read. It may be damaged or use an unsupported format."),
    media.EMPTY: (422, "That video has no frames."),
    media.TOO_LONG: (422, "That video is longer than the allowed duration."),
    media.TOO_LARGE_FRAME: (422, "That video's picture size is larger than allowed."),
}


def _text(value: str | None, field: str, max_len: int) -> str | None:
    if value is None:
        return None
    value = value.strip()
    if _CONTROL.search(value) or len(value) > max_len:
        raise ValueError(f"{field} must be at most {max_len} characters without control characters")
    return value or None


def _parse_time(value: str | None, field: str) -> time | None:
    if value is None or not value.strip():
        return None
    value = value.strip()
    # Strict HH:MM or HH:MM:SS, hour 00-23: "24:00", time zones and fractions are refused (camera local clock, O68/O75).
    m = re.fullmatch(r"([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?", value)
    if not m:
        raise ValueError(f"{field} must be a time from 00:00 to 23:59 such as 08:30 or 08:30:00, without a time zone")
    return time(int(m.group(1)), int(m.group(2)), int(m.group(3) or 0))


def _parse_date(value: str | None, field: str) -> date | None:
    if value is None or not value.strip():
        return None
    try:
        return date.fromisoformat(value.strip())
    except ValueError as exc:
        raise ValueError(f"{field} must be a date such as 2026-11-07") from exc


class MetadataIn(BaseModel):
    """Typed metadata, shared by upload and edit. Unknown fields are refused on edit."""
    model_config = ConfigDict(extra="forbid")

    cameraId: str | None = None
    roadName: str | None = None
    recordedDate: str | None = None
    recordedStartTime: str | None = None
    recordedEndTime: str | None = None
    weather: str | None = None
    notes: str | None = None

    @field_validator("cameraId")
    @classmethod
    def _c(cls, v): return _text(v, "cameraId", 100)

    @field_validator("roadName")
    @classmethod
    def _r(cls, v): return _text(v, "roadName", 200)

    @field_validator("weather")
    @classmethod
    def _w(cls, v): return _text(v, "weather", 100)

    @field_validator("notes")
    @classmethod
    def _n(cls, v):
        if v is None:
            return None
        v = v.strip()
        if len(v) > 2000 or re.search(r"[\x00-\x08\x0b-\x1f\x7f]", v):
            raise ValueError("notes must be at most 2000 characters without control characters")
        return v or None

    @field_validator("recordedDate")
    @classmethod
    def _d(cls, v): return _parse_date(v, "recordedDate") and v.strip()

    @field_validator("recordedStartTime", "recordedEndTime")
    @classmethod
    def _t(cls, v, info):
        _parse_time(v, info.field_name)
        return v.strip() if v and v.strip() else None

    def to_columns(self, only_sent: bool = False) -> dict[str, Any]:
        mapping = {"cameraId": "camera_id", "roadName": "road_name", "recordedDate": "recorded_date",
                   "recordedStartTime": "recorded_start_time", "recordedEndTime": "recorded_end_time",
                   "weather": "weather", "notes": "notes"}
        sent = self.model_fields_set if only_sent else set(mapping)
        out: dict[str, Any] = {}
        for api, col in mapping.items():
            if api not in sent:
                continue
            raw = getattr(self, api)
            if api == "recordedDate":
                out[col] = _parse_date(raw, api)
            elif api in ("recordedStartTime", "recordedEndTime"):
                out[col] = _parse_time(raw, api)
            else:
                out[col] = raw
        s, e = out.get("recorded_start_time"), out.get("recorded_end_time")
        if s is not None and e is not None and e <= s:
            raise AppError("invalid_time_range", 422, "The end time must be after the start time.")
        return out


def _view(u: dict[str, Any]) -> dict[str, Any]:
    iso = lambda v: v.isoformat() if v is not None else None  # noqa: E731
    return {
        "id": str(u["id"]), "projectId": str(u["project_id"]), "name": u["original_name"], "status": u["status"],
        "sizeBytes": u["size_bytes"], "durationSeconds": float(u["duration_seconds"]) if u["duration_seconds"] is not None else None,
        "widthPx": u["width_px"], "heightPx": u["height_px"],
        "frameRate": float(u["frame_rate"]) if u["frame_rate"] is not None else None, "frameCount": u["frame_count"],
        "hasPreview": bool(u["preview_frame_key"]),
        "metadata": {"cameraId": u["camera_id"], "roadName": u["road_name"], "recordedDate": iso(u["recorded_date"]),
                     "recordedStartTime": iso(u["recorded_start_time"]), "recordedEndTime": iso(u["recorded_end_time"]),
                     "weather": u["weather"], "notes": u["notes"]},
        "jobCount": u["job_count"], "createdAt": iso(u["created_at"]),
    }


class _QuotaExceeded(Exception):
    """The organisation's storage quota (ORG_MAX_STORAGE_BYTES) would be exceeded by this video."""


def _clean_name(raw: str | None) -> tuple[str, str]:
    """(display name, extension). Only the last path segment, no control characters, at most 200 characters."""
    name = (raw or "").replace("\\", "/").rsplit("/", 1)[-1]
    name = _CONTROL.sub("", name).strip()[:200]
    ext = name.rsplit(".", 1)[-1].lower() if "." in name else ""
    if not name or ext not in _EXTENSIONS:
        raise AppError("unsupported_video_type", 415, "Only .mp4, .mkv and .avi videos are accepted.")
    return name, ext


def _chunks(file: UploadFile):
    while True:
        block = file.file.read(_CHUNK)
        if not block:
            return
        yield block


def _remove(area: str, key: str | None) -> None:
    if not key:
        return
    try:
        storage.delete(area, key)
    except (StorageUnavailable, StorageKeyError):
        logger.warning("upload.cleanup_failed", extra={"area": area})


@router.post("", status_code=201, summary="Upload one video to a project")
def upload_video(
    project_id: UUID,
    response: Response,
    file: UploadFile = File(...),
    cameraId: str | None = Form(None), roadName: str | None = Form(None), recordedDate: str | None = Form(None),
    recordedStartTime: str | None = Form(None), recordedEndTime: str | None = Form(None),
    weather: str | None = Form(None), notes: str | None = Form(None),
    idempotency_key: str | None = Header(None, alias="Idempotency-Key"),
    who: Principal = Depends(current_member),
    db: Session = Depends(get_db),
):
    # 1. Everything that can be checked without touching storage is checked first.
    try:
        meta = MetadataIn(cameraId=cameraId, roadName=roadName, recordedDate=recordedDate, recordedStartTime=recordedStartTime,
                          recordedEndTime=recordedEndTime, weather=weather, notes=notes).to_columns()
    except ValidationError as exc:  # built by hand from form fields, so FastAPI does not turn this into a 422 itself
        raise AppError("invalid_input", 422, "Some of the video details are not valid: "
                       + ", ".join(sorted({str(e["loc"][0]) for e in exc.errors() if e["loc"]})) + ".")
    name, ext = _clean_name(file.filename)
    if idempotency_key is not None and not _IDEMPOTENCY_KEY.fullmatch(idempotency_key):
        raise AppError("invalid_idempotency_key", 422, "The Idempotency-Key header must be 8 to 100 letters, digits or . _ : -")
    head = file.file.read(64)
    file.file.seek(0)
    if not media.sniff_matches(ext, head):
        raise AppError(media.NOT_A_VIDEO, *_FAILURES[media.NOT_A_VIDEO])

    org, user = who.organization_id, who.user["id"]
    if idempotency_key:
        prior = repo.find_by_idempotency(db, org, idempotency_key)
        if prior is not None:
            if str(prior["project_id"]) != str(project_id):
                raise AppError("idempotency_key_reused", 409, "That Idempotency-Key was used for a different project.")
            if prior["status"] == "ready":
                response.status_code = 200
                return {"upload": _view(prior), "replayed": True}   # a retry after a lost response: same row, nothing new stored
            # A 'receiving' row left by a crash would block this key for ever: after 30 minutes it is failed and freed.
            if not repo.expire_stale_receiving(db, prior["id"], minutes=30):
                raise AppError("upload_in_progress", 409, "This upload is already being received.")

    # 2. Unfinished row first (committed), then the file, then the real reader, then ready.
    storage_key = make_key(org, project_id, ext)
    upload_id = repo.begin_receiving(db, organization_id=org, project_id=project_id, user_id=user, idempotency_key=idempotency_key,
                                     original_name=name, extension=ext, storage_key=storage_key, metadata=meta)
    preview_key = None
    try:
        size, checksum = storage.write_stream("sources", storage_key, _chunks(file), max_bytes=settings.upload_max_bytes)
        if size == 0:
            raise media.ProbeError(media.EMPTY)
        if settings.org_max_storage_bytes is not None and repo.storage_used(db, org) + size > settings.org_max_storage_bytes:
            raise _QuotaExceeded()
        measured = media.probe_isolated(storage.resolve("sources", storage_key), max_duration_seconds=settings.upload_max_duration_seconds,
                               max_pixels=settings.upload_max_pixels)
        preview_key = make_key(org, project_id, "jpg", object_id=upload_id)
        storage.write_stream("previews", preview_key, iter([measured.preview_jpeg]), max_bytes=20 * 1024 * 1024)
        done = repo.mark_ready(db, upload_id=upload_id, organization_id=org, user_id=user, size_bytes=size, checksum=checksum,
                               measured=measured, preview_key=preview_key)
    except StorageTooLarge:
        _remove("sources", storage_key)
        repo.mark_failed(db, upload_id=upload_id, organization_id=org, user_id=user, code="file_too_large")
        raise AppError("file_too_large", 413, "That video is larger than the allowed size.")
    except _QuotaExceeded:
        _remove("sources", storage_key)
        repo.mark_failed(db, upload_id=upload_id, organization_id=org, user_id=user, code="storage_quota_exceeded")
        raise AppError("storage_quota_exceeded", 413, "Your organisation's video storage is full. Remove videos you no longer need.")
    except media.ProbeError as exc:
        _remove("sources", storage_key)
        _remove("previews", preview_key)
        repo.mark_failed(db, upload_id=upload_id, organization_id=org, user_id=user, code=exc.code)
        raise AppError(exc.code, *_FAILURES.get(exc.code, _FAILURES[media.UNREADABLE]))
    except StorageUnavailable:
        _remove("sources", storage_key)
        repo.mark_failed(db, upload_id=upload_id, organization_id=org, user_id=user, code="storage_unavailable")
        raise AppError("storage_unavailable", 503, "Video storage is not available right now. Please try again.")
    except BaseException:
        # Interrupted transfer or any other failure: leave no file and no 'receiving' row that blocks a retry.
        _remove("sources", storage_key)
        _remove("previews", preview_key)
        try:
            repo.mark_failed(db, upload_id=upload_id, organization_id=org, user_id=user, code="interrupted")
        except Exception:  # noqa: BLE001 - the original error is the one that matters
            logger.exception("upload.mark_failed_failed")
        raise
    return {"upload": _view(done), "replayed": False}


@router.get("", summary="Videos in a project")
def list_uploads(project_id: UUID, limit: int = Query(20, ge=1, le=100), offset: int = Query(0, ge=0, le=100000),
                 who: Principal = Depends(current_member), db: Session = Depends(get_db)):
    items, total = repo.list_for_project(db, who.organization_id, project_id, limit=limit, offset=offset)
    return {"items": [_view(u) for u in items], "total": total, "limit": limit, "offset": offset}


@router.get("/{upload_id}", summary="One video's details")
def read_upload(project_id: UUID, upload_id: UUID, who: Principal = Depends(current_member), db: Session = Depends(get_db)):
    u = repo.get_any(db, who.organization_id, upload_id, project_id)
    if u["status"] != "ready" or u["source_deleted_at"] is not None:
        raise repo.upload_not_found()
    return {"upload": _view(u)}


@router.get("/{upload_id}/preview", summary="The preview picture (one real frame)")
def read_preview(project_id: UUID, upload_id: UUID, who: Principal = Depends(current_member), db: Session = Depends(get_db)):
    u = repo.get_any(db, who.organization_id, upload_id, project_id)
    key = u["preview_frame_key"]
    if u["status"] != "ready" or u["source_deleted_at"] is not None or not key:
        raise repo.upload_not_found()
    try:
        if not key_belongs_to(key, who.organization_id):
            raise repo.upload_not_found()
        path = storage.resolve("previews", key)
        if not storage.exists("previews", key):
            raise StorageNotFound()
    except StorageNotFound:
        raise AppError("preview_missing", 404, "The preview picture is missing.")
    except (StorageUnavailable, StorageKeyError):
        raise AppError("storage_unavailable", 503, "Video storage is not available right now. Please try again.")
    return FileResponse(path, media_type="image/jpeg", headers={"Cache-Control": "private, max-age=300", "X-Content-Type-Options": "nosniff"})


@router.patch("/{upload_id}", summary="Edit a video's metadata")
def update_upload(project_id: UUID, upload_id: UUID, body: MetadataIn, who: Principal = Depends(current_member),
                  db: Session = Depends(get_db)):
    changes = body.to_columns(only_sent=True)
    if not changes:
        raise AppError("nothing_to_change", 422, "Send at least one field to change.")
    u = repo.update_metadata(db, organization_id=who.organization_id, project_id=project_id, upload_id=upload_id,
                             user_id=who.user["id"], changes=changes)
    return {"upload": _view(u)}


@router.post("/{upload_id}/delete-source", status_code=204, summary="Delete the stored video file of an analysed video (results are kept)")
def delete_source(project_id: UUID, upload_id: UUID, who: Principal = Depends(current_member), db: Session = Depends(get_db)):
    from app import maintenance
    from app.repositories import audit_repository

    if who.role not in ("owner", "admin"):
        audit_repository.record_refusal(db, action="upload_source_delete_refused", organization_id=who.organization_id,
                                        actor_user_id=who.user["id"], entity_type="upload", entity_id=upload_id, reason_code="role")
        raise AppError("forbidden", 403, "You are not allowed to do this.")
    maintenance.delete_source(db, storage, org=who.organization_id, user_id=who.user["id"], project_id=project_id, upload_id=upload_id)
    return Response(status_code=204)


@router.delete("/{upload_id}", status_code=204, summary="Remove a video that has no job")
def delete_upload(project_id: UUID, upload_id: UUID, who: Principal = Depends(current_member), db: Session = Depends(get_db)):
    keys = repo.delete_if_eligible(db, organization_id=who.organization_id, project_id=project_id, upload_id=upload_id,
                                   user_id=who.user["id"])
    _remove("sources", keys["storage_key"])
    _remove("previews", keys["preview_frame_key"])
    return Response(status_code=204)
