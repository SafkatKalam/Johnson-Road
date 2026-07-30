from app.repositories.processing_repository import ProcessingRepository

_repository = ProcessingRepository()


def get_processing_state() -> dict:
    return {
        "jobQueue": _repository.get_job_queue(),
        "processingJobs": _repository.get_processing_jobs(),
        "processingLogs": _repository.get_processing_logs(),
        "timelineStages": _repository.get_timeline_stages(),
        "segments": _repository.get_segments(),
    }
