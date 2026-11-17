"""Analytics (F37), reports and CSV export (F38), notifications (F39), activity history and audit log (F40).

Analytics use the LATEST completed job of each video (proposal; "agreed latest completed jobs per upload"). Line-crossing
totals and zone-presence totals are reported separately and never added together: they count different things."""
import csv
import hashlib
import io
from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Response
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.auth.deps import Principal, current_member
from app.core.errors import AppError
from app.database.database import get_db
from app.repositories import audit_repository, notification_repository, report_db_repository as reports
from app.reports_pdf import build_report_pdf
from app.storage import StorageKeyError, StorageUnavailable, make_key, storage

router = APIRouter(tags=["insights"])


def _iso(v: Any) -> str | None:
    return v.isoformat() if v is not None else None


# --- F37 analytics ----------------------------------------------------------------

@router.get("/analytics/summary", summary="Counted totals from the latest completed job of each video")
def analytics_summary(projectId: UUID | None = None, start: datetime | None = Query(None, alias="from"), end: datetime | None = Query(None, alias="to"),
                      who: Principal = Depends(current_member), db: Session = Depends(get_db)):
    if start and end and end < start:
        raise AppError("invalid_period", 422, "The end of the period must be after its start.")
    params = {"o": who.organization_id, "p": projectId, "f": start, "t": end}
    latest = """WITH latest AS (
        SELECT DISTINCT ON (j.upload_id) j.id, j.project_id, j.finished_at FROM jobs j
        WHERE j.organization_id = :o AND j.status = 'completed' AND (CAST(:p AS uuid) IS NULL OR j.project_id = :p)
          AND (CAST(:f AS timestamptz) IS NULL OR j.finished_at >= :f) AND (CAST(:t AS timestamptz) IS NULL OR j.finished_at <= :t)
        ORDER BY j.upload_id, j.finished_at DESC, j.id)"""
    rows = db.execute(text(latest + """
        SELECT r.method, b.vehicle_class, b.direction, l.project_id, sum(b.vehicle_count) AS n
        FROM latest l JOIN job_results r ON r.job_id = l.id JOIN count_buckets b ON b.result_id = r.id
        GROUP BY r.method, b.vehicle_class, b.direction, l.project_id"""), params).mappings().all()
    meta = db.execute(text(latest + " SELECT count(*) AS videos, max(finished_at) AS last FROM latest"), params).mappings().one()
    status = db.execute(text("""SELECT status, count(*) AS n FROM jobs WHERE organization_id = :o AND (CAST(:p AS uuid) IS NULL OR project_id = :p)
                                GROUP BY status"""), params).mappings().all()
    out: dict[str, Any] = {m: {"total": 0, "byClass": {}, "byDirection": {}} for m in ("lineCrossing", "zonePresence")}
    by_project: dict[str, dict[str, int]] = {}
    for r in rows:
        key = "lineCrossing" if r["method"] == "line_crossing" else "zonePresence"
        n = int(r["n"])
        out[key]["total"] += n
        out[key]["byClass"][r["vehicle_class"]] = out[key]["byClass"].get(r["vehicle_class"], 0) + n
        out[key]["byDirection"][r["direction"]] = out[key]["byDirection"].get(r["direction"], 0) + n
        bp = by_project.setdefault(str(r["project_id"]), {"lineCrossing": 0, "zonePresence": 0})
        bp[key] += n
    return {
        "isEstimate": True, "basis": "latest completed job of each video", "videosAnalysed": meta["videos"], "lastCompletedAt": _iso(meta["last"]),
        **out, "byProject": by_project, "jobsByStatus": {s["status"]: s["n"] for s in status},
        "period": {"from": _iso(start), "to": _iso(end)},
    }


# --- F38 reports ------------------------------------------------------------------

class ReportCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    type: Literal["summary", "peak"] = "summary"
    classes: list[Literal["car", "motorcycle", "bus", "truck", "bicycle"]] | None = Field(None, max_length=5)
    directions: list[Literal["forward", "backward", "not_applicable"]] | None = Field(None, max_length=3)
    newVersion: bool = False


