"""Jobs, attempts, events and results in PostgreSQL (F28, F29, F34, F36).

Rules kept here:
- A job is created from one ready upload and one saved configuration, under a lock on the upload row, so creation, deletion
  and queueing of the same video cannot interleave. The configuration is locked by the database when the job exists.
- A worker claims a job with SKIP LOCKED, in the same transaction as it writes the attempt row.
- Every worker write is "fenced": it only succeeds while the job is still running, owned by that worker and on that
  attempt. A worker that lost ownership (cancelled, timed out, retried elsewhere) changes nothing.
- A job is completed only together with its stored result, in one transaction; cancellation requested before commit wins.
"""
from __future__ import annotations

import json
import uuid
from typing import Any
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.errors import AppError
from app.repositories import audit_repository, notification_repository

SAFE_MESSAGES = {
    "unreadable_video": ("The video could not be read.", False),
    "truncated_video": ("The video ended earlier than expected, so it may be damaged.", False),
    "frame_count_mismatch": ("The video is much longer than its file header says, so it was stopped.", False),
    "empty_video": ("The video has no frames to analyse.", False),
    "detector_unavailable": ("The detection model is not available on the server.", True),
    "source_missing": ("The uploaded video file is no longer in storage.", False),
    "storage_unavailable": ("Storage was not available. You can retry.", True),
    "worker_lost": ("The processing worker stopped responding. You can retry.", True),
    "timeout": ("The job took longer than the time allowed. You can retry.", True),
    "engine_error": ("Processing failed unexpectedly. You can retry; quote the diagnostic id if it keeps failing.", True),
}

_JOB_COLS = """j.id, j.organization_id, j.project_id, j.upload_id, j.configuration_id, j.rerun_of_job_id, j.status, j.stage,
  j.progress_percent, j.frames_total, j.frames_done, j.processing_fps, j.attempt_no, j.is_retryable, j.error_code, j.safe_message,
  j.diagnostic_id, j.cancel_requested_at, j.metadata_snapshot, j.worker_id, j.device, j.model_name, j.model_file_name,
  j.model_file_sha256, j.code_version, j.timeout_seconds, j.queued_at, j.started_at, j.finished_at, j.last_heartbeat_at,
  j.created_at, j.created_by"""


class LostOwnership(Exception):
    """The worker no longer owns this job attempt; it must stop and write nothing."""


def _job_not_found() -> AppError:
    return AppError("job_not_found", 404, "That job was not found.")


# --- creation ---------------------------------------------------------------------

