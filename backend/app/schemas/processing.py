from typing import Optional

from pydantic import BaseModel


class JobQueueItem(BaseModel):
    id: str
    projectName: str
    projectId: str
    progress: int
    eta: str
    status: str
    priority: str
    stage: str
    fps: int
    gpu: int
    cpu: int
    memory: int
    queuePosition: Optional[int] = None
    startedAt: str


class ProcessingJob(BaseModel):
    id: str
    projectName: str
    progress: int
    stage: str
    eta: str
    status: str
    fps: int
    currentFrame: str
    vehicleCount: int


class LogEntry(BaseModel):
    id: str
    time: str
    level: str
    message: str


class TimelineStage(BaseModel):
    id: str
    label: str
    status: str
    startedAt: str
    duration: str


class Segment(BaseModel):
    id: str
    range: str
    duration: str
    vehicles: int
    status: str


class ProcessingResponse(BaseModel):
    jobQueue: list[JobQueueItem]
    processingJobs: list[ProcessingJob]
    processingLogs: list[LogEntry]
    timelineStages: list[TimelineStage]
    segments: list[Segment]


class ProcessingJobResponse(BaseModel):
    jobId: str
    status: str
    progress: int
    stage: str
    eta: str
    projectName: str
