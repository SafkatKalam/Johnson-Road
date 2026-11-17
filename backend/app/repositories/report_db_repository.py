"""Reports (F38). A report is a saved view of ONE completed job's counts with normalised options. Asking again with the same
options returns the same report (REQ 3.22); asking for a new version makes version N+1. The numbers are always read from
the job's stored count buckets, which never change, so a report cannot drift from its job."""
from __future__ import annotations

import hashlib
import json
from typing import Any
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.repositories import audit_repository, notification_repository

REPORT_TYPES = ("summary", "peak")          # 'daily' and 'weekly' need agreed clock rules (O34/O68): not offered yet
DIRECTIONS = ("forward", "backward", "not_applicable")


def normalise_options(classes: list[str] | None, directions: list[str] | None) -> dict[str, Any]:
    return {"classes": sorted(set(classes)) if classes else None, "directions": sorted(set(directions)) if directions else None}


def options_hash(options: dict[str, Any]) -> str:
    return hashlib.sha256(json.dumps(options, sort_keys=True, separators=(",", ":")).encode()).hexdigest()


def _not_found() -> AppError:
    return AppError("report_not_found", 404, "That report was not found.")


def create(db: Session, *, org: Any, user_id: Any, job_id: UUID, report_type: str, options: dict[str, Any], new_version: bool) -> tuple[dict[str, Any], bool]:
    job = db.execute(text("""SELECT j.id, j.project_id, j.status, j.metadata_snapshot, r.method FROM jobs j
                             LEFT JOIN job_results r ON r.job_id = j.id WHERE j.id = :j AND j.organization_id = :o FOR UPDATE OF j"""),
                     {"j": job_id, "o": org}).mappings().first()
    if job is None:
        db.rollback()
        raise AppError("job_not_found", 404, "That job was not found.")
    if job["status"] != "completed" or job["method"] is None:
        db.rollback()
        raise AppError("job_not_completed", 409, "A report can only be made from a completed job.")
    h = options_hash(options)
    latest = db.execute(text("""SELECT id, version FROM reports WHERE job_id = :j AND report_type = :t AND options_hash = :h
                                ORDER BY version DESC LIMIT 1"""), {"j": job_id, "t": report_type, "h": h}).mappings().first()
    if latest is not None and not new_version:
        db.rollback()
        return get(db, org, latest["id"]), True
    version = (latest["version"] + 1) if latest else 1
    rows = _filtered_buckets(db, job_id, options)
    total = sum(r["vehicle_count"] for r in rows)
    video = (job["metadata_snapshot"] or {}).get("video", {}).get("name") or "video"
    rid = db.execute(text("""INSERT INTO reports (organization_id, project_id, job_id, title, report_type, options, method, metadata_snapshot,
                                                  options_hash, version, vehicles_counted, generated_by)
                             VALUES (:o, :p, :j, :t, :rt, CAST(:opt AS jsonb), :m, CAST(:s AS jsonb), :h, :v, :n, :u) RETURNING id"""),
                     {"o": org, "p": job["project_id"], "j": job_id, "t": f"{report_type.capitalize()} report: {video}"[:200], "rt": report_type,
                      "opt": json.dumps(options), "m": job["method"], "s": json.dumps(job["metadata_snapshot"]), "h": h, "v": version,
                      "n": total, "u": user_id}).scalar_one()
    audit_repository.record(db, action="report_created", organization_id=org, actor_user_id=user_id, entity_type="report", entity_id=rid,
                            details={"jobId": str(job_id), "version": version})
    notification_repository.add(db, user_id=user_id, organization_id=org, kind="report_ready", title="Report ready",
                                detail=f"{report_type.capitalize()} report for {video}.", link=f"/reports?report={rid}")
    db.commit()
    return get(db, org, rid), False


def _filtered_buckets(db: Session, job_id: Any, options: dict[str, Any]) -> list[dict[str, Any]]:
    rows = db.execute(text("""SELECT b.bucket_index, b.bucket_start_s, b.vehicle_class, b.direction, b.line_id, b.zone_id, b.vehicle_count,
                                     b.confidence_mean, l.name AS line_name, z.name AS zone_name
                              FROM count_buckets b LEFT JOIN counting_lines l ON l.id = b.line_id LEFT JOIN counting_zones z ON z.id = b.zone_id
                              WHERE b.job_id = :j ORDER BY b.bucket_index, b.vehicle_class, b.direction, b.line_id, b.zone_id"""),
                      {"j": job_id}).mappings().all()
    cls, dirs = options.get("classes"), options.get("directions")
    return [dict(r) for r in rows if (not cls or r["vehicle_class"] in cls) and (not dirs or r["direction"] in dirs)]


def get(db: Session, org: Any, report_id: UUID) -> dict[str, Any]:
    row = db.execute(text("""SELECT r.*, jr.bucket_seconds, jr.model_name, jr.model_file_sha256, jr.code_version, c.version_no AS config_version
                             FROM reports r JOIN job_results jr ON jr.job_id = r.job_id JOIN jobs j ON j.id = r.job_id
                             JOIN analysis_configurations c ON c.id = j.configuration_id
                             WHERE r.id = :r AND r.organization_id = :o"""), {"r": report_id, "o": org}).mappings().first()
    if row is None:
        raise _not_found()
    out = dict(row)
    out["rows"] = _filtered_buckets(db, row["job_id"], row["options"] or {})
    return out


def list_reports(db: Session, org: Any, *, project_id: UUID | None, limit: int, offset: int) -> tuple[list[dict[str, Any]], int]:
    params = {"o": org, "p": project_id, "limit": limit, "offset": offset}
    where = "organization_id = :o AND (CAST(:p AS uuid) IS NULL OR project_id = :p)"
    total = db.execute(text(f"SELECT count(*) FROM reports WHERE {where}"), params).scalar_one()
    rows = db.execute(text(f"""SELECT id, project_id, job_id, title, report_type, method, version, vehicles_counted, generated_at
                               FROM reports WHERE {where} ORDER BY generated_at DESC, id LIMIT :limit OFFSET :offset"""), params).mappings().all()
    return [dict(r) for r in rows], int(total)


def analysis_version(rep: dict[str, Any]) -> str:
    return f"configuration v{rep['config_version']}; model {rep['model_name']} ({rep['model_file_sha256'][:12]}); code {rep['code_version']}"


def stored_file(db: Session, report_id: Any, fmt: str) -> dict[str, Any] | None:
    row = db.execute(text("SELECT storage_key, size_bytes FROM report_files WHERE report_id = :r AND format = :f"), {"r": report_id, "f": fmt}).mappings().first()
    return dict(row) if row else None


def save_file(db: Session, *, report_id: Any, fmt: str, storage_key: str, size: int, checksum: str, version: str) -> bool:
    """Record an exported file. Returns False if another request recorded one first (the caller then removes its copy)."""
    n = db.execute(text("""INSERT INTO report_files (report_id, format, storage_key, size_bytes, checksum_sha256, analysis_version)
                           VALUES (:r, :f, :k, :s, :c, :v) ON CONFLICT (report_id, format) DO NOTHING"""),
                   {"r": report_id, "f": fmt, "k": storage_key, "s": size, "c": checksum, "v": version}).rowcount
    db.commit()
    return n == 1
