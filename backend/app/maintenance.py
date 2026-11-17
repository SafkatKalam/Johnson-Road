"""Retention, orphan cleanup and controlled deletion (F41).

- Automatic retention is OFF: no retention period has been approved (FD7). `retention_enabled()` is always False and
  nothing here deletes anything on a timer.
- Orphan scan: files in storage that no database row points to (for example left by a crash between writing a file and
  committing its row). Only files older than a grace period are reported, so a write in progress is never touched.
  Nothing is deleted unless asked with apply=True. Rows that point to a missing file are reported, never changed.
- Source deletion for a video that already has results: refused while any job of it is queued or running; the file is
  removed first and the row marked after (a crash in between leaves a row whose file is gone, which the scan reports,
  never a hidden file). Results, reports and history stay.

Command line: `python -m app.maintenance orphans` (report) or `python -m app.maintenance orphans --apply`.
"""
from __future__ import annotations

import sys
import time
from typing import Any
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.repositories import audit_repository
from app.storage import AREAS, LocalStorage, StorageUnavailable

GRACE_SECONDS = 3600


def retention_enabled() -> bool:
    return False   # no approved retention period (FD7); change only after the client agrees periods


def _known_keys(db: Session) -> dict[str, set[str]]:
    q = lambda sql: {r[0] for r in db.execute(text(sql)).all() if r[0]}   # noqa: E731
    return {
        "sources": q("SELECT storage_key FROM uploads WHERE source_deleted_at IS NULL"),
        "previews": q("SELECT preview_frame_key FROM uploads WHERE source_deleted_at IS NULL"),
        "outputs": q("SELECT storage_key FROM job_artifacts WHERE deleted_at IS NULL") | q("SELECT storage_key FROM report_files"),
    }


def orphan_scan(db: Session, store: LocalStorage, *, apply: bool = False, grace_seconds: int = GRACE_SECONDS) -> dict[str, Any]:
    known = _known_keys(db)
    now = time.time()
    orphans: list[str] = []
    removed = 0
    for area in AREAS:
        base = store.root / area
        if not base.is_dir():
            continue
        for path in base.rglob("*"):
            if not path.is_file() or path.is_symlink():
                continue
            key = path.relative_to(base).as_posix()
            if key in known[area]:
                continue
            if now - path.stat().st_mtime < grace_seconds:
                continue   # maybe still being written
            orphans.append(f"{area}/{key}")
            if apply:
                try:
                    path.unlink()
                    removed += 1
                except OSError:
                    pass
    missing = [f"{area}/{k}" for area, keys in known.items() for k in sorted(keys) if not (store.root / area / k).is_file()]
    return {"orphans": orphans, "removed": removed, "missingFiles": missing, "applied": apply}


def delete_source(db: Session, store: LocalStorage, *, org: Any, user_id: Any, project_id: UUID, upload_id: UUID) -> None:
    row = db.execute(text("""SELECT u.storage_key, u.preview_frame_key, u.source_deleted_at, u.status FROM uploads u
                             WHERE u.id = :u AND u.project_id = :p AND u.organization_id = :o FOR UPDATE"""),
                     {"u": upload_id, "p": project_id, "o": org}).mappings().first()
    if row is None or row["status"] != "ready":
        db.rollback()
        raise AppError("upload_not_found", 404, "That video was not found.")
    if row["source_deleted_at"] is not None:
        db.rollback()
        return   # already done: repeating is harmless
    busy = db.execute(text("SELECT count(*) FROM jobs WHERE upload_id = :u AND status IN ('queued','running')"), {"u": upload_id}).scalar_one()
    if busy:
        db.rollback()
        raise AppError("upload_in_use", 409, "This video is queued or being processed. Cancel or wait for the job first.")
    try:
        store.delete("sources", row["storage_key"])
        if row["preview_frame_key"]:
            store.delete("previews", row["preview_frame_key"])
    except StorageUnavailable:
        db.rollback()
        raise AppError("storage_unavailable", 503, "Storage is not available right now. Please try again.")
    db.execute(text("UPDATE uploads SET source_deleted_at = now(), updated_at = now() WHERE id = :u"), {"u": upload_id})
    audit_repository.record(db, action="upload_source_deleted", organization_id=org, actor_user_id=user_id, entity_type="upload", entity_id=upload_id)
    db.commit()


def main(argv: list[str]) -> int:
    from app.database.database import SessionLocal
    from app.storage import storage

    if not argv or argv[0] != "orphans":
        print("usage: python -m app.maintenance orphans [--apply]")
        return 2
    with SessionLocal() as db:
        out = orphan_scan(db, storage, apply="--apply" in argv)
    print(f"orphan files: {len(out['orphans'])}; removed: {out['removed']}; rows whose file is missing: {len(out['missingFiles'])}")
    for o in out["orphans"]:
        print("  orphan", o)
    for m in out["missingFiles"]:
        print("  missing", m)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