def create_job(db: Session, *, org: Any, user_id: Any, project_id: UUID, upload_id: UUID, configuration_id: UUID | None,
               idempotency_key: str | None, rerun_of: UUID | None = None, source_exists: Any = None) -> tuple[dict[str, Any], bool]:
    """Returns (job, replayed). `source_exists` is a callable (storage_key) -> bool: True, False, or raises when storage is down."""
    if idempotency_key:
        prior = db.execute(text(f"SELECT {_JOB_COLS} FROM jobs j WHERE j.organization_id = :o AND j.idempotency_key = :k"),
                           {"o": org, "k": idempotency_key}).mappings().first()
        if prior is not None:
            if prior["upload_id"] != upload_id:
                raise AppError("idempotency_key_reused", 409, "That Idempotency-Key was used for a different video.")
            return dict(prior), True
    row = db.execute(
        text("""SELECT u.status, u.source_deleted_at, u.storage_key, u.original_name, u.duration_seconds, u.width_px, u.height_px,
                       u.frame_rate, u.frame_count, u.camera_id, u.road_name, u.recorded_date, u.recorded_start_time,
                       u.recorded_end_time, u.weather, u.notes, p.archived_at, p.name AS project_name
                FROM uploads u JOIN projects p ON p.id = u.project_id
                WHERE u.id = :u AND u.project_id = :p AND u.organization_id = :o FOR UPDATE OF u"""),
        {"u": upload_id, "p": project_id, "o": org},
    ).mappings().first()
    if row is None or row["status"] != "ready":
        db.rollback()
        raise AppError("upload_not_found", 404, "That video was not found.")
    if row["archived_at"] is not None:
        db.rollback()
        raise AppError("project_archived", 409, "This project is archived. Restore it before processing.")
    if row["source_deleted_at"] is not None:
        db.rollback()
        raise AppError("source_removed", 410, "The video file has been removed, so it cannot be processed.")
    if source_exists is not None:
        try:
            present = source_exists(row["storage_key"])
        except Exception:
            db.rollback()
            raise AppError("storage_unavailable", 503, "Video storage is not available right now. Please try again.")
        if not present:
            db.rollback()
            raise AppError("source_removed", 410, "The video file is missing from storage, so it cannot be processed.")
    cfg = db.execute(
        text("""SELECT id, version_no, model_name, tracker, classes, bucket_seconds, frame_skip, batch_size, confidence_threshold,
                       iou_threshold, generate_report, annotated_output,
                       (SELECT count(*) FROM counting_lines l WHERE l.configuration_id = c.id)
                       + (SELECT count(*) FROM counting_zones z WHERE z.configuration_id = c.id) AS targets
                FROM analysis_configurations c WHERE c.upload_id = :u AND c.organization_id = :o
                AND (CAST(:c AS uuid) IS NULL OR c.id = :c) ORDER BY version_no DESC LIMIT 1"""),
        {"u": upload_id, "o": org, "c": configuration_id},
    ).mappings().first()
    if cfg is None:
        db.rollback()
        raise AppError("configuration_missing", 409, "Save the analysis settings, with at least one counting line or zone, first.")
    if cfg["targets"] == 0:
        db.rollback()
        raise AppError("configuration_empty", 409, "The analysis settings need at least one counting line or zone.")
    active = db.execute(text("SELECT count(*) FROM jobs WHERE organization_id = :o AND status IN ('queued','running')"), {"o": org}).scalar_one()
    if active >= settings.org_max_active_jobs:
        db.rollback()
        raise AppError("too_many_jobs", 429, f"Your organisation already has {active} jobs waiting or running. Wait for some to finish.")
    if rerun_of is not None:
        ok = db.execute(text("SELECT 1 FROM jobs WHERE id = :r AND project_id = :p AND organization_id = :o"),
                        {"r": rerun_of, "p": project_id, "o": org}).first()
        if ok is None:
            db.rollback()
            raise _job_not_found()
    snapshot = {
        "project": {"id": str(project_id), "name": row["project_name"]},
        "video": {"id": str(upload_id), "name": row["original_name"], "durationSeconds": float(row["duration_seconds"]),
                  "widthPx": row["width_px"], "heightPx": row["height_px"], "frameRate": float(row["frame_rate"]),
                  "frameCount": row["frame_count"]},
        "metadata": {"cameraId": row["camera_id"], "roadName": row["road_name"],
                     "recordedDate": row["recorded_date"].isoformat() if row["recorded_date"] else None,
                     "recordedStartTime": row["recorded_start_time"].isoformat() if row["recorded_start_time"] else None,
                     "recordedEndTime": row["recorded_end_time"].isoformat() if row["recorded_end_time"] else None,
                     "weather": row["weather"], "notes": row["notes"]},
        "configuration": {"id": str(cfg["id"]), "version": cfg["version_no"], "model": cfg["model_name"], "tracker": cfg["tracker"],
                          "classes": cfg["classes"], "bucketSeconds": cfg["bucket_seconds"], "frameSkip": cfg["frame_skip"],
                          "batchSize": cfg["batch_size"], "confidenceThreshold": float(cfg["confidence_threshold"]),
                          "iouThreshold": float(cfg["iou_threshold"]), "generateReport": cfg["generate_report"],
                          "annotatedOutput": cfg["annotated_output"]},
    }
    try:
        with db.begin_nested():
            jid = db.execute(
                text("""INSERT INTO jobs (organization_id, project_id, upload_id, configuration_id, idempotency_key, rerun_of_job_id,
                                          metadata_snapshot, created_by)
                        VALUES (:o, :p, :u, :c, :k, :r, CAST(:s AS jsonb), :by) RETURNING id"""),
                {"o": org, "p": project_id, "u": upload_id, "c": cfg["id"], "k": idempotency_key, "r": rerun_of,
                 "s": json.dumps(snapshot), "by": user_id},
            ).scalar_one()
    except IntegrityError:
        db.rollback()
        raise AppError("job_in_progress", 409, "That request is already being handled. Try again in a moment.")
    audit_repository.record(db, action="job_created", organization_id=org, actor_user_id=user_id, entity_type="job", entity_id=jid,
                            details={"uploadId": str(upload_id), "configurationVersion": cfg["version_no"], "rerun": rerun_of is not None})
    db.commit()
    return get_job(db, org, jid), False


