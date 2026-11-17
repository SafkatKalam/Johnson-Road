"""Analysis settings, counting lines and zones for one uploaded video (F24, F25, F26).
Defaults here are proposals until approved (O20-O23, O28, O42, O66, O79, O80): the self-intersection rule for zones is NOT
enforced yet. At least one counting line or one zone is required (O42)."""
import math
import re
from typing import Any, Literal
from uuid import UUID

from fastapi import APIRouter, Depends
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
from sqlalchemy.orm import Session

from app.ai.settings import ai_settings
from app.auth.deps import Principal, current_member
from app.core.errors import AppError
from app.database.database import get_db
from app.repositories import analysis_config_repository as repo

router = APIRouter(prefix="/projects/{project_id}/uploads/{upload_id}", tags=["analysis-configuration"])

TRACKERS = ("bytetrack", "sort")   # only the trackers the engine really implements (app/engine/tracker.py); BoT-SORT is not offered
VEHICLE_CLASSES = ("car", "motorcycle", "bus", "truck", "bicycle")
DEFAULT_CLASSES = ("car", "motorcycle", "bus", "truck")
_NAME = re.compile(r"[\x00-\x1f\x7f]")
MAX_LINES, MAX_ZONES, MAX_POINTS = 20, 20, 50
MIN_LINE_LENGTH = 0.005      # in 0..1 frame units: shorter than half a percent of the frame is a click, not a line
MIN_ZONE_AREA = 0.0005


def _model_names() -> list[str]:
    return [ai_settings.model_path.replace("\\", "/").rsplit("/", 1)[-1]]


def _coord(v: float) -> float:
    if not isinstance(v, (int, float)) or not math.isfinite(v) or not 0 <= v <= 1:
        raise ValueError("coordinates must be numbers from 0 to 1")
    return float(v)


def _label(v: str) -> str:
    v = v.strip()
    if len(v) > 100 or _NAME.search(v):
        raise ValueError("name must be at most 100 characters without control characters")
    return v


class Point(BaseModel):
    model_config = ConfigDict(extra="forbid")
    x: float
    y: float

    _x = field_validator("x", "y")(classmethod(lambda cls, v: _coord(v)))


class LineIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str = ""
    start: Point
    end: Point
    direction: Literal["forward", "backward", "both"] = "forward"   # O66: forward = left of start->end to right

    _n = field_validator("name")(classmethod(lambda cls, v: _label(v)))

    @model_validator(mode="after")
    def _long_enough(self):
        if math.hypot(self.end.x - self.start.x, self.end.y - self.start.y) < MIN_LINE_LENGTH:
            raise ValueError("a counting line must have two clearly different points")
        return self


class ZoneIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str = ""
    points: list[Point] = Field(min_length=3, max_length=MAX_POINTS)

    _n = field_validator("name")(classmethod(lambda cls, v: _label(v)))

    @model_validator(mode="after")
    def _has_area(self):
        pts = self.points
        area = abs(sum(pts[i].x * pts[(i + 1) % len(pts)].y - pts[(i + 1) % len(pts)].x * pts[i].y for i in range(len(pts)))) / 2
        if area < MIN_ZONE_AREA:
            raise ValueError("a zone must enclose a visible area")
        return self


class ConfigIn(BaseModel):
    """Everything optional is filled with the server default and the RESOLVED value is stored (FD11), so a later change of
    the defaults never changes an old result."""
    model_config = ConfigDict(extra="forbid")

    model: str | None = None
    tracker: Literal["bytetrack", "sort"] | None = None
    confidenceThreshold: float | None = Field(None, ge=0.10, le=0.95)
    iouThreshold: float | None = Field(None, gt=0, le=1)
    frameSkip: int | None = Field(None, ge=1, le=30)
    batchSize: int | None = Field(None, ge=1, le=32)
    classes: list[Literal["car", "motorcycle", "bus", "truck", "bicycle"]] | None = Field(None, max_length=5)
    bucketSeconds: int | None = Field(None, ge=60, le=3600)
    generateReport: bool | None = None
    annotatedOutput: bool | None = None
    lines: list[LineIn] = Field(default_factory=list, max_length=MAX_LINES)
    zones: list[ZoneIn] = Field(default_factory=list, max_length=MAX_ZONES)

    @model_validator(mode="after")
    def _needs_a_counting_target(self):
        if not self.lines and not self.zones:
            raise ValueError("add at least one counting line or one zone")
        if self.classes is not None and len(set(self.classes)) != len(self.classes):
            raise ValueError("classes must not repeat")
        return self


