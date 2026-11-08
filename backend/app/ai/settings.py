from pydantic import Field, ValidationError
from pydantic_settings import BaseSettings, SettingsConfigDict

from app.core.config import BACKEND_DIR, SettingsError


class AISettings(BaseSettings):
    """AI settings. Read from environment variables or backend/.env (same file as the API settings).

    MODEL defaults to "none": no detector is loaded and /health says so. A missing setting must never
    quietly turn into a detector that finds nothing. Set MODEL=stub for tests and demos, or
    MODEL=yolo8 (after installing requirements-ai.txt) for the real detector.
    """

    model_config = SettingsConfigDict(
        env_file=BACKEND_DIR / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
        protected_namespaces=(),
        populate_by_name=True,
    )

    model_type: str = Field("none", validation_alias="MODEL")
    tracker: str = Field("bytetrack", validation_alias="TRACKER")
    model_path: str = Field("yolov8n.pt", validation_alias="MODEL_PATH")
    device: str = Field("cpu", validation_alias="DEVICE")
    confidence_threshold: float = Field(0.25, validation_alias="CONFIDENCE_THRESHOLD")
    iou_threshold: float = Field(0.45, validation_alias="IOU_THRESHOLD")
    frame_skip: int = Field(1, validation_alias="FRAME_SKIP")
    batch_size: int = Field(1, validation_alias="BATCH_SIZE")
    max_video_length: int = Field(24, validation_alias="MAX_VIDEO_LENGTH")
    max_video_size: int = Field(20_000_000_000, validation_alias="MAX_VIDEO_SIZE")
    enable_timing: bool = Field(True, validation_alias="ENABLE_TIMING")
    enable_logging: bool = Field(True, validation_alias="ENABLE_LOGGING")
    enable_warmup: bool = Field(True, validation_alias="ENABLE_WARMUP")


def _load_ai_settings() -> AISettings:
    try:
        return AISettings()
    except ValidationError as exc:
        problems = "; ".join(
            f"{'.'.join(str(p) for p in err['loc'])}: {err['msg']}" for err in exc.errors()
        )
        raise SettingsError(f"Invalid AI settings - {problems}. Check backend/.env.") from None


ai_settings = _load_ai_settings()
