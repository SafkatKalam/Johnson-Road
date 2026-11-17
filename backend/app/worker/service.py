"""The processing worker (F29, F36). One worker handles one job at a time. It runs apart from the API process
(`python -m app.worker`), so a slow or crashed job never blocks or takes down the API.

Inside a job there are two threads: the main thread does the heavy work (reading, detecting, tracking, counting) and a
supervisor thread keeps the heartbeat, notices a cancel request, enforces the optional deadline and notices lost ownership.
The supervisor never waits for the engine, so a slow model batch cannot stop it."""
from __future__ import annotations

import hashlib
import json
import logging
import subprocess
import threading
import time
import uuid
from pathlib import Path
from typing import Any, Callable

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.config import BACKEND_DIR
from app.engine import detect as detect_mod
from app.engine.counting import LineCfg, ZoneCfg
from app.engine.reader import ReaderError
from app.engine.runner import EngineConfig, Stopped, percent, run_video
from app.repositories import job_repository as jobs
from app.storage import LocalStorage, StorageKeyError, StorageUnavailable, make_key

logger = logging.getLogger("johnsonroad.worker")

HEARTBEAT_SECONDS = 5.0
STALE_SECONDS = 120          # a running job with no heartbeat for this long is failed as worker_lost (proposal; O40/O81 not agreed)

_code_version: str | None = None


def code_version() -> str:
    global _code_version
    if _code_version is None:
        try:
            out = subprocess.run(["git", "rev-parse", "--short", "HEAD"], cwd=BACKEND_DIR, capture_output=True, text=True, timeout=5)
            _code_version = out.stdout.strip() or "unknown"
        except Exception:  # noqa: BLE001 - no git on the machine is fine
            _code_version = "unknown"
    return _code_version


class _Supervisor(threading.Thread):
    """Heartbeat, cancel and deadline checks on their own connection, independent of the engine."""

    def __init__(self, session_factory: Callable[[], Session], job_id: Any, worker_id: str, attempt: int, deadline: float | None, interval: float):
        super().__init__(daemon=True)
        self.sf, self.job_id, self.worker_id, self.attempt, self.deadline, self.interval = session_factory, job_id, worker_id, attempt, deadline, interval
        self._stop_evt = threading.Event()
        self.reason: str | None = None

    def run(self) -> None:
        while not self._stop_evt.wait(self.interval):
            if self.deadline is not None and time.monotonic() > self.deadline:
                self.reason = self.reason or "timeout"
            try:
                with self.sf() as db:
                    state = jobs.heartbeat(db, self.job_id, self.worker_id, self.attempt)
                if state["cancel"]:
                    self.reason = self.reason or "cancel"
            except jobs.LostOwnership:
                self.reason = "lost"
                return
            except Exception:  # noqa: BLE001 - a database blip must not kill the supervisor; staleness is handled elsewhere
                logger.warning("worker.heartbeat_failed", exc_info=True)

    def stop(self) -> None:
        self._stop_evt.set()


