from typing import Optional

from app.services import mock_data


class ProjectRepository:
    def get_projects(self) -> list[dict]:
        return mock_data.PROJECTS

    def get_project(self, project_id: str) -> Optional[dict]:
        return next((project for project in mock_data.PROJECTS if project["id"] == project_id), None)

    def get_project_videos(self, project_id: str) -> list[dict]:
        return mock_data.PROJECT_VIDEOS.get(project_id, [])

    def get_project_reports(self, project_id: str) -> list[dict]:
        return mock_data.PROJECT_REPORTS.get(project_id, [])

    def get_location_suggestions(self) -> list[str]:
        return mock_data.LOCATION_SUGGESTIONS
