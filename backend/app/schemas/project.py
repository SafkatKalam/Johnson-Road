from typing import Optional

from pydantic import BaseModel


class Project(BaseModel):
    id: str
    name: str
    location: str
    status: str
    duration: int
    videoCount: int
    vehicleCount: int
    avgFlow: int
    peakHour: str
    createdAt: str
    updatedAt: Optional[str] = None
    thumbnail: str
    confidence: float
    reportCount: Optional[int] = None
    aiJobCount: Optional[int] = None
    storageUsed: Optional[float] = None


class ProjectVideo(BaseModel):
    id: str
    name: str
    duration: str
    resolution: str
    fps: int
    size: str
    status: str
    camera: str


class ProjectReport(BaseModel):
    id: str
    title: str
    date: str
    type: str
    vehicleCount: int


class ProjectListResponse(BaseModel):
    projects: list[Project]


class ProjectVideosResponse(BaseModel):
    projectId: str
    videos: list[ProjectVideo]


class ProjectReportsResponse(BaseModel):
    projectId: str
    reports: list[ProjectReport]


class LocationSuggestionsResponse(BaseModel):
    suggestions: list[str]