# --- reading ----------------------------------------------------------------------

def get_job(db: Session, org: Any, job_id: UUID, project_id: UUID | None = None) -> dict[str, Any]:
    row = db.execute(text(f"SELECT {_JOB_COLS} FROM jobs j WHERE j.id = :j AND j.organization_id = :o AND (CAST(:p AS uuid) IS NULL OR j.project_id = :p)"),
                     {"j": job_id, "o": org, "p": project_id}).mappings().first()
    if row is None:
        raise _job_not_found()
    out = dict(row)
    if out["status"] == "queued":
        out["queue_position"] = db.execute(
            # Counted within the caller's organisation only: other organisations' activity is not shown.
            text("SELECT count(*) + 1 FROM jobs WHERE status = 'queued' AND organization_id = :o AND (queued_at, id) < (:q, :i)"),
            {"q": out["queued_at"], "i": out["id"], "o": out["organization_id"]}).scalar_one()
    return out


def list_jobs(db: Session, org: Any, *, status: str | None, project_id: UUID | None, limit: int, offset: int) -> tuple[list[dict[str, Any]], int]:
    where, params = ["j.organization_id = :o"], {"o": org, "limit": limit, "offset": offset}
    if status:
        where.append("j.status = :s")
        params["s"] = status
    if project_id:
        where.append("j.project_id = :p")
        params["p"] = project_id
    clause = " AND ".join(where)
    total = db.execute(text(f"SELECT count(*) FROM jobs j WHERE {clause}"), params).scalar_one()
    rows = db.execute(text(f"SELECT {_JOB_COLS} FROM jobs j WHERE {clause} ORDER BY j.queued_at DESC, j.id LIMIT :limit OFFSET :offset"),
                      params).mappings().all()
    return [dict(r) for r in rows], int(total)


def list_events(db: Session, org: Any, job_id: UUID, after_id: int, limit: int) -> list[dict[str, Any]]:
    get_job(db, org, job_id)
    rows = db.execute(text("""SELECT id, attempt_no, at, level, event_code, message FROM job_events WHERE job_id = :j AND id > :a
                              ORDER BY id LIMIT :l"""), {"j": job_id, "a": after_id, "l": limit}).mappings().all()
    return [dict(r) for r in rows]


def list_attempts(db: Session, org: Any, job_id: UUID) -> list[dict[str, Any]]:
    get_job(db, org, job_id)
    rows = db.execute(text("""SELECT attempt_no, outcome, started_at, finished_at, worker_id, device, error_code, diagnostic_id
                              FROM job_attempts WHERE job_id = :j ORDER BY attempt_no"""), {"j": job_id}).mappings().all()
    return [dict(r) for r in rows]


def get_result(db: Session, org: Any, job_id: UUID) -> dict[str, Any] | None:
    job = get_job(db, org, job_id)
    if job["status"] != "completed":
        return None
    res = db.execute(text("SELECT * FROM job_results WHERE job_id = :j"), {"j": job_id}).mappings().first()
    if res is None:
        return None
    buckets = db.execute(text("""SELECT bucket_index, bucket_start_s, vehicle_class, direction, line_id, zone_id, vehicle_count, confidence_mean
                                 FROM count_buckets WHERE result_id = :r ORDER BY bucket_index, vehicle_class, direction, line_id, zone_id"""),
                         {"r": res["id"]}).mappings().all()
    arts = db.execute(text("""SELECT id, kind, content_type, size_bytes, created_at FROM job_artifacts WHERE job_id = :j AND deleted_at IS NULL
                              ORDER BY created_at"""), {"j": job_id}).mappings().all()
    return {"result": dict(res), "buckets": [dict(b) for b in buckets], "artifacts": [dict(a) for a in arts], "job": job}


def get_artifact(db: Session, org: Any, job_id: UUID, kind: str) -> dict[str, Any]:
    job = get_job(db, org, job_id)
    row = db.execute(text("""SELECT id, kind, storage_key, content_type, size_bytes FROM job_artifacts
                             WHERE job_id = :j AND kind = :k AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 1"""),
                     {"j": job_id, "k": kind}).mappings().first()
    if row is None or job["status"] != "completed":
        raise AppError("artifact_not_found", 404, "That file was not found.")
    return dict(row)


# --- cancel, retry, rerun ---------------------------------------------------------