def _report_view(r: dict[str, Any], full: bool) -> dict[str, Any]:
    v = {"id": str(r["id"]), "projectId": str(r["project_id"]), "jobId": str(r["job_id"]), "title": r["title"], "type": r["report_type"],
         "method": r["method"], "version": r["version"], "vehiclesCounted": r["vehicles_counted"], "generatedAt": _iso(r["generated_at"]),
         "isEstimate": True}
    if not full:
        return v
    rows = r["rows"]
    per_bucket: dict[int, int] = {}
    by_class: dict[str, int] = {}
    by_dir: dict[str, int] = {}
    for b in rows:
        per_bucket[b["bucket_index"]] = per_bucket.get(b["bucket_index"], 0) + b["vehicle_count"]
        by_class[b["vehicle_class"]] = by_class.get(b["vehicle_class"], 0) + b["vehicle_count"]
        by_dir[b["direction"]] = by_dir.get(b["direction"], 0) + b["vehicle_count"]
    peak = max(per_bucket.items(), key=lambda kv: (kv[1], -kv[0])) if per_bucket else None
    bs = r["bucket_seconds"]
    v.update({
        "options": r["options"], "bucketSeconds": bs, "analysisVersion": reports.analysis_version(r), "snapshot": r["metadata_snapshot"],
        "totalsByClass": by_class, "totalsByDirection": by_dir,
        "series": [{"index": i, "startSeconds": i * bs, "count": n} for i, n in sorted(per_bucket.items())],
        "peak": {"index": peak[0], "startSeconds": peak[0] * bs, "count": peak[1]} if peak else None,
        "rows": [{"index": b["bucket_index"], "startSeconds": float(b["bucket_start_s"]), "class": b["vehicle_class"], "direction": b["direction"],
                  "line": b["line_name"], "zone": b["zone_name"], "count": b["vehicle_count"]} for b in rows],
    })
    return v


@router.post("/jobs/{job_id}/reports", status_code=201, summary="Make a report from a completed job (same options: same report)")
def create_report(job_id: UUID, body: ReportCreate, response: Response, who: Principal = Depends(current_member), db: Session = Depends(get_db)):
    rep, existed = reports.create(db, org=who.organization_id, user_id=who.user["id"], job_id=job_id, report_type=body.type,
                                  options=reports.normalise_options(body.classes, body.directions), new_version=body.newVersion)
    if existed:
        response.status_code = 200
    return {"report": _report_view(rep, True), "existing": existed}


@router.get("/reports", summary="Reports of your organisation")
def list_reports(projectId: UUID | None = None, limit: int = Query(20, ge=1, le=100), offset: int = Query(0, ge=0, le=100000),
                 who: Principal = Depends(current_member), db: Session = Depends(get_db)):
    items, total = reports.list_reports(db, who.organization_id, project_id=projectId, limit=limit, offset=offset)
    return {"items": [_report_view(r, False) for r in items], "total": total, "limit": limit, "offset": offset}


@router.get("/reports/{report_id}", summary="One report with its numbers")
def read_report(report_id: UUID, who: Principal = Depends(current_member), db: Session = Depends(get_db)):
    return {"report": _report_view(reports.get(db, who.organization_id, report_id), True)}


def _cell(v: Any) -> Any:
    """Stop a spreadsheet from running a cell as a formula (CSV injection)."""
    if isinstance(v, str) and (v[:1] in ("\t", "\r") or v.lstrip()[:1] in ("=", "+", "-", "@", "＝", "＋", "－", "＠")):
        return "'" + v
    return v


