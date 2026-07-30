from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class FrameBatch:
    source: Path
    frame_count: int = 6


class FrameReader:
    def read_frames(self, source: Path) -> FrameBatch:
        return FrameBatch(source=source)
