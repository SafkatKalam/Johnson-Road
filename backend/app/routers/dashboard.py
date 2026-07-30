from fastapi import APIRouter

from app.services.dashboard_service import get_dashboard_data

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("", summary="Get dashboard data")
@router.get("/", include_in_schema=False)
def read_dashboard():
    return get_dashboard_data()
