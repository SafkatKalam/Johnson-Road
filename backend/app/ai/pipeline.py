from dataclasses import dataclass
from pathlib import Path
from typing import Optional
import time

from app.ai.base import Detector
from app.ai.counter import Counter
from app.ai.factory import DetectorFactory
from app.ai.frame_reader import FrameReader
from app.ai.runtime import airuntime, InferenceError, PipelineError
from app.ai.trackers.base import Tracker
from app.ai.trackers.factory import TrackerFactory
from app.ai.video_loader import VideoLoader


@dataclass
class PipelineResult:
    video_path: Path
    frames_processed: int
    detections: int
    tracks: int
    vehicles_counted: int
    stage: str = "Completed"


class AIPipeline:
    def __init__(
        self,
        video_loader: Optional[VideoLoader] = None,
        frame_reader: Optional[FrameReader] = None,
        detector: Optional[Detector] = None,
        tracker: Optional[Tracker] = None,
        counter: Optional[Counter] = None,
    ) -> None:
        self.video_loader = video_loader or VideoLoader()
        self.frame_reader = frame_reader or FrameReader()
        self.counter = counter or Counter()
        # The detector and tracker are resolved when first needed, not when this module loads, so the API
        # still starts when no model is configured or the model failed to load (F6).
        self._detector = detector
        self._tracker = tracker

    @property
    def detector(self) -> Detector:
        if self._detector is None:
            return airuntime.get_detector()  # raises DetectorLoadError when none is available
        return self._detector

    @property
    def detector_name(self) -> str:
        """Class name of the detector in use, or "none". Never raises (safe inside error handling)."""
        if self._detector is not None:
            return type(self._detector).__name__
        return airuntime.get_status().detector_name

    @property
    def tracker(self) -> Tracker:
        if self._tracker is None:
            self._tracker = TrackerFactory.create()
        return self._tracker

    def run(self, file_path: str) -> PipelineResult:
        pipeline_start = time.perf_counter()
        try:
            loader_start = time.perf_counter()
            video_path = self.video_loader.load(file_path)
            airuntime.timing("video_loading", loader_start)

            frame_start = time.perf_counter()
            frames = self.frame_reader.read_frames(video_path)
            airuntime.timing("frame_iteration", frame_start)

            detection_start = time.perf_counter()
            detections = self.detector.detect(frames)
            airuntime.timing("detection", detection_start)

            tracking_start = time.perf_counter()
            tracks = self.tracker.update(detections)
            airuntime.timing("tracking", tracking_start)

            counting_start = time.perf_counter()
            vehicles_counted = self.counter.count(tracks)
            airuntime.timing("counting", counting_start)

            airuntime.timing("total_pipeline", pipeline_start)
            return PipelineResult(
                video_path=video_path,
                frames_processed=frames.frame_count,
                detections=len(detections),
                tracks=len(tracks),
                vehicles_counted=vehicles_counted,
            )
        except Exception as exc:
            raise PipelineError(str(exc)) from exc


ai_pipeline = AIPipeline()
