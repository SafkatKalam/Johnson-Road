from app.routers.dashboard import router as dashboard_router
from app.routers.processing import router as processing_router
from app.routers.projects import router as projects_router
from app.routers.reports import router as reports_router
from app.routers.uploads import router as uploads_router

__all__ = [
    "dashboard_router",
    "projects_router",
    "uploads_router",
    "processing_router",
    "reports_router",
]
