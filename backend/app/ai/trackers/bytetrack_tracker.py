from app.ai.trackers.base import TrackedObject, Tracker
from app.ai.interfaces import Detection


class ByteTracker(Tracker):
    def __init__(self) -> None:
        self._initialized = False
        self._sequence = 0

    def initialize(self) -> None:
        self._initialized = True

    def update(self, detections: list[Detection]) -> list[TrackedObject]:
        if not self._initialized:
            self.initialize()
        tracked_objects: list[TrackedObject] = []
        for detection in detections:
            self._sequence += 1
            tracked_objects.append(
                TrackedObject(
                    track_id=f"byte_{self._sequence:04d}",
                    detections=[detection],
                    label=detection.label,
                    confidence=detection.confidence,
                )
            )
        return tracked_objects

    def reset(self) -> None:
        self._sequence = 0
        self._initialized = False