def request_cancel(db: Session, *, org: Any, user_id: Any, job_id: UUID) -> dict[str, Any]:
    row = db.execute(text("SELECT status, cancel_requested_at FROM jobs WHERE id = :j AND organization_id = :o FOR UPDATE"),
                     {"j": job_id, "o": org}).mappings().first()
    if row is None:
        db.rollback()
        raise _job_not_found()
    if row["status"] == "queued":
        db.execute(text("""UPDATE jobs SET status = 'cancelled', cancel_requested_at = now(), cancel_requested_by = :u, finished_at = now(),
                           stage = 'cancelled', updated_at = now() WHERE id = :j"""), {"u": user_id, "j": job_id})
        audit_repository.record(db, action="job_cancelled", organization_id=org, actor_user_id=user_id, entity_type="job", entity_id=job_id)
    elif row["status"] == "running":
        if row["cancel_requested_at"] is None:
            db.execute(text("UPDATE jobs SET cancel_requested_at = now(), cancel_requested_by = :u, stage = 'cancelling', updated_at = now() WHERE id = :j"),
                       {"u": user_id, "j": job_id})
            audit_repository.record(db, action="job_cancel_requested", organization_id=org, actor_user_id=user_id, entity_type="job", entity_id=job_id)
    else:
        db.rollback()
        raise AppError("job_not_cancellable", 409, f"A job that is {row['status']} cannot be cancelled.")
    db.commit()
    return get_job(db, org, job_id)


def retry(db: Session, *, org: Any, user_id: Any, job_id: UUID, source_exists: Any = None) -> dict[str, Any]:
    """Same job, new attempt (O57). Only a failed job the system marked retryable; the source must still exist."""
    row = db.execute(text("""SELECT j.status, j.is_retryable, j.attempt_no, u.source_deleted_at, u.storage_key
                             FROM jobs j JOIN uploads u ON u.id = j.upload_id WHERE j.id = :j AND j.organization_id = :o
                             FOR UPDATE OF j, u"""), {"j": job_id, "o": org}).mappings().first()
    if row is None:
        db.rollback()
        raise _job_not_found()
    if row["status"] != "failed" or not row["is_retryable"]:
        db.rollback()
        raise AppError("job_not_retryable", 409, "Only a failed job that can be retried may be retried.")
    if row["source_deleted_at"] is not None:
        db.rollback()
        raise AppError("source_removed", 410, "The video file has been removed, so it cannot be processed.")
    if source_exists is not None:
        try:
            present = source_exists(row["storage_key"])
        except Exception:
            db.rollback()
            raise AppError("storage_unavailable", 503, "Video storage is not available right now. Please try again.")
        if not present:
            db.rollback()
            raise AppError("source_removed", 410, "The video file is missing from storage, so it cannot be processed.")
    db.execute(text("""UPDATE jobs SET status = 'queued', attempt_no = attempt_no + 1, progress_percent = 0, frames_done = 0, frames_total = NULL,
                       processing_fps = NULL, stage = 'queued', error_code = NULL, safe_message = NULL, diagnostic_id = NULL,
                       is_retryable = false, cancel_requested_at = NULL, cancel_requested_by = NULL, worker_id = NULL, finished_at = NULL,
                       started_at = NULL, last_heartbeat_at = NULL, queued_at = now(), updated_at = now() WHERE id = :j"""), {"j": job_id})
    audit_repository.record(db, action="job_retried", organization_id=org, actor_user_id=user_id, entity_type="job", entity_id=job_id,
                            details={"attempt": row["attempt_no"] + 1})
    db.commit()
    return get_job(db, org, job_id)


# --- worker side (fenced) -----------------------------------------------------------

def claim_next(db: Session, worker_id: str) -> dict[str, Any] | None:
    row = db.execute(
        text("""UPDATE jobs SET status = 'running', started_at = now(), last_heartbeat_at = now(), worker_id = :w, stage = 'starting',
                       progress_percent = 0, frames_done = 0, updated_at = now()
                WHERE id = (SELECT id FROM jobs WHERE status = 'queued' AND cancel_requested_at IS NULL
                            ORDER BY queued_at, id FOR UPDATE SKIP LOCKED LIMIT 1)
                RETURNING id, attempt_no, organization_id"""), {"w": worker_id}).mappings().first()
    if row is None:
        db.rollback()
        return None
    db.execute(text("INSERT INTO job_attempts (job_id, attempt_no, worker_id) VALUES (:j, :a, :w)"),
               {"j": row["id"], "a": row["attempt_no"], "w": worker_id})
    _event(db, row["id"], row["attempt_no"], "info", "claimed", "A worker picked up this job.")
    db.commit()
    return get_job(db, row["organization_id"], row["id"])