def _build_csv(rep: dict[str, Any]) -> bytes:
    buf = io.StringIO()
    w = csv.writer(buf, lineterminator="\r\n")
    snap = rep["metadata_snapshot"] or {}
    w.writerow(["Johnson Road report", _cell(rep["title"])])
    w.writerow(["Counts are estimates", "yes"])
    w.writerow(["Method", rep["method"]])
    w.writerow(["Project", _cell(snap.get("project", {}).get("name", ""))])
    w.writerow(["Video", _cell(snap.get("video", {}).get("name", ""))])
    w.writerow(["Analysis version", _cell(reports.analysis_version(rep))])
    w.writerow(["Bucket seconds", rep["bucket_seconds"]])
    w.writerow(["Time base", "seconds from the start of the video"])
    w.writerow([])
    w.writerow(["bucket_index", "bucket_start_seconds", "vehicle_class", "direction", "line", "zone", "count"])
    for b in rep["rows"]:
        w.writerow([b["bucket_index"], float(b["bucket_start_s"]), b["vehicle_class"], b["direction"], _cell(b["line_name"] or ""),
                    _cell(b["zone_name"] or ""), b["vehicle_count"]])
    return ("﻿" + buf.getvalue()).encode("utf-8")   # BOM so Excel reads UTF-8 names correctly


def _export(report_id: UUID, fmt: str, who: Principal, db: Session) -> Response:
    """Build the file once, store it in the outputs area, reuse it afterwards (the numbers never change)."""
    rep = reports.get(db, who.organization_id, report_id)
    try:
        existing = reports.stored_file(db, report_id, fmt)
        if existing and storage.exists("outputs", existing["storage_key"]):
            with storage.open_read("outputs", existing["storage_key"]) as fh:
                data = fh.read()
        else:
            data = _build_csv(rep) if fmt == "csv" else build_report_pdf(rep, reports.analysis_version(rep))
            key = make_key(who.organization_id, rep["project_id"], fmt)
            size, digest = storage.write_stream("outputs", key, iter([data]), max_bytes=50 * 1024 * 1024)
            if not reports.save_file(db, report_id=report_id, fmt=fmt, storage_key=key, size=size, checksum=digest,
                                     version=reports.analysis_version(rep)):
                storage.delete("outputs", key)   # another request saved one first; theirs is identical
    except (StorageUnavailable, StorageKeyError):
        raise AppError("storage_unavailable", 503, "Storage is not available right now. Please try again.")
    name = f"report-{str(report_id)[:8]}-v{rep['version']}.{fmt}"
    media = "text/csv; charset=utf-8" if fmt == "csv" else "application/pdf"
    return Response(content=data, media_type=media,
                    headers={"Content-Disposition": f'attachment; filename="{name}"', "X-Content-Type-Options": "nosniff", "Cache-Control": "private"})


@router.get("/reports/{report_id}/export.csv", summary="Download the report as CSV (made once, then reused)")
def export_csv(report_id: UUID, who: Principal = Depends(current_member), db: Session = Depends(get_db)):
    return _export(report_id, "csv", who, db)


@router.get("/reports/{report_id}/export.pdf", summary="Download the report as PDF (made once, then reused)")
def export_pdf(report_id: UUID, who: Principal = Depends(current_member), db: Session = Depends(get_db)):
    return _export(report_id, "pdf", who, db)


# --- F39 notifications --------------------------------------------------------------

@router.get("/notifications", summary="Your notifications")
def list_notifications(unread: bool = False, limit: int = Query(20, ge=1, le=100), offset: int = Query(0, ge=0, le=100000),
                       who: Principal = Depends(current_member), db: Session = Depends(get_db)):
    items, total, unread_n = notification_repository.list_for_user(db, who.user["id"], who.organization_id, unread_only=unread, limit=limit, offset=offset)
    return {"items": [{"id": str(n["id"]), "kind": n["kind"], "title": n["title"], "detail": n["detail"], "link": n["link"],
                       "jobId": str(n["job_id"]) if n["job_id"] else None, "read": n["read_at"] is not None, "createdAt": _iso(n["created_at"])} for n in items],
            "total": total, "unreadCount": unread_n}