def _resolve(body: ConfigIn) -> dict[str, Any]:
    models = _model_names()
    if body.model is not None and body.model not in models:
        raise AppError("unsupported_model", 422, f"That model is not available. Supported: {', '.join(models)}.")
    return {
        "model_name": body.model or models[0],
        "tracker": body.tracker or (ai_settings.tracker.lower() if ai_settings.tracker.lower() in TRACKERS else "bytetrack"),
        "confidence_threshold": body.confidenceThreshold if body.confidenceThreshold is not None else min(max(ai_settings.confidence_threshold, 0.10), 0.95),
        "iou_threshold": body.iouThreshold if body.iouThreshold is not None else ai_settings.iou_threshold,
        "frame_skip": body.frameSkip if body.frameSkip is not None else min(max(ai_settings.frame_skip, 1), 30),
        "batch_size": body.batchSize if body.batchSize is not None else min(max(ai_settings.batch_size, 1), 32),
        "classes": list(body.classes) if body.classes else list(DEFAULT_CLASSES),   # empty or omitted: resolved once, stored
        "bucket_seconds": body.bucketSeconds if body.bucketSeconds is not None else 900,
        "generate_report": True if body.generateReport is None else body.generateReport,
        "annotated_output": True if body.annotatedOutput is None else body.annotatedOutput,
    }


def _view(c: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": str(c["id"]), "uploadId": str(c["upload_id"]), "version": c["version_no"], "locked": c["locked_at"] is not None,
        "model": c["model_name"], "tracker": c["tracker"], "confidenceThreshold": float(c["confidence_threshold"]),
        "iouThreshold": float(c["iou_threshold"]), "frameSkip": c["frame_skip"], "batchSize": c["batch_size"],
        "classes": c["classes"], "bucketSeconds": c["bucket_seconds"], "generateReport": c["generate_report"],
        "annotatedOutput": c["annotated_output"], "createdAt": c["created_at"].isoformat(),
        "lines": [{"id": str(x["id"]), "name": x["name"], "start": {"x": x["x1"], "y": x["y1"]}, "end": {"x": x["x2"], "y": x["y2"]},
                   "direction": x["direction"]} for x in c["lines"]],
        "zones": [{"id": str(z["id"]), "name": z["name"], "points": z["points"] or []} for z in c["zones"]],
    }


@router.get("/configuration/options", summary="What can be chosen, and the defaults")
def options(who: Principal = Depends(current_member)):
    return {
        "models": _model_names(), "trackers": list(TRACKERS), "classes": list(VEHICLE_CLASSES),
        "defaults": {"model": _model_names()[0], "tracker": ai_settings.tracker.lower(), "classes": list(DEFAULT_CLASSES),
                     "confidenceThreshold": ai_settings.confidence_threshold, "iouThreshold": ai_settings.iou_threshold,
                     "frameSkip": ai_settings.frame_skip, "batchSize": ai_settings.batch_size, "bucketSeconds": 900,
                     "generateReport": True, "annotatedOutput": True},
        "limits": {"maxLines": MAX_LINES, "maxZones": MAX_ZONES, "maxZonePoints": MAX_POINTS},
    }


@router.get("/configuration", summary="The latest saved configuration for this video")
def read_configuration(project_id: UUID, upload_id: UUID, who: Principal = Depends(current_member), db: Session = Depends(get_db)):
    c = repo.latest(db, who.organization_id, project_id, upload_id)
    return {"configuration": _view(c) if c else None}


@router.put("/configuration", status_code=201, summary="Save a new configuration version (lines, zones and settings)")
def save_configuration(project_id: UUID, upload_id: UUID, body: ConfigIn, who: Principal = Depends(current_member),
                       db: Session = Depends(get_db)):
    c = repo.save_new_version(db, org=who.organization_id, user_id=who.user["id"], project_id=project_id, upload_id=upload_id,
                              values=_resolve(body),
                              lines=[{"name": ln.name, "x1": ln.start.x, "y1": ln.start.y, "x2": ln.end.x, "y2": ln.end.y,
                                      "direction": ln.direction} for ln in body.lines],
                              zones=[{"name": z.name, "points": [{"x": p.x, "y": p.y} for p in z.points]} for z in body.zones])
    return {"configuration": _view(c)}
