"""Uploaded videos in PostgreSQL (F22, F23). Scoped to the caller's organisation and project; an id from another
organisation or project behaves like an id that does not exist."""
from __future__ import annotations

from typing import Any
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.repositories import audit_repository, notification_repository

METADATA_COLUMNS = ("camera_id", "road_name", "recorded_date", "recorded_start_time", "recorded_end_time", "weather", "notes")
_COLS = """u.id, u.project_id, u.original_name, u.extension, u.status, u.failure_code, u.size_bytes, u.checksum_sha256,
           u.duration_seconds, u.width_px, u.height_px, u.frame_rate, u.frame_count, u.preview_frame_key, u.storage_key,
           u.camera_id, u.road_name, u.recorded_date, u.recorded_start_time, u.recorded_end_time, u.weather, u.notes,
           u.source_deleted_at, u.created_at, u.updated_at, u.uploaded_by,
           (SELECT count(*) FROM jobs j WHERE j.upload_id = u.id) AS job_count"""


def project_not_found() -> AppError:
    return AppError("project_not_found", 404, "That project was not found.")


def upload_not_found() -> AppError:
    return AppError("upload_not_found", 404, "That video was not found.")


def _lock_active_project(db: Session, organization_id: Any, project_id: UUID) -> None:
    row = db.execute(
        text("SELECT archived_at FROM projects WHERE id = :p AND organization_id = :o FOR SHARE"),
        {"p": project_id, "o": organization_id},
    ).mappings().first()
    if row is None:
        db.rollback()
        raise project_not_found()
    if row["archived_at"] is not None:
        db.rollback()
        raise AppError("project_archived", 409, "This project is archived. Restore it before adding videos.")


def find_by_idempotency(db: Session, organization_id: Any, key: str) -> dict[str, Any] | None:
    row = db.execute(
        text(f"SELECT {_COLS} FROM uploads u WHERE u.organization_id = :o AND u.idempotency_key = :k"),
        {"o": organization_id, "k": key},
    ).mappings().first()
    return dict(row) if row else None


def begin_receiving(db: Session, *, organization_id: Any, project_id: UUID, user_id: Any, idempotency_key: str | None,
                    original_name: str, extension: str, storage_key: str, metadata: dict[str, Any]) -> UUID:
    """Create the row in status 'receiving' and commit it, so a crash leaves a visible unfinished row, not a stray file."""
    _lock_active_project(db, organization_id, project_id)
    try:
        with db.begin_nested():
            row = db.execute(
                text("""INSERT INTO uploads (organization_id, project_id, uploaded_by, idempotency_key, original_name,
                                             storage_key, extension, camera_id, road_name, recorded_date,
                                             recorded_start_time, recorded_end_time, weather, notes)
                        VALUES (:o, :p, :u, :k, :n, :sk, :ext, :camera_id, :road_name, :recorded_date,
                                :recorded_start_time, :recorded_end_time, :weather, :notes) RETURNING id"""),
                {"o": organization_id, "p": project_id, "u": user_id, "k": idempotency_key, "n": original_name,
                 "sk": storage_key, "ext": extension, **{c: metadata.get(c) for c in METADATA_COLUMNS}},
            ).mappings().one()
    except IntegrityError:
        db.rollback()
        raise AppError("upload_in_progress", 409, "This upload is already being received.")
    db.commit()
    return row["id"]


def mark_ready(db: Session, *, upload_id: UUID, organization_id: Any, user_id: Any, size_bytes: int, checksum: str,
               measured: Any, preview_key: str) -> dict[str, Any]:
    db.execute(
        text("""UPDATE uploads SET status = 'ready', failure_code = NULL, size_bytes = :s, checksum_sha256 = :c,
                  duration_seconds = :d, width_px = :w, height_px = :h, frame_rate = :f, frame_count = :n,
                  preview_frame_key = :pk, updated_at = now()
                WHERE id = :id AND status = 'receiving'"""),
        {"s": size_bytes, "c": checksum, "d": measured.duration_seconds, "w": measured.width_px, "h": measured.height_px,
         "f": measured.frame_rate, "n": measured.frame_count, "pk": preview_key, "id": upload_id},
    )
    audit_repository.record(db, action="upload_created", organization_id=organization_id, actor_user_id=user_id,
                            entity_type="upload", entity_id=upload_id, details={"sizeBytes": size_bytes})
    pid = db.execute(text("SELECT project_id, original_name FROM uploads WHERE id = :id"), {"id": upload_id}).mappings().one()
    notification_repository.add(db, user_id=user_id, organization_id=organization_id, kind="upload_ready", title="Video ready",
                                detail=f"{pid['original_name']} was checked and is ready for analysis.", link=f"/projects/{pid['project_id']}")
    db.commit()
    return get_any(db, organization_id, upload_id)


def storage_used(db: Session, organization_id: Any) -> int:
    """Bytes of stored source video the organisation is using now (ready, not deleted)."""
    return int(db.execute(text("""SELECT coalesce(sum(size_bytes), 0) FROM uploads WHERE organization_id = :o AND status = 'ready'
                                   AND source_deleted_at IS NULL"""), {"o": organization_id}).scalar_one())


def expire_stale_receiving(db: Session, upload_id: Any, *, minutes: int) -> bool:
    """Fail a 'receiving' row older than `minutes` (left by a crash) and free its idempotency key. True if it did."""
    n = db.execute(text("""UPDATE uploads SET status = 'failed', failure_code = 'interrupted', idempotency_key = NULL, updated_at = now()
                           WHERE id = :id AND status = 'receiving' AND updated_at < now() - make_interval(mins => :m)"""),
                   {"id": upload_id, "m": minutes}).rowcount
    db.commit()
    return n == 1


