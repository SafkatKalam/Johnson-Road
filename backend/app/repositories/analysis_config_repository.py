"""Analysis configuration versions with their counting lines and zones (F24, F25, F26).
Saving never edits a version: it adds version N+1 under a lock on the upload row, so two saves at once get two
distinct numbers. A version used by a job is locked by the database itself (migration section 9)."""
from __future__ import annotations

import json
from typing import Any
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.repositories import audit_repository


def _upload_scope(db: Session, org: Any, project_id: UUID, upload_id: UUID, *, lock: bool) -> None:
    row = db.execute(
        text(f"""SELECT u.status, u.source_deleted_at, p.archived_at FROM uploads u JOIN projects p ON p.id = u.project_id
                 WHERE u.id = :u AND u.project_id = :p AND u.organization_id = :o {'FOR UPDATE OF u' if lock else ''}"""),
        {"u": upload_id, "p": project_id, "o": org},
    ).mappings().first()
    if row is None or row["status"] != "ready" or row["source_deleted_at"] is not None:
        db.rollback()
        raise AppError("upload_not_found", 404, "That video was not found.")
    if lock and row["archived_at"] is not None:
        db.rollback()
        raise AppError("project_archived", 409, "This project is archived. Restore it before changing it.")


def _children(db: Session, config_id: Any) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    lines = db.execute(
        text("""SELECT id, name, x1, y1, x2, y2, direction FROM counting_lines WHERE configuration_id = :c ORDER BY sort_order, id"""),
        {"c": config_id}).mappings().all()
    zones = db.execute(
        text("""SELECT z.id, z.name, (SELECT json_agg(json_build_object('x', p.x, 'y', p.y) ORDER BY p.seq)
                                       FROM zone_points p WHERE p.zone_id = z.id) AS points
                FROM counting_zones z WHERE z.configuration_id = :c ORDER BY z.sort_order, z.id"""),
        {"c": config_id}).mappings().all()
    return [dict(x) for x in lines], [dict(z) for z in zones]


def _config_row(db: Session, where: str, params: dict[str, Any]) -> dict[str, Any] | None:
    row = db.execute(
        text(f"""SELECT id, upload_id, version_no, based_on_id, model_name, tracker, confidence_threshold, iou_threshold,
                        frame_skip, batch_size, classes, bucket_seconds, generate_report, annotated_output, created_at, locked_at
                 FROM analysis_configurations WHERE {where}"""), params).mappings().first()
    if row is None:
        return None
    out = dict(row)
    out["lines"], out["zones"] = _children(db, out["id"])
    return out


def latest(db: Session, org: Any, project_id: UUID, upload_id: UUID) -> dict[str, Any] | None:
    _upload_scope(db, org, project_id, upload_id, lock=False)
    return _config_row(db, "upload_id = :u ORDER BY version_no DESC LIMIT 1", {"u": upload_id})


def save_new_version(db: Session, *, org: Any, user_id: Any, project_id: UUID, upload_id: UUID, values: dict[str, Any],
                     lines: list[dict[str, Any]], zones: list[dict[str, Any]]) -> dict[str, Any]:
    _upload_scope(db, org, project_id, upload_id, lock=True)
    prev = db.execute(text("SELECT id, version_no FROM analysis_configurations WHERE upload_id = :u ORDER BY version_no DESC LIMIT 1"),
                      {"u": upload_id}).mappings().first()
    version = (prev["version_no"] + 1) if prev else 1
    cfg = db.execute(
        text("""INSERT INTO analysis_configurations (organization_id, project_id, upload_id, version_no, based_on_id, model_name,
                    tracker, confidence_threshold, iou_threshold, frame_skip, batch_size, classes, bucket_seconds,
                    generate_report, annotated_output, created_by)
                VALUES (:o, :p, :u, :v, :b, :model, :tracker, :conf, :iou, :skip, :batch, CAST(:classes AS jsonb), :bucket,
                        :report, :annotated, :by) RETURNING id"""),
        {"o": org, "p": project_id, "u": upload_id, "v": version, "b": prev["id"] if prev else None, "model": values["model_name"],
         "tracker": values["tracker"], "conf": values["confidence_threshold"], "iou": values["iou_threshold"],
         "skip": values["frame_skip"], "batch": values["batch_size"], "classes": json.dumps(values["classes"]),
         "bucket": values["bucket_seconds"], "report": values["generate_report"], "annotated": values["annotated_output"],
         "by": user_id},
    ).mappings().one()
    for i, ln in enumerate(lines):
        db.execute(text("""INSERT INTO counting_lines (configuration_id, name, x1, y1, x2, y2, direction, sort_order)
                           VALUES (:c, :name, :x1, :y1, :x2, :y2, :dir, :i)"""),
                   {"c": cfg["id"], "name": ln["name"], "x1": ln["x1"], "y1": ln["y1"], "x2": ln["x2"], "y2": ln["y2"],
                    "dir": ln["direction"], "i": i})
    for i, z in enumerate(zones):
        zid = db.execute(text("INSERT INTO counting_zones (configuration_id, name, sort_order) VALUES (:c, :n, :i) RETURNING id"),
                         {"c": cfg["id"], "n": z["name"], "i": i}).scalar_one()
        for seq, pt in enumerate(z["points"]):
            db.execute(text("INSERT INTO zone_points (zone_id, seq, x, y) VALUES (:z, :s, :x, :y)"),
                       {"z": zid, "s": seq, "x": pt["x"], "y": pt["y"]})
    audit_repository.record(db, action="analysis_configuration_saved", organization_id=org, actor_user_id=user_id,
                            entity_type="upload", entity_id=upload_id,
                            details={"version": version, "lines": len(lines), "zones": len(zones)})
    db.commit()
    return _config_row(db, "id = :c", {"c": cfg["id"]})  # type: ignore[return-value]
