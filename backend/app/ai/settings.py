import os
from pydantic import BaseModel


class AISettings(BaseModel):
    model_type: str = os.getenv("MODEL", "yolo8")
    tracker: str = os.getenv("TRACKER", "bytetrack")
    model_path: str = os.getenv("MODEL_PATH", "yolov8n.pt")
    device: str = os.getenv("DEVICE", "cpu")
    confidence_threshold: float = float(os.getenv("CONFIDENCE_THRESHOLD", "0.25"))
    iou_threshold: float = float(os.getenv("IOU_THRESHOLD", "0.45"))
    frame_skip: int = int(os.getenv("FRAME_SKIP", "1"))
    batch_size: int = int(os.getenv("BATCH_SIZE", "1"))
    max_video_length: int = int(os.getenv("MAX_VIDEO_LENGTH", "24"))
    max_video_size: int = int(os.getenv("MAX_VIDEO_SIZE", "20000000000"))
    enable_timing: bool = os.getenv("ENABLE_TIMING", "true").lower() == "true"
    enable_logging: bool = os.getenv("ENABLE_LOGGING", "true").lower() == "true"
    enable_warmup: bool = os.getenv("ENABLE_WARMUP", "true").lower() == "true"


ai_settings = AISettings()
