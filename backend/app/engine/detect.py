"""Detector adapters (F30). A frame detector takes a list of BGR images and returns, for each image, the vehicle detections.

Real weights are used through YoloFrameDetector. A missing or stub detector is an error for a job, never a silent "found
nothing" (F04)."""
from __future__ import annotations

from typing import Protocol

import numpy as np

from app.engine.tracker import Detected

# The five vehicle classes a configuration may ask for, by COCO class name.
VEHICLE_CLASSES = ("car", "motorcycle", "bus", "truck", "bicycle")


class DetectorUnavailable(Exception):
    pass


class FrameDetector(Protocol):
    def detect(self, images: list[np.ndarray]) -> list[list[Detected]]: ...


class YoloFrameDetector:
    """Runs the already-loaded YOLO model (from the AI runtime) on in-memory frames, keeping only the wanted classes."""

    def __init__(self, yolo, *, device: str, confidence: float, iou: float, classes: list[str], batch_size: int):
        self._model = yolo._model if hasattr(yolo, "_model") else None
        if self._model is None:
            raise DetectorUnavailable("the loaded detector cannot run real inference")
        self.device, self.conf, self.iou, self.classes, self.batch = device, confidence, iou, set(classes), batch_size
        self.model_file_name = getattr(yolo, "model_file_name", "")
        self.model_sha256 = getattr(yolo, "model_sha256", "")
        self.actual_device = getattr(yolo, "actual_device", device)

    def detect(self, images: list[np.ndarray]) -> list[list[Detected]]:
        results = self._model.predict(source=images, device=self.device, conf=self.conf, iou=self.iou, verbose=False,
                                      imgsz=640, batch=self.batch, stream=False)
        out: list[list[Detected]] = []
        for r in results:
            names = getattr(r, "names", {}) or {}
            found: list[Detected] = []
            for b in (getattr(r, "boxes", None) or []):
                label = names.get(int(b.cls.item()), "")
                if label in self.classes:
                    x1, y1, x2, y2 = (float(v) for v in b.xyxy[0].tolist())
                    found.append(Detected((x1, y1, x2, y2), label, float(b.conf.item())))
            out.append(found)
        return out


def from_runtime(*, confidence: float, iou: float, classes: list[str], batch_size: int) -> YoloFrameDetector:
    """The detector the AI runtime loaded, or DetectorUnavailable. The stub (which finds nothing) is refused."""
    from app.ai.runtime import AIRuntimeError, airuntime

    try:
        det = airuntime.get_detector()
    except AIRuntimeError as exc:
        raise DetectorUnavailable(str(exc)) from exc
    if type(det).__name__ == "StubDetector":
        raise DetectorUnavailable("only the stub detector is loaded")
    return YoloFrameDetector(det, device=getattr(det, "device", "cpu"), confidence=confidence, iou=iou, classes=classes,
                             batch_size=batch_size)
