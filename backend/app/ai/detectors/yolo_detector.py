from __future__ import annotations

import logging
from contextlib import contextmanager
from functools import lru_cache, wraps
from pathlib import Path
from typing import Any, Iterable, Optional

import torch
from ultralytics import YOLO

from app.ai.base import Detector
from app.ai.frame_reader import FrameBatch
from app.ai.interfaces import Detection


logger = logging.getLogger("johnsonroad.ai.detector")


def _xyxy_to_xywh(box: Iterable[float]) -> tuple[int, int, int, int]:
    x1, y1, x2, y2 = box
    return (
        int(round(x1)),
        int(round(y1)),
        int(round(max(0.0, x2 - x1))),
        int(round(max(0.0, y2 - y1))),
    )


class YOLODetector(Detector):
    def __init__(
        self,
        model_path: str,
        device: str = "cpu",
        confidence_threshold: float = 0.25,
        iou_threshold: float = 0.45,
        frame_skip: int = 1,
        batch_size: int = 1,
    ) -> None:
        self.model_path = model_path
        self.device = device
        self.confidence_threshold = confidence_threshold
        self.iou_threshold = iou_threshold
        self.frame_skip = max(1, frame_skip)
        self.batch_size = max(1, batch_size)
        self._model = self._load_model()

    @staticmethod
    @lru_cache(maxsize=4)
    def _cached_load_model(model_path: str) -> YOLO:
        original_load = torch.load

        @wraps(original_load)
        def patched_load(*args, **kwargs):
            kwargs.setdefault("weights_only", False)
            return original_load(*args, **kwargs)

        try:
            torch.load = patched_load
            return YOLO(model_path)
        finally:
            torch.load = original_load

    def _load_model(self) -> YOLO:
        try:
            return self._cached_load_model(str(Path(self.model_path)))
        except Exception as exc:  # pragma: no cover - startup/runtime environment
            fallback = str((Path(__file__).resolve().parents[3] / "yolov8n.pt").resolve())
            if str(Path(self.model_path)) != fallback:
                logger.warning("YOLO model load failed for %s: %s; retrying %s", self.model_path, exc, fallback)
                return self._cached_load_model(fallback)
            logger.warning("YOLO model load failed for %s: %s", self.model_path, exc)
            raise

    def _preprocess(self, frames: FrameBatch) -> FrameBatch:
        return frames

    def _inference(self, source: Any):
        return self._model.predict(
            source=source,
            device=self.device,
            conf=self.confidence_threshold,
            iou=self.iou_threshold,
            stream=False,
            verbose=False,
            imgsz=640,
            batch=self.batch_size,
        )

    def _postprocess(self, results: list[Any]) -> list[Detection]:
        detections: list[Detection] = []
        frame_index = 0
        for result in results:
            names = getattr(result, "names", {}) or {}
            boxes = getattr(result, "boxes", None)
            if boxes is None:
                continue
            for box in boxes:
                cls_index = int(box.cls.item()) if getattr(box, "cls", None) is not None else 0
                label = names.get(cls_index, "object")
                confidence = float(box.conf.item()) if getattr(box, "conf", None) is not None else 0.0
                xyxy = box.xyxy[0].tolist() if getattr(box, "xyxy", None) is not None else [0, 0, 0, 0]
                detections.append(
                    Detection(
                        frame_index=frame_index,
                        label=label,
                        confidence=confidence,
                        bbox=_xyxy_to_xywh(xyxy),
                    )
                )
            frame_index += 1
        return detections

    def detect(self, frames: FrameBatch) -> list[Detection]:
        processed = self._preprocess(frames)
        results = self._inference(str(processed.source))
        return self._postprocess(results)
