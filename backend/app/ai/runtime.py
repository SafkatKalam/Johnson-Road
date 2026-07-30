import logging
from pathlib import Path
import time
from dataclasses import dataclass
from typing import Optional

from app.ai.detectors.yolo_detector import YOLODetector
from app.ai.detectors.stub_detector import StubDetector
from app.ai.settings import ai_settings

logger = logging.getLogger("johnsonroad.ai")


class AIRuntimeError(Exception):
    pass


class DetectorLoadError(AIRuntimeError):
    pass


class InferenceError(AIRuntimeError):
    pass


class PipelineError(AIRuntimeError):
    pass


@dataclass
class RuntimeStatus:
    initialized: bool
    detector_loaded: bool
    detector_name: str
    device: str
    model_path: str
    warmed_up: bool


class AIRuntime:
    _instance: Optional["AIRuntime"] = None

    def __new__(cls) -> "AIRuntime":
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
            cls._instance._detector = None
            cls._instance._warmed_up = False
            cls._instance._last_timing = {}
        return cls._instance

    def initialize(self) -> None:
        if self._initialized:
            return
        try:
            self._detector = self._create_detector()
            self._initialized = True
            if ai_settings.enable_warmup:
                self.warmup()
        except Exception as exc:  # pragma: no cover - startup path
            raise DetectorLoadError(str(exc)) from exc

    def _create_detector(self):
        model_type = ai_settings.model_type.lower()
        if model_type.startswith("yolo"):
            model_path = self._resolve_model_path(model_type)
            return YOLODetector(
                model_path=model_path,
                device=ai_settings.device,
                confidence_threshold=ai_settings.confidence_threshold,
                iou_threshold=ai_settings.iou_threshold,
                frame_skip=ai_settings.frame_skip,
                batch_size=ai_settings.batch_size,
            )
        return StubDetector()

    def _resolve_model_path(self, model_type: str) -> str:
        configured = Path(ai_settings.model_path)
        if configured.exists():
            return str(configured)
        fallback_map = {
            "yolo8": "yolov8n.pt",
            "yolov8": "yolov8n.pt",
            "yolo10": "yolov8n.pt",
            "yolov10": "yolov8n.pt",
            "yolo11": "yolov8n.pt",
            "yolov11": "yolov8n.pt",
        }
        return str((Path(__file__).resolve().parents[3] / fallback_map.get(model_type, "yolo11n.pt")).resolve())

    def warmup(self) -> None:
        if self._warmed_up or self._detector is None:
            return
        try:
            from app.ai.frame_reader import FrameBatch

            dummy = FrameBatch(source=Path("warmup.mp4"))
            try:
                self._detector.detect(dummy)
            except Exception:
                pass
            self._warmed_up = True
        except Exception as exc:  # pragma: no cover - startup path
            raise DetectorLoadError(str(exc)) from exc

    def get_detector(self):
        if not self._initialized:
            self.initialize()
        if self._detector is None:
            raise DetectorLoadError("Detector is not available.")
        return self._detector

    def log_inference(self, job_id: str, project_id: str, start_time: float, frames_processed: int, fps: float, detector_used: str, error: Optional[str] = None) -> None:
        if not ai_settings.enable_logging:
            return
        payload = {
            "job_id": job_id,
            "project_id": project_id,
            "start_time": start_time,
            "finish_time": time.time(),
            "frames_processed": frames_processed,
            "fps": fps,
            "detector_used": detector_used,
            "processing_duration": round(time.time() - start_time, 4),
            "error": error,
        }
        logger.info("ai.inference %s", payload)

    def timing(self, name: str, start: float) -> None:
        if ai_settings.enable_timing:
            self._last_timing[name] = round(time.time() - start, 4)

    def get_status(self) -> RuntimeStatus:
        detector = self._detector
        detector_name = detector.__class__.__name__ if detector else "none"
        return RuntimeStatus(
            initialized=self._initialized,
            detector_loaded=detector is not None,
            detector_name=detector_name,
            device=ai_settings.device,
            model_path=ai_settings.model_path,
            warmed_up=self._warmed_up,
        )


airuntime = AIRuntime()
