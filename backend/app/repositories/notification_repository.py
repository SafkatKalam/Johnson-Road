"""In-app notifications (F39). A notice is written in the SAME transaction as the change it announces, so a job is never
"completed" without its notice and a rolled-back change leaves no notice. Links are app addresses only."""
from __future__ import annotations

from typing import Any
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.errors import AppError


def add(db: Session, *, user_id: Any, organization_id: Any, kind: str, title: str, detail: str = "", link: str | None = None,
        job_id: Any = None) -> None:
    """Caller commits. Nothing is written when there is no person to tell (for example a deleted user)."""
    if user_id is None:
        return
    if link is not None and not link.startswith("/"):
        raise ValueError("notification links must be app addresses")
    db.execute(text("""INSERT INTO notifications (user_id, organization_id, kind, title, detail, link, job_id)
                       SELECT :u, :o, :k, :t, :d, :l, :j
                       WHERE EXISTS (SELECT 1 FROM organization_members m WHERE m.user_id = :u AND m.organization_id = :o)"""),
               {"u": user_id, "o": organization_id, "k": kind, "t": title[:200], "d": detail[:1000], "l": link, "j": job_id})


def for_job(db: Session, job_id: Any, kind: str, title: str, detail: str = "") -> None:
    """Tell the person who queued the job. Caller commits."""
    row = db.execute(text("SELECT created_by, organization_id, metadata_snapshot FROM jobs WHERE id = :j"), {"j": job_id}).mappings().first()
    if row is None:
        return
    video = (row["metadata_snapshot"] or {}).get("video", {}).get("name") or "a video"
    add(db, user_id=row["created_by"], organization_id=row["organization_id"], kind=kind, title=title,
        detail=detail or f"Video: {video}", link=f"/job-queue?job={job_id}", job_id=job_id)


def list_for_user(db: Session, user_id: Any, organization_id: Any, *, unread_only: bool, limit: int, offset: int) -> tuple[list[dict[str, Any]], int, int]:
    params = {"u": user_id, "o": organization_id, "limit": limit, "offset": offset}
    extra = "AND read_at IS NULL" if unread_only else ""
    rows = db.execute(text(f"""SELECT id, kind, title, detail, link, job_id, read_at, created_at FROM notifications
                               WHERE user_id = :u AND organization_id = :o {extra} ORDER BY created_at DESC, id LIMIT :limit OFFSET :offset"""),
                      params).mappings().all()
    total = db.execute(text(f"SELECT count(*) FROM notifications WHERE user_id = :u AND organization_id = :o {extra}"), params).scalar_one()
    unread = db.execute(text("SELECT count(*) FROM notifications WHERE user_id = :u AND organization_id = :o AND read_at IS NULL"), params).scalar_one()
    return [dict(r) for r in rows], int(total), int(unread)


def mark_read(db: Session, user_id: Any, organization_id: Any, notification_id: UUID | None) -> int:
    """One notice (id) or all (None). Only the owner's own notices. Returns how many changed."""
    if notification_id is not None:
        exists = db.execute(text("SELECT 1 FROM notifications WHERE id = :n AND user_id = :u AND organization_id = :o"),
                            {"n": notification_id, "u": user_id, "o": organization_id}).first()
        if exists is None:
            raise AppError("notification_not_found", 404, "That notification was not found.")
    n = db.execute(text("""UPDATE notifications SET read_at = now() WHERE user_id = :u AND organization_id = :o AND read_at IS NULL
                           AND (CAST(:n AS uuid) IS NULL OR id = :n)"""), {"u": user_id, "o": organization_id, "n": notification_id}).rowcount
    db.commit()
    return n