class Worker:
    def __init__(self, session_factory: Callable[[], Session], storage: LocalStorage, *, worker_id: str | None = None,
                 detector_factory: Callable[[dict[str, Any]], Any] | None = None, heartbeat_seconds: float = HEARTBEAT_SECONDS,
                 stale_seconds: int = STALE_SECONDS, timeout_seconds: int | None = None):
        self.sf, self.storage = session_factory, storage
        self.worker_id = worker_id or f"w-{uuid.uuid4().hex[:10]}"   # unique per process start (fences stale writers)
        self.detector_factory = detector_factory or self._runtime_detector
        self.heartbeat_seconds, self.stale_seconds, self.timeout_seconds = heartbeat_seconds, stale_seconds, timeout_seconds

    @staticmethod
    def _runtime_detector(ctx: dict[str, Any]):
        return detect_mod.from_runtime(confidence=float(ctx["confidence_threshold"]), iou=float(ctx["iou_threshold"]),
                                       classes=list(ctx["classes"]), batch_size=int(ctx["batch_size"]))

    # --- liveness (read by /health) ---

    def beat(self, ready: bool) -> None:
        with self.sf() as db:
            db.execute(text("""INSERT INTO settings (key, value, note) VALUES ('worker.heartbeat', CAST(:v AS jsonb), 'written by the worker')
                               ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()"""),
                       {"v": json.dumps({"workerId": self.worker_id, "at": time.time(), "processingReady": ready})})
            db.commit()

    def recover(self) -> list[str]:
        with self.sf() as db:
            return jobs.recover_stale(db, self.stale_seconds)

    # --- one job ---

    def process_one(self) -> bool:
        """Claim and fully process one queued job. Returns False when there was nothing to do."""
        with self.sf() as db:
            job = jobs.claim_next(db, self.worker_id)
        if job is None:
            return False
        self._process(job)
        return True

    def _fail(self, job_id: Any, attempt: int, code: str, exc: BaseException | None = None) -> None:
        diag = uuid.uuid4().hex[:12]
        if exc is not None:
            logger.error("worker.job_failed", extra={"job_id": str(job_id), "code": code, "diagnostic_id": diag}, exc_info=exc)
        try:
            with self.sf() as db:
                jobs.fail(db, job_id, self.worker_id, attempt, code, diag)
        except jobs.LostOwnership:
            logger.info("worker.lost_ownership_on_fail", extra={"job_id": str(job_id)})

    def _process(self, job: dict[str, Any]) -> None:
        job_id, attempt = job["id"], job["attempt_no"]
        with self.sf() as db:
            ctx = jobs.run_context(db, job_id)
        art_key: str | None = None
        sup = None
        try:
            try:
                if not self.storage.exists("sources", ctx["storage_key"]):
                    return self._fail(job_id, attempt, "source_missing")
                src = self.storage.resolve("sources", ctx["storage_key"])
            except StorageUnavailable as exc:
                return self._fail(job_id, attempt, "storage_unavailable", exc)
            try:
                detector = self.detector_factory(ctx)
            except Exception as exc:  # noqa: BLE001
                return self._fail(job_id, attempt, "detector_unavailable", exc)
            device = str(getattr(detector, "actual_device", getattr(detector, "device", "cpu")))
            model_file = getattr(detector, "model_file_name", "") or "unknown"
            model_sha = getattr(detector, "model_sha256", "") or hashlib.sha256(model_file.encode()).hexdigest()
            try:
                with self.sf() as db:
                    jobs.set_run_info(db, job_id, self.worker_id, attempt, device=device, model_name=ctx["model_name"],
                                      model_file_name=model_file, model_sha=model_sha, code_version=code_version(),
                                      frames_total=ctx["frame_count"] or None)
            except jobs.LostOwnership:
                return
            timeout = ctx["timeout_seconds"] or self.timeout_seconds
            deadline = (time.monotonic() + timeout) if timeout else None
            sup = _Supervisor(self.sf, job_id, self.worker_id, attempt, deadline, self.heartbeat_seconds)
            sup.start()

            cfg = EngineConfig(width=ctx["width_px"], height=ctx["height_px"], fps=float(ctx["frame_rate"]), frame_count=int(ctx["frame_count"] or 0),
                               tracker=ctx["tracker"], bucket_seconds=ctx["bucket_seconds"], frame_skip=ctx["frame_skip"], batch_size=ctx["batch_size"],
                               lines=[LineCfg(str(r["id"]), (r["x1"], r["y1"]), (r["x2"], r["y2"]), r["direction"]) for r in ctx["lines"]],
                               zones=[ZoneCfg(str(z["id"]), tuple((p[0], p[1]) for p in (z["pts"] or []))) for z in ctx["zones"]],
                               annotate=bool(ctx["annotated_output"]))
            out_path = None
            if cfg.annotate:
                art_key = make_key(ctx["organization_id"], ctx["project_id"], "mp4")
                out_path = self.storage.resolve("outputs", art_key)
                out_path.parent.mkdir(parents=True, exist_ok=True)

            def on_progress(done: int, total: int | None, fps: float) -> None:
                with self.sf() as db:
                    jobs.progress(db, job_id, self.worker_id, attempt, frames_done=done, frames_total=total, percent=percent(done, total), fps=fps)

            try:
                run = run_video(src, cfg, detector, should_stop=lambda: sup.reason, on_progress=on_progress, annotated_out=out_path)
            except Stopped as s:
                self._after_stop(job_id, attempt, s.reason)
                return
            except jobs.LostOwnership:
                return
            except ReaderError as exc:
                return self._fail(job_id, attempt, exc.code, exc)
            except StorageUnavailable as exc:
                return self._fail(job_id, attempt, "storage_unavailable", exc)
            except Exception as exc:  # noqa: BLE001
                return self._fail(job_id, attempt, "engine_error", exc)

            artifact = None
            if run.annotated_path is not None and run.annotated_path.is_file():
                data = run.annotated_path.stat().st_size
                digest = hashlib.sha256()
                with open(run.annotated_path, "rb") as fh:
                    for chunk in iter(lambda: fh.read(1024 * 1024), b""):
                        digest.update(chunk)
                artifact = {"kind": "annotated_video", "storage_key": art_key, "content_type": "video/mp4", "size_bytes": data,
                            "checksum": digest.hexdigest()}
            try:
                with self.sf() as db:
                    outcome = jobs.complete(db, job_id, self.worker_id, attempt, run=run, bucket_seconds=ctx["bucket_seconds"], model_name=ctx["model_name"],
                                            model_sha=model_sha, code_version=code_version(), artifact=artifact)
            except jobs.LostOwnership:
                outcome = "lost"
            except Exception as exc:  # noqa: BLE001 - the result transaction failed: nothing was saved
                outcome = "failed"
                self._fail(job_id, attempt, "engine_error", exc)
            if outcome != "completed" and art_key:
                self._remove_output(art_key)
        finally:
            if sup is not None:
                sup.stop()
            if art_key and self._job_status(job_id) not in ("completed",):
                self._remove_output(art_key)

    def _after_stop(self, job_id: Any, attempt: int, reason: str) -> None:
        if reason == "lost":
            return
        if reason == "timeout":
            return self._fail(job_id, attempt, "timeout")
        try:
            with self.sf() as db:
                jobs.confirm_cancelled(db, job_id, self.worker_id, attempt)
        except jobs.LostOwnership:
            pass

    def _job_status(self, job_id: Any) -> str | None:
        with self.sf() as db:
            return db.execute(text("SELECT status FROM jobs WHERE id = :j"), {"j": job_id}).scalar()

    def _remove_output(self, key: str) -> None:
        try:
            self.storage.delete("outputs", key)
        except (StorageUnavailable, StorageKeyError):
            logger.warning("worker.output_cleanup_failed")

    # --- loop ---

    def run_forever(self, poll_seconds: float = 2.0, should_exit: Callable[[], bool] = lambda: False) -> None:
        last_beat = 0.0
        last_recover = 0.0
        while not should_exit():
            now = time.monotonic()
            if now - last_beat >= HEARTBEAT_SECONDS:
                try:
                    from app.ai.runtime import airuntime

                    airuntime.initialize()
                    st = airuntime.get_status()
                    self.beat(bool(st.detector_loaded and st.detector_name != "StubDetector"))
                except Exception:  # noqa: BLE001
                    logger.warning("worker.beat_failed", exc_info=True)
                last_beat = now
            if now - last_recover >= 30:
                try:
                    self.recover()
                except Exception:  # noqa: BLE001
                    logger.warning("worker.recover_failed", exc_info=True)
                last_recover = now
            try:
                worked = self.process_one()
            except Exception:  # noqa: BLE001 - never let the loop die
                logger.exception("worker.loop_error")
                worked = False
            if not worked:
                time.sleep(poll_seconds)
