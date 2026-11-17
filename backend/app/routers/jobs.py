"""Processing jobs (F28, F35, F36): create from a ready video, list, read, follow events, cancel, retry, rerun, read results,
download the annotated video. The API only records the request; the worker (app/worker) does the processing.
Any member may create, cancel, retry and rerun jobs of their organisation (proposal)."""
import re
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, Header, Query, Response
from fastapi.responses import FileResponse
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session

from app.auth.deps import Principal, current_member
from app.core.errors import AppError
from app.database.database import get_db
from app.repositories import job_repository as repo
from app.storage import StorageKeyError, StorageUnavailable, key_belongs_to, storage

router = APIRouter(tags=["jobs"])
_KEY = re.compile(r"^[A-Za-z0-9._:\-]{8,100}$")
STATUSES = ("queued", "running", "completed", "failed", "cancelled")


def _source_exists(key: str) -> bool:
    return storage.exists("sources", key)


def _iso(v: Any) -> str | None:
    return v.isoformat() if v is not None else None


def _view(j: dict[str, Any]) -> dict[str, Any]:
    snap = j["metadata_snapshot"]
    return {
        "id": str(j["id"]), "projectId": str(j["project_id"]), "uploadId": str(j["upload_id"]), "configurationId": str(j["configuration_id"]),
        "rerunOfJobId": str(j["rerun_of_job_id"]) if j["rerun_of_job_id"] else None,
        "status": j["status"], "stage": j["stage"], "progressPercent": j["progress_percent"],
        # No total means no percentage and no time estimate (never a made-up one).
        "framesDone": j["frames_done"], "framesTotal": j["frames_total"], "processingFps": float(j["processing_fps"]) if j["processing_fps"] is not None else None,
        "attempt": j["attempt_no"], "retryable": bool(j["is_retryable"]) if j["status"] == "failed" else False,
        "error": {"code": j["error_code"], "message": j["safe_message"], "diagnosticId": j["diagnostic_id"]} if j["status"] == "failed" else None,
        "cancelRequested": j["cancel_requested_at"] is not None and j["status"] == "running",
        "queuePosition": j.get("queue_position"),
        "device": j["device"], "model": j["model_name"], "modelFile": j["model_file_name"],
        "videoName": snap.get("video", {}).get("name"), "projectName": snap.get("project", {}).get("name"),
        "queuedAt": _iso(j["queued_at"]), "startedAt": _iso(j["started_at"]), "finishedAt": _iso(j["finished_at"]), "lastHeartbeatAt": _iso(j["last_heartbeat_at"]),
    }


class JobCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    configurationId: UUID | None = None   # default: the latest saved version


def _key(value: str | None) -> str | None:
    if value is not None and not _KEY.fullmatch(value):
        raise AppError("invalid_idempotency_key", 422, "The Idempotency-Key header must be 8 to 100 letters, digits or . _ : -")
    return value


@router.post("/projects/{project_id}/uploads/{upload_id}/jobs", status_code=201, summary="Queue a processing job for a video")
def create_job(project_id: UUID, upload_id: UUID, response: Response, body: JobCreate | None = None,
               idempotency_key: str | None = Header(None, alias="Idempotency-Key"), who: Principal = Depends(current_member),
               db: Session = Depends(get_db)):
    job, replayed = repo.create_job(db, org=who.organization_id, user_id=who.user["id"], project_id=project_id, upload_id=upload_id,
                                    configuration_id=body.configurationId if body else None, idempotency_key=_key(idempotency_key),
                                    source_exists=_source_exists)
    if replayed:
        response.status_code = 200
    return {"job": _view(job), "replayed": replayed}


@router.get("/jobs", summary="Jobs of your organisation")
def list_jobs(status: str | None = Query(None), projectId: UUID | None = None, limit: int = Query(20, ge=1, le=100),
              offset: int = Query(0, ge=0, le=100000), who: Principal = Depends(current_member), db: Session = Depends(get_db)):
    if status is not None and status not in STATUSES:
        raise AppError("invalid_input", 422, f"status must be one of: {', '.join(STATUSES)}.")
    items, total = repo.list_jobs(db, who.organization_id, status=status, project_id=projectId, limit=limit, offset=offset)
    return {"items": [_view(j) for j in items], "total": total, "limit": limit, "offset": offset}


@router.get("/jobs/{job_id}", summary="One job")
def read_job(job_id: UUID, who: Principal = Depends(current_member), db: Session = Depends(get_db)):
    return {"job": _view(repo.get_job(db, who.organization_id, job_id))}


@router.get("/jobs/{job_id}/events", summary="Log lines of a job")
def read_events(job_id: UUID, after: int = Query(0, ge=0), limit: int = Query(100, ge=1, le=500), who: Principal = Depends(current_member),
                db: Session = Depends(get_db)):
    ev = repo.list_events(db, who.organization_id, job_id, after, limit)
    return {"items": [{"id": e["id"], "attempt": e["attempt_no"], "at": _iso(e["at"]), "level": e["level"], "code": e["event_code"], "message": e["message"]} for e in ev]}


