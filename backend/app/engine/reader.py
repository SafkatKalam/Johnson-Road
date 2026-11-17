"""Frame reader (F30): ordered batches with real frame numbers and times, frame skipping, bounded memory, and a check that
the video ended where it should (a decode failure must never look like a normal end)."""
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Iterator

import numpy as np

EOF_TOLERANCE = 0.02   # a video may end up to 2 percent (or 2 frames) before the container's frame-count estimate


class ReaderError(Exception):
    def __init__(self, code: str):
        super().__init__(code)
        self.code = code


@dataclass(frozen=True)
class Frame:
    index: int          # position in the source video, from 0
    t: float            # seconds from the start of the video
    image: np.ndarray   # BGR


def read_batches(path: Path, *, fps: float, expected_frames: int, frame_skip: int = 1, batch_size: int = 1) -> Iterator[list[Frame]]:
    """Yield lists of at most `batch_size` frames, keeping every `frame_skip`-th frame. Only one batch is in memory.
    Raises ReaderError('unreadable_video') if the file cannot be opened or decoding fails before any frame,
    ReaderError('truncated_video') if it stops clearly earlier than its frame count says."""
    import cv2

    cap = cv2.VideoCapture(str(path))
    try:
        if not cap.isOpened():
            raise ReaderError("unreadable_video")
        batch: list[Frame] = []
        index = 0
        read_any = False
        while True:
            ok, image = cap.read()
            if not ok:
                break
            read_any = True
            if expected_frames > 0 and index > expected_frames + max(2, int(expected_frames * EOF_TOLERANCE)):
                # Far more frames than the header said (and than the duration check allowed): stop, do not run unbounded.
                raise ReaderError("frame_count_mismatch")
            if index % frame_skip == 0:
                batch.append(Frame(index, index / fps, image))
                if len(batch) >= batch_size:
                    yield batch
                    batch = []
            index += 1
        if not read_any:
            raise ReaderError("unreadable_video")
        allowed_gap = max(2, int(expected_frames * EOF_TOLERANCE))
        if expected_frames > 0 and index < expected_frames - allowed_gap:
            raise ReaderError("truncated_video")   # stopped early: not a clean end of file
        if batch:
            yield batch
    finally:
        cap.release()
