from abc import ABC, abstractmethod
from dataclasses import dataclass, field

from app.ai.interfaces import Detection


@dataclass
class TrackedObject:
    track_id: str
    detections: list[Detection] = field(default_factory=list)
    label: str = "vehicle"
    confidence: float = 0.0


class Tracker(ABC):
    @abstractmethod
    def initialize(self) -> None:
        raise NotImplementedError

    @abstractmethod
    def update(self, detections: list[Detection]) -> list[TrackedObject]:
        raise NotImplementedError

    @abstractmethod
    def reset(self) -> None:
        raise NotImplementedError
