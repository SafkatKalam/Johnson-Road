from app.ai.base import Detector
from app.ai.frame_reader import FrameBatch
from app.ai.interfaces import Detection


class StubDetector(Detector):
    def detect(self, frames: FrameBatch) -> list[Detection]:
        return []