@router.get("/jobs/{job_id}/attempts", summary="Every attempt of a job")
def read_attempts(job_id: UUID, who: Principal = Depends(current_member), db: Session = Depends(get_db)):
    return {"items": [{"attempt": a["attempt_no"], "outcome": a["outcome"], "startedAt": _iso(a["started_at"]), "finishedAt": _iso(a["finished_at"]),
                       "device": a["device"], "errorCode": a["error_code"], "diagnosticId": a["diagnostic_id"]}
                      for a in repo.list_attempts(db, who.organization_id, job_id)]}


@router.post("/jobs/{job_id}/cancel", summary="Cancel a queued or running job")
def cancel_job(job_id: UUID, who: Principal = Depends(current_member), db: Session = Depends(get_db)):
    return {"job": _view(repo.request_cancel(db, org=who.organization_id, user_id=who.user["id"], job_id=job_id))}


@router.post("/jobs/{job_id}/retry", summary="Retry a failed job (a new attempt of the same job)")
def retry_job(job_id: UUID, who: Principal = Depends(current_member), db: Session = Depends(get_db)):
    return {"job": _view(repo.retry(db, org=who.organization_id, user_id=who.user["id"], job_id=job_id, source_exists=_source_exists))}


@router.post("/jobs/{job_id}/rerun", status_code=201, summary="Run the same video and settings again as a NEW job")
def rerun_job(job_id: UUID, response: Response, idempotency_key: str | None = Header(None, alias="Idempotency-Key"),
              who: Principal = Depends(current_member), db: Session = Depends(get_db)):
    old = repo.get_job(db, who.organization_id, job_id)
    if old["status"] not in ("completed", "failed", "cancelled"):
        raise AppError("job_not_finished", 409, "Only a finished job can be run again.")
    # With an Idempotency-Key, a repeated click or a retried request returns the same new job instead of another one.
    job, replayed = repo.create_job(db, org=who.organization_id, user_id=who.user["id"], project_id=old["project_id"], upload_id=old["upload_id"],
                                    configuration_id=old["configuration_id"], idempotency_key=_key(idempotency_key), rerun_of=old["id"],
                                    source_exists=_source_exists)
    if replayed:
        response.status_code = 200
    return {"job": _view(job), "replayed": replayed}


@router.get("/jobs/{job_id}/results", summary="Counts of a completed job (estimates)")
def read_results(job_id: UUID, who: Principal = Depends(current_member), db: Session = Depends(get_db)):
    got = repo.get_result(db, who.organization_id, job_id)
    if got is None:
        raise AppError("result_not_available", 404, "This job has no result (it has not completed).")
    r = got["result"]
    by_class: dict[str, int] = {}
    for b in got["buckets"]:
        by_class[b["vehicle_class"]] = by_class.get(b["vehicle_class"], 0) + b["vehicle_count"]
    return {
        "job": _view(got["job"]), "isEstimate": r["is_estimate"], "method": r["method"], "bucketSeconds": r["bucket_seconds"],
        "timeBase": r["time_base"], "framesProcessed": r["frames_processed"], "detectionsTotal": r["detections_total"],
        "tracksTotal": r["tracks_total"], "vehiclesCounted": r["vehicles_counted"],
        "confidence": {"mean": r["confidence_mean"], "min": r["confidence_min"], "max": r["confidence_max"]},
        "provenance": {"model": r["model_name"], "modelSha256": r["model_file_sha256"], "codeVersion": r["code_version"], "device": got["job"]["device"]},
        "totalsByClass": by_class,
        "buckets": [{"index": b["bucket_index"], "startSeconds": float(b["bucket_start_s"]), "class": b["vehicle_class"], "direction": b["direction"],
                     "lineId": str(b["line_id"]) if b["line_id"] else None, "zoneId": str(b["zone_id"]) if b["zone_id"] else None,
                     "count": b["vehicle_count"], "confidenceMean": b["confidence_mean"]} for b in got["buckets"]],
        "artifacts": [{"id": str(a["id"]), "kind": a["kind"], "contentType": a["content_type"], "sizeBytes": a["size_bytes"]} for a in got["artifacts"]],
    }


@router.get("/jobs/{job_id}/annotated-video", summary="The video with boxes, ids and lines drawn on it")
def annotated_video(job_id: UUID, who: Principal = Depends(current_member), db: Session = Depends(get_db)):
    art = repo.get_artifact(db, who.organization_id, job_id, "annotated_video")
    key = art["storage_key"]
    try:
        if not key_belongs_to(key, who.organization_id):
            raise AppError("artifact_not_found", 404, "That file was not found.")
        if not storage.exists("outputs", key):
            raise AppError("artifact_not_found", 404, "That file was not found.")
        path = storage.resolve("outputs", key)
    except (StorageUnavailable, StorageKeyError):
        raise AppError("storage_unavailable", 503, "Video storage is not available right now. Please try again.")
    return FileResponse(path, media_type=art["content_type"], headers={"Cache-Control": "private, max-age=300", "X-Content-Type-Options": "nosniff"})
