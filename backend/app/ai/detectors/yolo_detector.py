from __future__ import annotations

import hashlib
import logging
from pathlib import Path
from typing import Any, Iterable

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


def normalize_device(device: str) -> str:
    """'cpu', 'cuda', 'cuda:N' (any case) or a bare index like '0'. Anything else is an error."""
    value = str(device).strip().lower()
    if value.isdigit():
        return f"cuda:{value}"
    if value == "cpu" or value == "cuda" or (value.startswith("cuda:") and value[5:].isdigit()):
        return value
    raise ValueError(f"unsupported DEVICE '{device}' (use cpu, cuda, cuda:N or a GPU number)")


def file_sha256(path: str) -> str:
    digest = hashlib.sha256()
    with open(path, "rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


class YOLODetector(Detector):
    """Loads exactly the weights file it is given. It never substitutes another model or device."""

    def __init__(
        self,
        model_path: str,
        device: str = "cpu",
        confidence_threshold: float = 0.25,
        iou_threshold: float = 0.45,
        frame_skip: int = 1,
        batch_size: int = 1,
    ) -> None:
        device = normalize_device(device)
        if device.startswith("cuda") and not torch.cuda.is_available():
            raise RuntimeError(f"device '{device}' was requested but CUDA is not available")
        self.model_path = str(Path(model_path))
        self.device = device
        self.confidence_threshold = confidence_threshold
        self.iou_threshold = iou_threshold
        self.frame_skip = max(1, frame_skip)
        self.batch_size = max(1, batch_size)
        self._model = self._cached_load_model(self.model_path)
        # What really loaded: recorded so a job can say which weights and device produced it.
        self.model_file_name = Path(self.model_path).name
        self.model_sha256 = file_sha256(self.model_path)
        self.actual_device = self._resolve_actual_device()

    def _resolve_actual_device(self) -> str:
        """Move the model to the requested device and report where its weights really are."""
        torch_device = torch.device(self.device)
        self._model.to(torch_device)
        try:
            return str(next(self._model.model.parameters()).device)
        except (AttributeError, StopIteration):
            return str(torch_device)  # a model object without parameters (a test double)

    @staticmethod
    def _cached_load_model(model_path: str) -> YOLO:
        # Not cached: each detector owns its model, so moving one to a device never moves another.
        if not Path(model_path).is_file():
            raise FileNotFoundError(f"model file not found: {Path(model_path).name}")
        return YOLO(model_path)

    def warmup(self) -> None:
        """Run one tiny real inference so the first job does not pay the start-up cost."""
        import numpy as np

        self._model.predict(
            source=np.zeros((64, 64, 3), dtype=np.uint8),
            device=self.device,
            verbose=False,
            imgsz=64,
        )

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
                        class_id=cls_index,
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