def _fence(db: Session, job_id: Any, worker_id: str, attempt: int) -> dict[str, Any]:
    """Lock the job row and prove this worker still owns this attempt. Raises LostOwnership otherwise."""
    row = db.execute(text("""SELECT status, worker_id, attempt_no, cancel_requested_at, organization_id FROM jobs WHERE id = :j FOR UPDATE"""),
                     {"j": job_id}).mappings().first()
    if row is None or row["status"] != "running" or row["worker_id"] != worker_id or row["attempt_no"] != attempt:
        db.rollback()
        raise LostOwnership()
    return dict(row)


def _event(db: Session, job_id: Any, attempt: int, level: str, code: str, message: str) -> None:
    db.execute(text("INSERT INTO job_events (job_id, attempt_no, level, event_code, message) VALUES (:j, :a, :l, :c, :m)"),
               {"j": job_id, "a": attempt, "l": level, "c": code, "m": message})


def add_event(db: Session, job_id: Any, worker_id: str, attempt: int, level: str, code: str, message: str) -> None:
    _fence(db, job_id, worker_id, attempt)
    _event(db, job_id, attempt, level, code, message)
    db.commit()


def set_run_info(db: Session, job_id: Any, worker_id: str, attempt: int, *, device: str, model_name: str, model_file_name: str,
                 model_sha: str, code_version: str, frames_total: int | None) -> None:
    _fence(db, job_id, worker_id, attempt)
    db.execute(text("""UPDATE jobs SET device = :d, model_name = :m, model_file_name = :f, model_file_sha256 = :s, code_version = :c,
                       frames_total = :t, stage = 'detecting', updated_at = now() WHERE id = :j"""),
               {"d": device, "m": model_name, "f": model_file_name, "s": model_sha, "c": code_version, "t": frames_total, "j": job_id})
    db.execute(text("UPDATE job_attempts SET device = :d WHERE job_id = :j AND attempt_no = :a"), {"d": device, "j": job_id, "a": attempt})
    db.commit()


def heartbeat(db: Session, job_id: Any, worker_id: str, attempt: int) -> dict[str, Any]:
    """Returns {cancel: bool}. Raises LostOwnership when the job is no longer this worker's."""
    row = _fence(db, job_id, worker_id, attempt)
    db.execute(text("UPDATE jobs SET last_heartbeat_at = now() WHERE id = :j"), {"j": job_id})
    db.commit()
    return {"cancel": row["cancel_requested_at"] is not None}


def progress(db: Session, job_id: Any, worker_id: str, attempt: int, *, frames_done: int, frames_total: int | None, percent: int, fps: float) -> None:
    _fence(db, job_id, worker_id, attempt)
    # An estimate that turned out too small clears the total in the same statement (FD13), so the CHECK never fails.
    db.execute(text("""UPDATE jobs SET frames_done = :d, frames_total = CASE WHEN :t IS NULL OR :d > :t THEN NULL ELSE :t END,
                       progress_percent = CASE WHEN :t IS NULL OR :d > :t THEN 0 ELSE LEAST(:p, 99) END, processing_fps = :f,
                       last_heartbeat_at = now(), updated_at = now() WHERE id = :j"""),
               {"d": frames_done, "t": frames_total, "p": percent, "f": fps, "j": job_id})
    db.commit()


