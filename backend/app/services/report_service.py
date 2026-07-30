from app.repositories.report_repository import ReportRepository

_repository = ReportRepository()


def get_report_analytics() -> dict:
    return _repository.get_report_analytics()


def get_project_reports(project_id: str) -> list[dict]:
    return _repository.get_project_reports(project_id)
