from app.routers.account import router as account_router
from app.routers.organization import public_router as invites_router
from app.routers.organization import router as organization_router
from app.routers.dashboard import router as dashboard_router
from app.routers.processing import router as processing_router
from app.routers.projects import router as projects_router
from app.routers.reports import router as reports_router
from app.routers.uploads import router as uploads_router

__all__ = [
    "account_router",
    "invites_router",
    "organization_router",
    "dashboard_router",
    "projects_router",
    "uploads_router",
    "processing_router",
    "reports_router",
]
