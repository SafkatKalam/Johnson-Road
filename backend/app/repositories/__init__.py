from app.repositories.dashboard_repository import DashboardRepository
from app.repositories.processing_repository import ProcessingRepository
from app.repositories.project_repository import ProjectRepository
from app.repositories.report_repository import ReportRepository
from app.repositories.upload_repository import UploadRepository

__all__ = [
    "DashboardRepository",
    "ProjectRepository",
    "UploadRepository",
    "ProcessingRepository",
    "ReportRepository",
]
