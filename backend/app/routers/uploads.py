from fastapi import APIRouter, BackgroundTasks, File, UploadFile

from app.services.upload_service import get_upload_initial_state
from app.services.upload_service import (
    create_mock_processing_job,
    save_uploaded_file,
    schedule_job_progress,
)
from app.schemas.upload import UploadInitResponse, UploadJobResponse

router = APIRouter(prefix="/uploads", tags=["uploads"])


@router.get("", summary="Get upload bootstrap data", response_model=UploadInitResponse)
@router.get("/", include_in_schema=False)
def read_uploads():
    return get_upload_initial_state()


@router.post("", summary="Upload video file", response_model=UploadJobResponse)
@router.post("/", include_in_schema=False)
def upload_video(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
):
    stored = save_uploaded_file(file)
    job = create_mock_processing_job(stored["filename"], stored["path"])
    schedule_job_progress(background_tasks, job["id"])
    return {
        "jobId": job["id"],
        "status": job["status"],
        "filename": stored["filename"],
    }
