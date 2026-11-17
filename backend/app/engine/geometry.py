"""Small geometry helpers. All coordinates are fractions of the frame (0 to 1), y grows downward like the picture.

Line direction (decision O66): "forward" means crossing from the LEFT of the arrow start->end to its RIGHT, as a person
looking at the picture sees it. With y pointing down, a point on the visual left has a negative cross product.
"""
from __future__ import annotations

Point = tuple[float, float]


def side_value(a: Point, b: Point, p: Point) -> float:
    """Negative on the left of a->b, positive on the right (picture view), zero on the line. Scaled to a distance in frame units."""
    ax, ay = a
    bx, by = b
    length = ((bx - ax) ** 2 + (by - ay) ** 2) ** 0.5
    if length == 0:
        return 0.0
    return ((bx - ax) * (p[1] - ay) - (by - ay) * (p[0] - ax)) / length


def segments_intersect(p1: Point, p2: Point, q1: Point, q2: Point) -> Point | None:
    """The crossing point of segment p1-p2 with the FINITE segment q1-q2, or None. A path that passes the end of the
    segment (goes around it) does not intersect."""
    rx, ry = p2[0] - p1[0], p2[1] - p1[1]
    sx, sy = q2[0] - q1[0], q2[1] - q1[1]
    denom = rx * sy - ry * sx
    if denom == 0:
        return None  # parallel: no single crossing
    t = ((q1[0] - p1[0]) * sy - (q1[1] - p1[1]) * sx) / denom
    u = ((q1[0] - p1[0]) * ry - (q1[1] - p1[1]) * rx) / denom
    if 0 <= t <= 1 and 0 <= u <= 1:
        return (p1[0] + t * rx, p1[1] + t * ry)
    return None


def point_in_polygon(p: Point, poly: list[Point]) -> bool:
    """Even-odd rule. A point exactly on an edge counts as inside."""
    x, y = p
    inside = False
    n = len(poly)
    for i in range(n):
        x1, y1 = poly[i]
        x2, y2 = poly[(i + 1) % n]
        # on the edge?
        cross = (x2 - x1) * (y - y1) - (y2 - y1) * (x - x1)
        if abs(cross) < 1e-12 and min(x1, x2) - 1e-12 <= x <= max(x1, x2) + 1e-12 and min(y1, y2) - 1e-12 <= y <= max(y1, y2) + 1e-12:
            return True
        if (y1 > y) != (y2 > y) and x < (x2 - x1) * (y - y1) / (y2 - y1) + x1:
            inside = not inside
    return inside


def iou(a: tuple[float, float, float, float], b: tuple[float, float, float, float]) -> float:
    """Overlap of two boxes given as (x1, y1, x2, y2)."""
    ix1, iy1 = max(a[0], b[0]), max(a[1], b[1])
    ix2, iy2 = min(a[2], b[2]), min(a[3], b[3])
    inter = max(0.0, ix2 - ix1) * max(0.0, iy2 - iy1)
    if inter <= 0:
        return 0.0
    union = (a[2] - a[0]) * (a[3] - a[1]) + (b[2] - b[0]) * (b[3] - b[1]) - inter
    return inter / union if union > 0 else 0.0
