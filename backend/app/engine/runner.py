"""Run one video from start to finish (F30 to F35). No database and no HTTP in here: the worker gives it a path, the saved
settings, a detector, and two callbacks (progress, and "should I stop?")."""
from __future__ import annotations

import math
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable

from app.engine.counting import Counter, LineCfg, ZoneCfg
from app.engine.detect import FrameDetector
from app.engine.reader import ReaderError, read_batches
from app.engine.tracker import make_tracker


class Stopped(Exception):
    """The caller asked the run to stop (cancel, deadline, lost ownership). `reason` says which."""

    def __init__(self, reason: str):
        super().__init__(reason)
        self.reason = reason


@dataclass
class EngineConfig:
    width: int
    height: int
    fps: float
    frame_count: int
    tracker: str
    bucket_seconds: int
    frame_skip: int = 1
    batch_size: int = 1
    lines: list[LineCfg] = field(default_factory=list)
    zones: list[ZoneCfg] = field(default_factory=list)
    annotate: bool = False


@dataclass
class RunResult:
    method: str
    frames_processed: int
    detections_total: int
    tracks_total: int
    vehicles_counted: int
    buckets: list[dict[str, Any]]
    confidence: tuple[float, float, float] | None
    annotated_path: Path | None
    annotated_codec: str | None


def _open_writer(path: Path, fps: float, size: tuple[int, int]):
    import cv2

    for codec in ("avc1", "mp4v"):   # browser-playable H.264 where this OpenCV build has it, otherwise MPEG-4 (O36/O77 not agreed)
        w = cv2.VideoWriter(str(path), cv2.VideoWriter_fourcc(*codec), fps, size)
        if w.isOpened():
            return w, codec
        w.release()
    return None, None


def _draw(image, tracks, cfg: EngineConfig, counter: Counter) -> None:
    import cv2

    h, w = image.shape[:2]
    for z in cfg.zones:
        pts = [(int(x * w), int(y * h)) for x, y in z.points]
        for i in range(len(pts)):
            cv2.line(image, pts[i], pts[(i + 1) % len(pts)], (0, 200, 255), 2)
    for ln in cfg.lines:
        cv2.line(image, (int(ln.p1[0] * w), int(ln.p1[1] * h)), (int(ln.p2[0] * w), int(ln.p2[1] * h)), (0, 255, 0), 2)
    for t in tracks:
        x1, y1, x2, y2 = (int(v) for v in t.box)
        cv2.rectangle(image, (x1, y1), (x2, y2), (255, 120, 0), 2)
        cv2.putText(image, f"{t.cls} #{t.id}", (x1, max(12, y1 - 4)), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (255, 255, 255), 1, cv2.LINE_AA)
    cv2.putText(image, f"counted: {len(counter.counted_events())}", (10, 22), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2, cv2.LINE_AA)


def run_video(path: Path, cfg: EngineConfig, detector: FrameDetector, *, should_stop: Callable[[], str | None],
              on_progress: Callable[[int, int | None, float], None], annotated_out: Path | None = None) -> RunResult:
    """Raises Stopped, ReaderError, or whatever the detector raises. On any exception no annotated file is left behind."""
    import time

    tracker = make_tracker(cfg.tracker)
    counter = Counter(cfg.lines, cfg.zones, cfg.width, cfg.height)
    writer = codec = None
    if cfg.annotate and annotated_out is not None:
        writer, codec = _open_writer(annotated_out, max(cfg.fps / cfg.frame_skip, 1.0), (cfg.width, cfg.height))
    total: int | None = cfg.frame_count if cfg.frame_count > 0 else None
    started = time.monotonic()
    frames_seen = 0
    steps = 0
    ok = False
    try:
        for batch in read_batches(path, fps=cfg.fps, expected_frames=cfg.frame_count, frame_skip=cfg.frame_skip, batch_size=cfg.batch_size):
            reason = should_stop()
            if reason:
                raise Stopped(reason)
            per_frame = detector.detect([f.image for f in batch])
            if len(per_frame) != len(batch):
                raise RuntimeError("detector returned the wrong number of results")
            for frame, dets in zip(batch, per_frame):
                tracks = tracker.update(dets)
                counter.update(tracks, frame.t)
                steps += 1
                if writer is not None:
                    _draw(frame.image, tracks, cfg, counter)
                    writer.write(frame.image)
                frames_seen = frame.index + 1
            if total is not None and frames_seen > total:
                total = None                       # the estimate was too small: no total, no false percentage (FD13)
            elapsed = max(time.monotonic() - started, 1e-6)
            on_progress(frames_seen, total, round(frames_seen / elapsed, 2))
        ok = True
    finally:
        if writer is not None:
            writer.release()
        if not ok and annotated_out is not None:
            try:
                annotated_out.unlink()
            except OSError:
                pass
    if steps == 0:
        raise ReaderError("empty_video")
    return RunResult(counter.method, frames_seen, counter.detections_total, counter.tracks_total, len(counter.counted_events()),
                     counter.buckets(cfg.bucket_seconds), counter.confidence_stats(),
                     annotated_out if writer is not None else None, codec)


def percent(done: int, total: int | None) -> int:
    """Progress for display. Never 100 here: only the completing transaction sets 100."""
    if not total or total <= 0:
        return 0
    return min(99, int(math.floor(done * 100 / total)))