def mark_failed(db: Session, *, upload_id: UUID, organization_id: Any, user_id: Any, code: str) -> None:
    """Record a refused or broken upload. Its idempotency key is released so the same retry can create a fresh row."""
    db.rollback()
    db.execute(
        text("""UPDATE uploads SET status = 'failed', failure_code = :c, idempotency_key = NULL, updated_at = now()
                WHERE id = :id AND status = 'receiving'"""),
        {"c": code, "id": upload_id},
    )
    audit_repository.record(db, action="upload_failed", organization_id=organization_id, actor_user_id=user_id,
                            entity_type="upload", entity_id=upload_id, outcome="failed", reason_code=code)
    db.commit()


def get_any(db: Session, organization_id: Any, upload_id: UUID, project_id: UUID | None = None) -> dict[str, Any]:
    row = db.execute(
        text(f"""SELECT {_COLS} FROM uploads u WHERE u.id = :id AND u.organization_id = :o
                 AND (CAST(:p AS uuid) IS NULL OR u.project_id = :p)"""),
        {"id": upload_id, "o": organization_id, "p": project_id},
    ).mappings().first()
    if row is None:
        raise upload_not_found()
    return dict(row)


def list_for_project(db: Session, organization_id: Any, project_id: UUID, *, limit: int, offset: int) -> tuple[list[dict[str, Any]], int]:
    exists = db.execute(text("SELECT 1 FROM projects WHERE id = :p AND organization_id = :o"),
                        {"p": project_id, "o": organization_id}).first()
    if exists is None:
        raise project_not_found()
    params = {"p": project_id, "o": organization_id, "limit": limit, "offset": offset}
    # Only finished videos are shown: 'receiving' and 'failed' rows are bookkeeping, not videos.
    total = db.execute(text("SELECT count(*) FROM uploads WHERE project_id = :p AND organization_id = :o AND status = 'ready' AND source_deleted_at IS NULL"),
                       params).scalar_one()
    rows = db.execute(
        text(f"""SELECT {_COLS} FROM uploads u WHERE u.project_id = :p AND u.organization_id = :o AND u.status = 'ready'
                 AND u.source_deleted_at IS NULL ORDER BY u.created_at DESC, u.id LIMIT :limit OFFSET :offset"""), params,
    ).mappings().all()
    return [dict(r) for r in rows], int(total)


def update_metadata(db: Session, *, organization_id: Any, project_id: UUID, upload_id: UUID, user_id: Any,
                    changes: dict[str, Any]) -> dict[str, Any]:
    """Edit the typed metadata. After the first job only the notes may change (FD4): a result keeps the facts it was made with."""
    row = db.execute(
        text("""SELECT u.status, u.source_deleted_at, u.recorded_start_time, u.recorded_end_time,
                       (SELECT count(*) FROM jobs j WHERE j.upload_id = u.id) AS job_count
                FROM uploads u WHERE u.id = :id AND u.project_id = :p AND u.organization_id = :o FOR UPDATE"""),
        {"id": upload_id, "p": project_id, "o": organization_id},
    ).mappings().first()
    if row is None or row["status"] != "ready" or row["source_deleted_at"] is not None:
        db.rollback()
        raise upload_not_found()
    if row["job_count"] > 0 and set(changes) - {"notes"}:
        db.rollback()
        raise AppError("metadata_locked", 409, "This video has been analysed, so only its notes can be changed.")
    start = changes.get("recorded_start_time", row["recorded_start_time"])
    end = changes.get("recorded_end_time", row["recorded_end_time"])
    if start is not None and end is not None and end <= start:
        db.rollback()
        raise AppError("invalid_time_range", 422, "The end time must be after the start time.")
    sets = ", ".join(f"{c} = :{c}" for c in changes)  # names come from the fixed METADATA_COLUMNS allow-list
    db.execute(text(f"UPDATE uploads SET {sets}, updated_at = now() WHERE id = :id"), {**changes, "id": upload_id})
    audit_repository.record(db, action="upload_metadata_updated", organization_id=organization_id, actor_user_id=user_id,
                            entity_type="upload", entity_id=upload_id, details={"fields": sorted(changes)})
    db.commit()
    return get_any(db, organization_id, upload_id, project_id)


def delete_if_eligible(db: Session, *, organization_id: Any, project_id: UUID, upload_id: UUID, user_id: Any) -> dict[str, Any]:
    """Mark a video with no job as deleted and return its keys so the caller can remove the files.
    The row stays (history); the file is removed after commit, so a failure here leaves a row, never a dangling file."""
    row = db.execute(
        text("""SELECT u.storage_key, u.preview_frame_key, u.status, u.source_deleted_at,
                       (SELECT count(*) FROM jobs j WHERE j.upload_id = u.id) AS job_count
                FROM uploads u WHERE u.id = :id AND u.project_id = :p AND u.organization_id = :o FOR UPDATE"""),
        {"id": upload_id, "p": project_id, "o": organization_id},
    ).mappings().first()
    if row is None or row["status"] != "ready" or row["source_deleted_at"] is not None:
        db.rollback()
        raise upload_not_found()
    if row["job_count"] > 0:
        db.rollback()
        raise AppError("upload_in_use", 409, "This video has been queued or analysed, so it cannot be removed.")
    db.execute(text("UPDATE uploads SET source_deleted_at = now(), updated_at = now() WHERE id = :id"), {"id": upload_id})
    audit_repository.record(db, action="upload_deleted", organization_id=organization_id, actor_user_id=user_id,
                            entity_type="upload", entity_id=upload_id)
    db.commit()
    return {"storage_key": row["storage_key"], "preview_frame_key": row["preview_frame_key"]}
