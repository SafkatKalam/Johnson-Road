from dataclasses import dataclass


@dataclass(frozen=True)
class Detection:
    frame_index: int
    label: str
    class_id: int
    confidence: float
    bbox: tuple[int, int, int, int]


@dataclass(frozen=True)
class TrackObservation:
    track_id: str
    bbox: tuple[int, int, int, int]
    class_id: int
    confidence: float
    centroid: tuple[int, int]
    frame_index: int
    timestamp: float


class FrameLoaderInterface:
    def load(self, file_path: str):  # pragma: no cover - interface placeholder
        raise NotImplementedError


class FrameReaderInterface:
    def read_frames(self, source):  # pragma: no cover - interface placeholder
        raise NotImplementedError


class CounterInterface:
    def count(self, tracks):  # pragma: no cover - interface placeholder
        raise NotImplementedError
