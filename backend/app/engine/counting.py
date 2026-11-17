"""Counting (F32, F33, F34 totals).

Method: with at least one counting line the result method is "line_crossing"; with zones only it is "zone_presence".
- Line crossing: the count point is the bottom centre of the box (where the vehicle touches the road; a proposal, not
  yet agreed). A track is counted at most once per line, when its count point moves from one side of the line to the
  other AND the path between the two sightings really meets the finite line segment (going around the end does not
  count). A small band around the line (JITTER_BAND) is ignored so wobble on the line does not count. The direction rules
  follow geometry.py (O66). A crossing in a direction the line does not accept is ignored and does not use up the track.
- Zone presence (no lines): a track is counted once per zone, at the first sighting inside it (so a vehicle already
  inside on the first frame counts). Leaving and re-entering does not count again.
- Lines and zones together: a line crossing is attributed to the first zone (by sort order) that contains the crossing
  point, or to no zone.
- A track that is seen fewer than `min_hits` times is dropped at the end (flicker). The vehicle class of an event is
  decided at the end from all sightings of that track, not from the moment of crossing.
Counts are estimates: a vehicle that gets a new track id after being lost can be counted again.
"""
from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass
from typing import Any

from app.engine.geometry import point_in_polygon, segments_intersect, side_value
from app.engine.tracker import Track

JITTER_BAND = 0.003   # in frame units: this close to a line, a track is "on" it and its side does not change


@dataclass(frozen=True)
class LineCfg:
    id: str
    p1: tuple[float, float]
    p2: tuple[float, float]
    direction: str   # forward, backward, both


@dataclass(frozen=True)
class ZoneCfg:
    id: str
    points: tuple[tuple[float, float], ...]


@dataclass
class _Event:
    track_id: int
    t: float
    direction: str
    line_id: str | None
    zone_id: str | None


class Counter:
    def __init__(self, lines: list[LineCfg], zones: list[ZoneCfg], width: int, height: int, min_hits: int = 2):
        if not lines and not zones:
            raise ValueError("at least one counting line or zone is needed")
        self.lines, self.zones, self.w, self.h, self.min_hits = lines, zones, float(width), float(height), min_hits
        self.method = "line_crossing" if lines else "zone_presence"
        self._side: dict[tuple[int, str], tuple[int, tuple[float, float]]] = {}
        self._done: set[tuple[int, str | None, str | None]] = set()
        self._events: list[_Event] = []
        self._hits: dict[int, int] = defaultdict(int)
        self._cls: dict[int, str] = {}
        self._conf_sum: dict[int, float] = defaultdict(float)
        self.detections_total = 0

    def _point(self, t: Track) -> tuple[float, float]:
        x1, y1, x2, y2 = t.box
        return (((x1 + x2) / 2) / self.w, y2 / self.h)

    def update(self, tracks: list[Track], t_seconds: float) -> None:
        for tr in tracks:
            self.detections_total += 1
            self._hits[tr.id] = max(self._hits[tr.id], tr.hits)
            self._cls[tr.id] = tr.cls
            self._conf_sum[tr.id] += tr.conf
            pt = self._point(tr)
            if self.method == "line_crossing":
                for ln in self.lines:
                    self._line_step(tr, ln, pt, t_seconds)
            else:
                for z in self.zones:
                    key = (tr.id, None, z.id)
                    if key not in self._done and point_in_polygon(pt, list(z.points)):
                        self._done.add(key)
                        self._events.append(_Event(tr.id, t_seconds, "not_applicable", None, z.id))

    def _line_step(self, tr: Track, ln: LineCfg, pt: tuple[float, float], t: float) -> None:
        s = side_value(ln.p1, ln.p2, pt)
        sign = 0 if abs(s) < JITTER_BAND else (1 if s > 0 else -1)
        if sign == 0:
            return
        prev = self._side.get((tr.id, ln.id))
        self._side[(tr.id, ln.id)] = (sign, pt)
        if prev is None or prev[0] == sign:
            return
        hit = segments_intersect(prev[1], pt, ln.p1, ln.p2)
        if hit is None:
            return   # went around the end of the line
        direction = "forward" if prev[0] < 0 and sign > 0 else "backward"
        if ln.direction != "both" and ln.direction != direction:
            return
        key = (tr.id, ln.id, None)
        if key in self._done:
            return
        self._done.add(key)
        zone_id = next((z.id for z in self.zones if point_in_polygon(hit, list(z.points))), None)
        self._events.append(_Event(tr.id, t, direction, ln.id, zone_id))

    # --- totals ---

    @property
    def tracks_total(self) -> int:
        return sum(1 for n in self._hits.values() if n >= self.min_hits)

    def counted_events(self) -> list[_Event]:
        return [e for e in self._events if self._hits[e.track_id] >= self.min_hits]

    def buckets(self, bucket_seconds: int) -> list[dict[str, Any]]:
        """Counts grouped by time bucket, class, direction, line and zone. Bucket sums equal the number of counted events."""
        groups: dict[tuple, list[_Event]] = defaultdict(list)
        for e in self.counted_events():
            idx = int(e.t // bucket_seconds)
            groups[(idx, self._cls[e.track_id], e.direction, e.line_id, e.zone_id)].append(e)
        out = []
        for (idx, cls, direction, line_id, zone_id), evs in sorted(groups.items(), key=lambda kv: tuple(str(x) for x in kv[0])):
            confs = [self._conf_sum[e.track_id] / max(self._hits[e.track_id], 1) for e in evs]
            out.append({"bucket_index": idx, "bucket_start_s": idx * bucket_seconds, "vehicle_class": cls, "direction": direction,
                        "line_id": line_id, "zone_id": zone_id, "vehicle_count": len(evs),
                        "confidence_mean": round(min(max(sum(confs) / len(confs), 0.0), 1.0), 4)})
        return out

    def confidence_stats(self) -> tuple[float, float, float] | None:
        vals = [self._conf_sum[i] / max(self._hits[i], 1) for i, n in self._hits.items() if n >= self.min_hits]
        if not vals:
            return None
        return (round(sum(vals) / len(vals), 4), round(min(vals), 4), round(max(vals), 4))
