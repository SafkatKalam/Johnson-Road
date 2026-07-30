from fastapi import APIRouter

from app.services.project_service import get_project_reports
from app.services.report_service import get_report_analytics

router = APIRouter(prefix="/reports", tags=["reports"])


@router.get("", summary="Get report analytics")
@router.get("/", include_in_schema=False)
def read_reports():
    return get_report_analytics()


@router.get("/{project_id}", summary="Get project reports")
def read_project_reports(project_id: str):
    return {"projectId": project_id, "reports": get_project_reports(project_id)}
