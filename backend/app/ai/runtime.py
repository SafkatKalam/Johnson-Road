import logging
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

from app.ai.detectors.stub_detector import StubDetector
from app.ai.settings import ai_settings
from app.core.config import BACKEND_DIR

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
    model_file_name: str = ""
    model_sha256: str = ""
    load_error: str = ""


class AIRuntime:
    _instance: Optional["AIRuntime"] = None

    def __new__(cls) -> "AIRuntime":
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
            cls._instance._detector = None
            cls._instance._warmed_up = False
            cls._instance._last_timing = {}
            cls._instance._load_error = ""
        return cls._instance

    def initialize(self) -> None:
        """Try to load the detector. A failure is recorded, not raised: the API must stay up.

        `/health` then shows detectorLoaded=false, and get_detector() raises when a job needs it.
        """
        if self._initialized:
            return
        self._initialized = True
        try:
            self._detector = self._create_detector()
        except Exception as exc:
            self._detector = None
            self._load_error = f"{type(exc).__name__}: {exc}"
            # Full detail goes to the log; the public health response never carries it.
            logger.error("detector failed to load: %s", self._load_error)
            return
        if ai_settings.enable_warmup:
            self.warmup()

    def _create_detector(self):
        model_type = ai_settings.model_type.lower()
        if model_type == "none":
            raise DetectorLoadError("no detector configured: set MODEL in backend/.env (stub or yolo8)")
        if model_type.startswith("yolo"):
            # Check the file first so a missing file is reported as that, not as a missing library.
            model_path = self._resolve_model_path()
            # Imported here so the API can start without torch and ultralytics (MODEL=stub).
            from app.ai.detectors.yolo_detector import YOLODetector

            return YOLODetector(
                model_path=model_path,
                device=ai_settings.device,
                confidence_threshold=ai_settings.confidence_threshold,
                iou_threshold=ai_settings.iou_threshold,
                frame_skip=ai_settings.frame_skip,
                batch_size=ai_settings.batch_size,
            )
        if model_type == "stub":
            return StubDetector()
        raise DetectorLoadError(f"unknown MODEL '{ai_settings.model_type}' (use 'stub' or a 'yolo...' value)")

    def _resolve_model_path(self) -> str:
        """The configured weights file, exactly. Relative paths are relative to backend/.

        There is no fallback to another file: a missing file is an error (F04: never switch models silently).
        """
        configured = Path(ai_settings.model_path)
        path = configured if configured.is_absolute() else BACKEND_DIR / configured
        if not path.is_file():
            raise DetectorLoadError(f"MODEL_PATH file not found: {configured.name}")
        return str(path.resolve())

    def warmup(self) -> None:
        """Warm the real detector with one tiny inference. Not marked warm if it fails."""
        if self._warmed_up or self._detector is None:
            return
        warm = getattr(self._detector, "warmup", None)
        if warm is None:
            return  # the stub needs no warmup
        try:
            warm()
            self._warmed_up = True
        except Exception as exc:
            logger.warning("detector warmup failed: %s", type(exc).__name__)

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
        # The device that really loaded, not the configured one, when the detector knows it.
        # No detector loaded means no device in use: report "none", not the configured value.
        device = getattr(detector, "actual_device", None) or ("cpu" if detector else "none")
        return RuntimeStatus(
            initialized=self._initialized,
            detector_loaded=detector is not None,
            detector_name=detector_name,
            device=device,
            model_path=ai_settings.model_path,
            warmed_up=self._warmed_up,
            model_file_name=getattr(detector, "model_file_name", ""),
            model_sha256=getattr(detector, "model_sha256", ""),
            load_error=self._load_error,
        )


airuntime = AIRuntime()