@router.post("/notifications/{notification_id}/read", summary="Mark one notification read")
def read_one(notification_id: UUID, who: Principal = Depends(current_member), db: Session = Depends(get_db)):
    return {"changed": notification_repository.mark_read(db, who.user["id"], who.organization_id, notification_id)}


@router.post("/notifications/read-all", summary="Mark all your notifications read")
def read_all(who: Principal = Depends(current_member), db: Session = Depends(get_db)):
    return {"changed": notification_repository.mark_read(db, who.user["id"], who.organization_id, None)}


# --- F40 activity history and audit log ----------------------------------------------

def _audit_view(a: dict[str, Any]) -> dict[str, Any]:
    return {"id": a["id"], "at": _iso(a["occurred_at"]), "action": a["action"], "outcome": a["outcome"], "reason": a["reason_code"],
            "entityType": a["entity_type"], "entityId": a["entity_id"], "actor": a["actor_name"] or a["actor_email"] or a["actor_kind"],
            "details": a["details"]}


_AUDIT_SELECT = """SELECT a.id, a.occurred_at, a.action, a.outcome, a.reason_code, a.entity_type, a.entity_id, a.actor_kind, a.details,
                          u.full_name AS actor_name, u.email AS actor_email
                   FROM audit_events a LEFT JOIN users u ON u.id = a.actor_user_id"""


@router.get("/projects/{project_id}/activity", summary="What happened in a project (who, what, when)")
def project_activity(project_id: UUID, limit: int = Query(50, ge=1, le=200), before: int | None = Query(None, ge=1),
                     who: Principal = Depends(current_member), db: Session = Depends(get_db)):
    if db.execute(text("SELECT 1 FROM projects WHERE id = :p AND organization_id = :o"), {"p": project_id, "o": who.organization_id}).first() is None:
        raise AppError("project_not_found", 404, "That project was not found.")
    rows = db.execute(text(_AUDIT_SELECT + """
        WHERE a.organization_id = :o AND a.outcome <> 'refused' AND (CAST(:b AS bigint) IS NULL OR a.id < :b) AND (
              (a.entity_type = 'project' AND a.entity_id = CAST(:p AS text))
           OR (a.entity_type = 'upload' AND a.entity_id IN (SELECT id::text FROM uploads WHERE project_id = :p))
           OR (a.entity_type = 'job' AND a.entity_id IN (SELECT id::text FROM jobs WHERE project_id = :p))
           OR (a.entity_type = 'report' AND a.entity_id IN (SELECT id::text FROM reports WHERE project_id = :p)))
        ORDER BY a.id DESC LIMIT :l"""), {"o": who.organization_id, "p": project_id, "b": before, "l": limit}).mappings().all()
    return {"items": [_audit_view(dict(r)) for r in rows], "nextBefore": rows[-1]["id"] if len(rows) == limit else None}


@router.get("/organization/audit", summary="The organisation's audit log (owner and administrator only)")
def org_audit(limit: int = Query(50, ge=1, le=200), before: int | None = Query(None, ge=1), action: str | None = Query(None, max_length=60),
              who: Principal = Depends(current_member), db: Session = Depends(get_db)):
    if who.role not in ("owner", "admin"):
        audit_repository.record_refusal(db, action="audit_read_refused", organization_id=who.organization_id, actor_user_id=who.user["id"],
                                        reason_code="role")
        raise AppError("forbidden", 403, "You are not allowed to do this.")
    rows = db.execute(text(_AUDIT_SELECT + """ WHERE a.organization_id = :o AND (CAST(:b AS bigint) IS NULL OR a.id < :b)
        AND (CAST(:a AS text) IS NULL OR a.action = :a) ORDER BY a.id DESC LIMIT :l"""),
                      {"o": who.organization_id, "b": before, "a": action, "l": limit}).mappings().all()
    return {"items": [_audit_view(dict(r)) for r in rows], "nextBefore": rows[-1]["id"] if len(rows) == limit else None}
