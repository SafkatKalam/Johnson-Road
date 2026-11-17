"""Read a stored video with the real reader (OpenCV) and measure it (F22/F23, FD9).

Nothing here trusts the file name or the client: size, duration, frame size and rate come from the video itself, and
the preview is one real decoded frame. A file that cannot be decoded is refused with a short code the caller maps
to a plain message.
"""
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

# Short failure codes (stored in uploads.failure_code and shown through a message table).
NOT_A_VIDEO = "not_a_video"            # signature does not match the extension
UNREADABLE = "unreadable_video"        # the reader cannot open or decode it
EMPTY = "empty_video"                  # opens but has no frames
TOO_LONG = "video_too_long"
TOO_LARGE_FRAME = "frame_too_large"


class ProbeError(Exception):
    def __init__(self, code: str):
        super().__init__(code)
        self.code = code


@dataclass(frozen=True)
class Measured:
    duration_seconds: float
    width_px: int
    height_px: int
    frame_rate: float
    frame_count: int
    preview_jpeg: bytes


def sniff_matches(extension: str, head: bytes) -> bool:
    """Cheap check of the first bytes against the claimed type, so a renamed text or image file is refused early."""
    if extension == "mp4":
        return len(head) >= 12 and head[4:8] == b"ftyp"
    if extension == "mkv":
        return head[:4] == b"\x1a\x45\xdf\xa3"
    if extension == "avi":
        return len(head) >= 12 and head[:4] == b"RIFF" and head[8:12] == b"AVI "
    return False


def probe(path: Path, *, max_duration_seconds: float, max_pixels: int) -> Measured:
    import cv2  # imported here so the API starts even where OpenCV is not installed (the upload then fails clearly)

    cap = cv2.VideoCapture(str(path))
    try:
        if not cap.isOpened():
            raise ProbeError(UNREADABLE)
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH) or 0)
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT) or 0)
        fps = float(cap.get(cv2.CAP_PROP_FPS) or 0)
        count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
        # Refuse a huge claimed picture BEFORE decoding a frame, so a hostile header cannot force a huge allocation.
        if width * height > max_pixels or width > 16384 or height > 16384:
            raise ProbeError(TOO_LARGE_FRAME)
        ok, frame = cap.read()
        if not ok or frame is None:
            raise ProbeError(UNREADABLE if count > 0 else EMPTY)
        # The decoded frame is the truth for size; the container header can disagree.
        height, width = int(frame.shape[0]), int(frame.shape[1])
        if width <= 0 or height <= 0:
            raise ProbeError(UNREADABLE)
        if width * height > max_pixels:
            raise ProbeError(TOO_LARGE_FRAME)
        if fps <= 0 or fps != fps or fps > 1000:  # missing, NaN or absurd rate: cannot time anything
            raise ProbeError(UNREADABLE)
        if count <= 0:
            raise ProbeError(EMPTY)
        duration = count / fps
        if duration > max_duration_seconds:
            raise ProbeError(TOO_LONG)
        encoded_ok, buf = cv2.imencode(".jpg", frame, [int(cv2.IMWRITE_JPEG_QUALITY), 85])
        if not encoded_ok:
            raise ProbeError(UNREADABLE)
        return Measured(round(duration, 3), width, height, round(fps, 3), count, bytes(buf))
    except ProbeError:
        raise
    except Exception as exc:  # a decoder crash on a damaged file is an unreadable file, not a server error
        raise ProbeError(UNREADABLE) from exc
    finally:
        cap.release()


# --- isolated probing (security review 2026-11-17, finding 4) -------------------------------------------------------
# The decoder is native code: a hostile file could crash it or eat memory. probe_isolated() runs probe() in a separate
# Python process with a wall-clock limit, so a crash or hang fails THAT upload with "unreadable_video" and never takes
# the API process down. On Linux a memory ceiling is also set (resource.RLIMIT_AS); Windows has no equivalent here.

PROBE_TIMEOUT_SECONDS = 60
PROBE_MEMORY_BYTES = 4 * 1024**3


def _child(path: str, max_duration: float, max_pixels: int, queue) -> None:  # runs in the child process
    try:
        import resource  # Linux/macOS only

        resource.setrlimit(resource.RLIMIT_AS, (PROBE_MEMORY_BYTES, PROBE_MEMORY_BYTES))
    except Exception:  # noqa: BLE001 - not available on Windows
        pass
    try:
        m = probe(Path(path), max_duration_seconds=max_duration, max_pixels=max_pixels)
        queue.put(("ok", (m.duration_seconds, m.width_px, m.height_px, m.frame_rate, m.frame_count, m.preview_jpeg)))
    except ProbeError as exc:
        queue.put(("error", exc.code))
    except BaseException:  # noqa: BLE001
        queue.put(("error", UNREADABLE))


def probe_isolated(path: Path, *, max_duration_seconds: float, max_pixels: int, timeout: float = PROBE_TIMEOUT_SECONDS) -> Measured:
    import multiprocessing as mp
    import queue as queue_mod

    ctx = mp.get_context("spawn")
    q = ctx.Queue(maxsize=1)
    proc = ctx.Process(target=_child, args=(str(path), max_duration_seconds, max_pixels, q), daemon=True)
    proc.start()
    import time

    deadline = time.monotonic() + timeout
    kind, payload = "error", UNREADABLE   # hung, crashed or killed: treat the file as unreadable
    try:
        while time.monotonic() < deadline:
            try:
                kind, payload = q.get(timeout=0.25)
                break
            except queue_mod.Empty:
                if not proc.is_alive() and q.empty():
                    break   # the child died without answering (native crash)
    finally:
        proc.join(timeout=5)
        if proc.is_alive():
            proc.kill()
            proc.join(timeout=5)
    if kind != "ok":
        raise ProbeError(payload)
    return Measured(*payload)
