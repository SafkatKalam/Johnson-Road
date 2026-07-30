from pydantic import BaseModel


class UploadFile(BaseModel):
    id: str
    name: str
    size: int
    duration: str
    resolution: str
    fps: int
    progress: int
    status: str


class UploadInitResponse(BaseModel):
    files: list[UploadFile]
    locationSuggestions: list[str]


class UploadJobResponse(BaseModel):
    jobId: str
    status: str
    filename: str
