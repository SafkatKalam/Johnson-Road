from abc import ABC, abstractmethod

from app.ai.frame_reader import FrameBatch
from app.ai.interfaces import Detection


class Detector(ABC):
    @abstractmethod
    def detect(self, frames: FrameBatch) -> list[Detection]:
        raise NotImplementedError
