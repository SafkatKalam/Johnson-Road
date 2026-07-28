from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class ProjectCreate(BaseModel):
    name: str
    location: Optional[str] = None
    road_name: Optional[str] = None
    description: Optional[str] = None


class ProjectResponse(BaseModel):
    id: int
    name: str
    location: Optional[str]
    road_name: Optional[str]
    description: Optional[str]
    status: str
    roi_completed: bool
    analysis_completed: bool
    created_at: datetime

    class Config:
        from_attributes = True