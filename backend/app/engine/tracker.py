"""Vehicle trackers (F31). Two real algorithms are supported and nothing else: "sort" and "bytetrack". Asking for another
name is an error, never a quiet switch (a different tracker changes the counts).

Both predict each track one step ahead with its last movement, then match detections to tracks by overlap (greedy, best
overlap first). "sort" uses every detection in one pass. "bytetrack" matches confident detections first, then uses the
weak ones only to keep existing tracks alive, and starts new tracks only from confident detections.

Limits (to be told to the client): a vehicle hidden for longer than `max_missed` steps gets a new id and can be counted
again; crowded scenes fragment ids. Counts are estimates, not unique vehicles.
"""
from __future__ import annotations

from dataclasses import dataclass, field

from app.engine.geometry import iou

SUPPORTED_TRACKERS = ("bytetrack", "sort")

Box = tuple[float, float, float, float]


@dataclass
class Detected:
    box: Box          # x1, y1, x2, y2 in pixels
    cls: str
    conf: float


@dataclass
class Track:
    id: int
    box: Box
    cls_votes: dict[str, float]
    conf: float
    hits: int = 1
    missed: int = 0
    velocity: tuple[float, float] = (0.0, 0.0)
    matched_now: bool = True
    history: list[Box] = field(default_factory=list)

    @property
    def cls(self) -> str:
        return max(self.cls_votes.items(), key=lambda kv: (kv[1], kv[0]))[0]

    def predicted(self) -> Box:
        dx, dy = self.velocity
        x1, y1, x2, y2 = self.box
        return (x1 + dx, y1 + dy, x2 + dx, y2 + dy)


class BaseTracker:
    def __init__(self, *, max_missed: int = 15, min_hits: int = 2, match_iou: float = 0.2, high_conf: float = 0.5):
        self.max_missed, self.min_hits, self.match_iou, self.high_conf = max_missed, min_hits, match_iou, high_conf
        self._tracks: list[Track] = []
        self._next_id = 1

    def _match(self, tracks: list[Track], dets: list[Detected]) -> tuple[list[tuple[Track, Detected]], list[Track], list[Detected]]:
        pairs = sorted(((iou(t.predicted(), d.box), ti, di) for ti, t in enumerate(tracks) for di, d in enumerate(dets)), reverse=True)
        used_t: set[int] = set()
        used_d: set[int] = set()
        matched: list[tuple[Track, Detected]] = []
        for score, ti, di in pairs:
            if score < self.match_iou:
                break
            if ti in used_t or di in used_d:
                continue
            used_t.add(ti)
            used_d.add(di)
            matched.append((tracks[ti], dets[di]))
        return (matched, [t for i, t in enumerate(tracks) if i not in used_t], [d for i, d in enumerate(dets) if i not in used_d])

    def _apply(self, track: Track, det: Detected) -> None:
        ox = (track.box[0] + track.box[2]) / 2
        oy = (track.box[1] + track.box[3]) / 2
        nx = (det.box[0] + det.box[2]) / 2
        ny = (det.box[1] + det.box[3]) / 2
        track.velocity = (0.6 * track.velocity[0] + 0.4 * (nx - ox), 0.6 * track.velocity[1] + 0.4 * (ny - oy))
        track.box, track.conf = det.box, det.conf
        track.cls_votes[det.cls] = track.cls_votes.get(det.cls, 0.0) + det.conf
        track.hits += 1
        track.missed = 0
        track.matched_now = True

    def _new(self, det: Detected) -> Track:
        t = Track(id=self._next_id, box=det.box, cls_votes={det.cls: det.conf}, conf=det.conf)
        self._next_id += 1
        return t

    def _assign(self, dets: list[Detected]) -> list[Detected]:
        """Match detections to tracks; return the detections left over as candidates for new tracks."""
        raise NotImplementedError

    def update(self, dets: list[Detected]) -> list[Track]:
        """One detection step. Returns the tracks seen in this step (confirmed or not; check `hits`)."""
        for t in self._tracks:
            t.matched_now = False
        leftovers = self._assign(dets)
        for d in leftovers:
            if self._may_start(d):
                self._tracks.append(self._new(d))
        for t in self._tracks:
            if not t.matched_now:
                t.missed += 1
        self._tracks = [t for t in self._tracks if t.missed <= self.max_missed]
        return [t for t in self._tracks if t.matched_now]

    def _may_start(self, d: Detected) -> bool:
        return True

    def confirmed(self, t: Track) -> bool:
        return t.hits >= self.min_hits


class SortTracker(BaseTracker):
    def _assign(self, dets):
        matched, _, rest = self._match(self._tracks, dets)
        for t, d in matched:
            self._apply(t, d)
        return rest


class ByteTracker(BaseTracker):
    def _assign(self, dets):
        high = [d for d in dets if d.conf >= self.high_conf]
        low = [d for d in dets if d.conf < self.high_conf]
        matched, left_tracks, rest_high = self._match(self._tracks, high)
        for t, d in matched:
            self._apply(t, d)
        matched2, _, _ = self._match(left_tracks, low)   # weak detections only keep an existing track alive
        for t, d in matched2:
            self._apply(t, d)
        return rest_high


def make_tracker(name: str, **options) -> BaseTracker:
    key = name.lower()
    if key == "sort":
        return SortTracker(**options)
    if key == "bytetrack":
        return ByteTracker(**options)
    raise ValueError(f"unsupported tracker '{name}' (supported: {', '.join(SUPPORTED_TRACKERS)})")