def complete(db: Session, job_id: Any, worker_id: str, attempt: int, *, run: Any, bucket_seconds: int, model_name: str, model_sha: str,
             code_version: str, artifact: dict[str, Any] | None) -> str:
    """Store the result and complete the job in ONE transaction. Returns 'completed', or 'cancelled' when a cancel was requested first."""
    row = _fence(db, job_id, worker_id, attempt)
    org = row["organization_id"]
    if row["cancel_requested_at"] is not None:
        _finish(db, job_id, attempt, "cancelled", None, None)
        _event(db, job_id, attempt, "warn", "cancelled", "The job was cancelled before it finished; nothing was saved.")
        audit_repository.record(db, action="job_cancelled", organization_id=org, actor_kind="system", entity_type="job", entity_id=job_id)
        notification_repository.for_job(db, job_id, "job_cancelled", "Job cancelled")
        db.commit()
        return "cancelled"
    info = db.execute(text("SELECT upload_id, configuration_id FROM jobs WHERE id = :j"), {"j": job_id}).mappings().one()
    conf = run.confidence or (None, None, None)
    rid = db.execute(
        text("""INSERT INTO job_results (job_id, upload_id, configuration_id, model_name, model_file_sha256, code_version, method, bucket_seconds,
                       frames_processed, detections_total, tracks_total, vehicles_counted, confidence_mean, confidence_min, confidence_max)
                VALUES (:j, :u, :c, :m, :s, :v, :meth, :b, :fp, :dt, :tt, :vc, :cm, :cmin, :cmax) RETURNING id"""),
        {"j": job_id, "u": info["upload_id"], "c": info["configuration_id"], "m": model_name, "s": model_sha, "v": code_version,
         "meth": run.method, "b": bucket_seconds, "fp": run.frames_processed, "dt": run.detections_total, "tt": run.tracks_total,
         "vc": run.vehicles_counted, "cm": conf[0], "cmin": conf[1], "cmax": conf[2]}).scalar_one()
    for b in run.buckets:
        db.execute(
            text("""INSERT INTO count_buckets (result_id, job_id, upload_id, configuration_id, bucket_index, bucket_start_s, vehicle_class,
                           direction, line_id, zone_id, vehicle_count, confidence_mean)
                    VALUES (:r, :j, :u, :c, :bi, :bs, :vc, :d, CAST(:l AS uuid), CAST(:z AS uuid), :n, :cm)"""),
            {"r": rid, "j": job_id, "u": info["upload_id"], "c": info["configuration_id"], "bi": b["bucket_index"], "bs": b["bucket_start_s"],
             "vc": b["vehicle_class"], "d": b["direction"], "l": b["line_id"], "z": b["zone_id"], "n": b["vehicle_count"],
             "cm": b["confidence_mean"]})
    if artifact:
        db.execute(text("""INSERT INTO job_artifacts (job_id, kind, storage_key, content_type, size_bytes, checksum_sha256)
                           VALUES (:j, :k, :sk, :ct, :sz, :cs)"""),
                   {"j": job_id, "k": artifact["kind"], "sk": artifact["storage_key"], "ct": artifact["content_type"],
                    "sz": artifact["size_bytes"], "cs": artifact["checksum"]})
    db.execute(text("""UPDATE jobs SET status = 'completed', progress_percent = 100, stage = 'completed', frames_done = :f, frames_total = :f,
                       finished_at = now(), updated_at = now() WHERE id = :j"""), {"f": run.frames_processed, "j": job_id})
    db.execute(text("UPDATE job_attempts SET outcome = 'completed', finished_at = now() WHERE job_id = :j AND attempt_no = :a"), {"j": job_id, "a": attempt})
    _event(db, job_id, attempt, "success", "completed", f"Finished: {run.vehicles_counted} vehicles counted (an estimate).")
    audit_repository.record(db, action="job_completed", organization_id=org, actor_kind="system", entity_type="job", entity_id=job_id,
                            details={"vehicles": run.vehicles_counted})
    notification_repository.for_job(db, job_id, "job_completed", "Job completed",
                                    f"{run.vehicles_counted} vehicles counted (an estimate).")
    db.commit()   # the deferred "completed needs a result" trigger runs here
    return "completed"


def _finish(db: Session, job_id: Any, attempt: int, outcome: str, code: str | None, diagnostic: str | None) -> None:
    if outcome == "cancelled":
        db.execute(text("UPDATE jobs SET status = 'cancelled', finished_at = now(), stage = 'cancelled', updated_at = now() WHERE id = :j"), {"j": job_id})
    db.execute(text("UPDATE job_attempts SET outcome = :o, finished_at = now(), error_code = :c, diagnostic_id = :d WHERE job_id = :j AND attempt_no = :a"),
               {"o": outcome, "c": code, "d": diagnostic, "j": job_id, "a": attempt})


