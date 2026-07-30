from fastapi import APIRouter

from app.services.project_service import (
    get_location_suggestions,
    get_project,
    get_project_reports,
    get_project_videos,
    get_projects,
)

router = APIRouter(prefix="/projects", tags=["projects"])


@router.get("", summary="List projects")
@router.get("/", include_in_schema=False)
def list_projects():
    return get_projects()


@router.get("/location-suggestions", summary="Get location suggestions")
def location_suggestions():
    return {"suggestions": get_location_suggestions()}


@router.get("/{project_id}", summary="Get project detail")
def read_project(project_id: str):
    return get_project(project_id)


@router.get("/{project_id}/videos", summary="Get project videos")
def read_project_videos(project_id: str):
    return {"projectId": project_id, "videos": get_project_videos(project_id)}


@router.get("/{project_id}/reports", summary="Get project reports")
def read_project_reports(project_id: str):
    return {"projectId": project_id, "reports": get_project_reports(project_id)}
