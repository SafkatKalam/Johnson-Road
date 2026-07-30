from fastapi import APIRouter

from app.services.processing_service import get_processing_state
from app.repositories.processing_repository import ProcessingRepository
from app.schemas.processing import ProcessingJobResponse, ProcessingResponse

router = APIRouter(prefix="/processing", tags=["processing"])
_repository = ProcessingRepository()


@router.get("", summary="Get processing state", response_model=ProcessingResponse)
@router.get("/", include_in_schema=False)
def read_processing():
    return get_processing_state()


@router.get("/jobs/{job_id}", summary="Get processing job status", response_model=ProcessingJobResponse)
def read_processing_job(job_id: str):
    job = _repository.get_job(job_id)
    if not job:
        return {
            "jobId": job_id,
            "status": "not_found",
            "progress": 0,
            "stage": "Not found",
            "eta": "—",
            "projectName": "",
        }
    return {
        "jobId": job["id"],
        "status": job["status"],
        "progress": job["progress"],
        "stage": job["stage"],
        "eta": job["eta"],
        "projectName": job["projectName"],
    }
