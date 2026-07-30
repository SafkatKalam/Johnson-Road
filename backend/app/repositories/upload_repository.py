from app.services import mock_data


class UploadRepository:
    def get_initial_files(self) -> list[dict]:
        return mock_data.UPLOAD_FILES

    def get_location_suggestions(self) -> list[str]:
        return mock_data.LOCATION_SUGGESTIONS
