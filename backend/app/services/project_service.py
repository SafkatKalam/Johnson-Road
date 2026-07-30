from typing import Optional

from app.repositories.project_repository import ProjectRepository

_repository = ProjectRepository()


def get_projects() -> list[dict]:
    return _repository.get_projects()


def get_project(project_id: str) -> Optional[dict]:
    return _repository.get_project(project_id)


def get_project_videos(project_id: str) -> list[dict]:
    return _repository.get_project_videos(project_id)


def get_project_reports(project_id: str) -> list[dict]:
    return _repository.get_project_reports(project_id)


def get_location_suggestions() -> list[str]:
    return _repository.get_location_suggestions()
