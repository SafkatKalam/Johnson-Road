from pathlib import Path
from uuid import uuid4
import logging
import time

from fastapi import BackgroundTasks, UploadFile

from app.ai import ai_pipeline
from app.repositories.processing_repository import ProcessingRepository
from app.repositories.upload_repository import UploadRepository

UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)

logger = logging.getLogger("johnsonroad.upload")

_repository = UploadRepository()
_processing_repository = ProcessingRepository()


def get_upload_initial_state() -> dict:
    return {
        "files": _repository.get_initial_files(),
        "locationSuggestions": _repository.get_location_suggestions(),
    }


def save_uploaded_file(file: UploadFile) -> dict:
    upload_id = uuid4().hex[:12]
    target_path = UPLOAD_DIR / f"{upload_id}_{file.filename}"
    with target_path.open("wb") as buffer:
        buffer.write(file.file.read())
    return {
        "id": upload_id,
        "filename": file.filename,
        "path": str(target_path),
        "size": target_path.stat().st_size,
    }


def create_mock_processing_job(filename: str, source_path: str) -> dict:
    job_id = f"job_{uuid4().hex[:8]}"
    job = {
        "id": job_id,
        "projectName": filename.rsplit(".", 1)[0],
        "projectId": "",
        "sourcePath": source_path,
        "progress": 0,
        "eta": "Queued",
        "status": "queued",
        "priority": "normal",
        "stage": "Queued",
        "fps": 0,
        "gpu": 0,
        "cpu": 0,
        "memory": 0,
        "queuePosition": 1,
        "startedAt": "—",
    }
    _processing_repository.add_job(job)
    return job


def advance_job(job_id: str) -> None:
    job = _processing_repository.get_job(job_id)
    if not job:
        return

    job_start = time.time()
    _processing_repository.update_job(job_id, status="queued", progress=0, stage="Queued", eta="Queued")
    _processing_repository.append_log(
        {
            "id": uuid4().hex[:8],
            "time": "now",
            "level": "info",
            "message": f"Job {job_id} queued for AI pipeline",
        }
    )

    time.sleep(1)
    _processing_repository.update_job(job_id, status="processing", progress=35, stage="Frame Reading", eta="In progress")
    _processing_repository.append_log(
        {
            "id": uuid4().hex[:8],
            "time": "now",
            "level": "info",
            "message": f"Job {job_id} entered AI pipeline",
        }
    )

    try:
        result = ai_pipeline.run(job["sourcePath"])
        _processing_repository.update_job(
            job_id,
            status="completed",
            progress=100,
            stage=result.stage,
            eta="Done",
            fps=24,
            gpu=0,
            cpu=0,
            memory=0,
        )
        _processing_repository.append_log(
            {
                "id": uuid4().hex[:8],
                "time": "now",
                "level": "success",
                "message": f"AI pipeline completed for {job_id}: {result.vehicles_counted} vehicles counted",
            }
        )
        logger.info(
            "ai.job",
            extra={
                "job_id": job_id,
                "project_id": job.get("projectId", ""),
                "start_time": job_start,
                "finish_time": time.time(),
                "frames_processed": result.frames_processed,
                "fps": 24,
                "detector_used": ai_pipeline.detector_name,
                "processing_duration": round(time.time() - job_start, 4),
                "error": None,
            },
        )
    except Exception as exc:
        _processing_repository.update_job(job_id, status="failed", progress=0, stage="Failed", eta="—")
        _processing_repository.append_log(
            {
                "id": uuid4().hex[:8],
                "time": "now",
                "level": "error",
                "message": f"AI pipeline failed for {job_id}: {exc}",
            }
        )
        logger.error(
            "ai.job",
            extra={
                "job_id": job_id,
                "project_id": job.get("projectId", ""),
                "start_time": job_start,
                "finish_time": time.time(),
                "frames_processed": 0,
                "fps": 0,
                "detector_used": ai_pipeline.detector_name,
                "processing_duration": round(time.time() - job_start, 4),
                "error": str(exc),
            },
        )


def schedule_job_progress(background_tasks: BackgroundTasks, job_id: str) -> None:
    background_tasks.add_task(advance_job, job_id)
