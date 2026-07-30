from copy import deepcopy
from typing import Optional

from app.services import mock_data

_job_queue = deepcopy(mock_data.JOB_QUEUE)
_processing_jobs = deepcopy(mock_data.PROCESSING_JOBS)
_processing_logs = deepcopy(mock_data.PROCESSING_LOGS)
_timeline_stages = deepcopy(mock_data.TIMELINE_STAGES)
_segments = deepcopy(mock_data.SEGMENTS)


class ProcessingRepository:
    def get_job_queue(self) -> list[dict]:
        return _job_queue

    def get_processing_jobs(self) -> list[dict]:
        return _processing_jobs

    def get_processing_logs(self) -> list[dict]:
        return _processing_logs

    def get_timeline_stages(self) -> list[dict]:
        return _timeline_stages

    def get_segments(self) -> list[dict]:
        return _segments

    def get_job(self, job_id: str) -> Optional[dict]:
        return next((job for job in _job_queue if job["id"] == job_id), None)

    def get_processing_job(self, job_id: str) -> Optional[dict]:
        return next((job for job in _processing_jobs if job["id"] == job_id), None)

    def add_job(self, job: dict) -> dict:
        _job_queue.insert(0, job)
        _processing_jobs.insert(0, job.copy())
        return job

    def update_job(self, job_id: str, **changes) -> Optional[dict]:
        job = self.get_job(job_id)
        if job:
            job.update(changes)
        processing_job = self.get_processing_job(job_id)
        if processing_job:
            processing_job.update(changes)
        return job

    def append_log(self, log: dict) -> None:
        _processing_logs.insert(0, log)
