from pathlib import Path


class VideoLoader:
    def load(self, file_path: str) -> Path:
        path = Path(file_path)
        if not path.exists():
            raise FileNotFoundError(f"Video file not found: {file_path}")
        return path