def fail(db: Session, job_id: Any, worker_id: str, attempt: int, code: str, diagnostic_id: str) -> None:
    row = _fence(db, job_id, worker_id, attempt)
    message, retryable = SAFE_MESSAGES.get(code, SAFE_MESSAGES["engine_error"])
    db.execute(text("""UPDATE jobs SET status = 'failed', stage = 'failed', error_code = :c, safe_message = :m, diagnostic_id = :d, is_retryable = :r,
                       finished_at = now(), updated_at = now() WHERE id = :j"""),
               {"c": code, "m": message, "d": diagnostic_id, "r": retryable, "j": job_id})
    _finish(db, job_id, attempt, "failed", code, diagnostic_id)
    _event(db, job_id, attempt, "error", code, message)
    audit_repository.record(db, action="job_failed", organization_id=row["organization_id"], actor_kind="system", entity_type="job", entity_id=job_id,
                            outcome="failed", reason_code=code)
    notification_repository.for_job(db, job_id, "job_failed", "Job failed", message)
    db.commit()


def confirm_cancelled(db: Session, job_id: Any, worker_id: str, attempt: int) -> None:
    row = _fence(db, job_id, worker_id, attempt)
    _finish(db, job_id, attempt, "cancelled", None, None)
    _event(db, job_id, attempt, "warn", "cancelled", "The job was cancelled.")
    audit_repository.record(db, action="job_cancelled", organization_id=row["organization_id"], actor_kind="system", entity_type="job", entity_id=job_id)
    notification_repository.for_job(db, job_id, "job_cancelled", "Job cancelled")
    db.commit()


def recover_stale(db: Session, stale_seconds: int) -> list[str]:
    """Jobs left 'running' by a worker that stopped: failed with a retryable code. Safe to run from any worker, any time."""
    rows = db.execute(text("""SELECT id, attempt_no, organization_id FROM jobs WHERE status = 'running'
                              AND coalesce(last_heartbeat_at, started_at) < now() - make_interval(secs => :s) FOR UPDATE SKIP LOCKED"""),
                      {"s": stale_seconds}).mappings().all()
    recovered = []
    for r in rows:
        diag = uuid.uuid4().hex[:12]
        message, _ = SAFE_MESSAGES["worker_lost"]
        db.execute(text("""UPDATE jobs SET status = 'failed', stage = 'failed', error_code = 'worker_lost', safe_message = :m, diagnostic_id = :d,
                           is_retryable = true, finished_at = now(), updated_at = now() WHERE id = :j"""), {"m": message, "d": diag, "j": r["id"]})
        db.execute(text("UPDATE job_attempts SET outcome = 'failed', finished_at = now(), error_code = 'worker_lost', diagnostic_id = :d WHERE job_id = :j AND attempt_no = :a"),
                   {"d": diag, "j": r["id"], "a": r["attempt_no"]})
        _event(db, r["id"], r["attempt_no"], "error", "worker_lost", message)
        audit_repository.record(db, action="job_failed", organization_id=r["organization_id"], actor_kind="system", entity_type="job",
                                entity_id=r["id"], outcome="failed", reason_code="worker_lost")
        notification_repository.for_job(db, r["id"], "job_failed", "Job failed", message)
        recovered.append(str(r["id"]))
    db.commit()
    return recovered


def run_context(db: Session, job_id: Any) -> dict[str, Any]:
    """Everything the worker needs to process a claimed job, read from the stored snapshot and configuration."""
    row = db.execute(text("""SELECT j.id, j.organization_id, j.project_id, j.upload_id, j.configuration_id, j.attempt_no, u.storage_key,
                                    u.width_px, u.height_px, u.frame_rate, u.frame_count, c.tracker, c.classes, c.bucket_seconds, c.frame_skip,
                                    c.batch_size, c.confidence_threshold, c.iou_threshold, c.annotated_output, c.model_name, j.timeout_seconds
                             FROM jobs j JOIN uploads u ON u.id = j.upload_id JOIN analysis_configurations c ON c.id = j.configuration_id
                             WHERE j.id = :j"""), {"j": job_id}).mappings().one()
    lines = db.execute(text("SELECT id, x1, y1, x2, y2, direction FROM counting_lines WHERE configuration_id = :c ORDER BY sort_order, id"),
                       {"c": row["configuration_id"]}).mappings().all()
    zones = db.execute(text("""SELECT z.id, (SELECT json_agg(json_build_array(p.x, p.y) ORDER BY p.seq) FROM zone_points p WHERE p.zone_id = z.id) AS pts
                               FROM counting_zones z WHERE z.configuration_id = :c ORDER BY z.sort_order, z.id"""), {"c": row["configuration_id"]}).mappings().all()
    return {**dict(row), "lines": [dict(x) for x in lines], "zones": [dict(z) for z in zones]}
