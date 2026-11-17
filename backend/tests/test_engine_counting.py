"""F31-F33: trackers, line crossing and zone presence on controlled motion. Pure Python, no database."""
import pytest

from app.engine.counting import Counter, LineCfg, ZoneCfg
from app.engine.geometry import point_in_polygon, segments_intersect, side_value
from app.engine.tracker import Detected, make_tracker

W, H = 1000, 1000


def box(cx, bottom, size=40):
    return (cx - size / 2, bottom - size, cx + size / 2, bottom)


def run(counter, tracker, paths, steps, fps=10.0, cls="car", conf=0.9):
    """paths: list of functions step -> (cx, bottom) or None (not visible)."""
    for step in range(steps):
        dets = []
        for p, c in paths:
            pos = p(step)
            if pos is not None:
                dets.append(Detected(box(*pos), c or cls, conf))
        tracks = tracker.update(dets)
        counter.update(tracks, step / fps)
    return counter


HLINE = LineCfg("L1", (0.1, 0.5), (0.9, 0.5), "forward")   # arrow points right; "left" is up on screen


def down(x):   # moves down the picture: crosses the horizontal line from above (left of arrow) to below (right) = forward
    return lambda s: (x, 300 + s * 20)


def up(x):
    return lambda s: (x, 700 - s * 20)


def test_geometry_basics():
    assert side_value((0.1, 0.5), (0.9, 0.5), (0.5, 0.4)) < 0 < side_value((0.1, 0.5), (0.9, 0.5), (0.5, 0.6))
    assert segments_intersect((0.5, 0.4), (0.5, 0.6), (0.1, 0.5), (0.9, 0.5)) is not None
    assert segments_intersect((0.95, 0.4), (0.95, 0.6), (0.1, 0.5), (0.9, 0.5)) is None   # past the end
    assert point_in_polygon((0.5, 0.5), [(0, 0), (1, 0), (1, 1), (0, 1)])
    assert point_in_polygon((1.0, 0.5), [(0, 0), (1, 0), (1, 1), (0, 1)])                 # edge counts
    assert not point_in_polygon((1.5, 0.5), [(0, 0), (1, 0), (1, 1), (0, 1)])


def test_forward_line_counts_downward_vehicle_once_and_ignores_upward():
    c = Counter([HLINE], [], W, H)
    run(c, make_tracker("bytetrack"), [(down(500), None), (up(300), None)], 30)
    ev = c.counted_events()
    assert [(e.direction) for e in ev] == ["forward"]


def test_backward_and_both_directions():
    back = Counter([LineCfg("L", (0.1, 0.5), (0.9, 0.5), "backward")], [], W, H)
    run(back, make_tracker("sort"), [(down(500), None), (up(300), None)], 30)
    assert [e.direction for e in back.counted_events()] == ["backward"]
    both = Counter([LineCfg("L", (0.1, 0.5), (0.9, 0.5), "both")], [], W, H)
    run(both, make_tracker("sort"), [(down(500), None), (up(300), None)], 30)
    assert sorted(e.direction for e in both.counted_events()) == ["backward", "forward"]


def test_a_vehicle_that_wobbles_back_and_forth_is_counted_once():
    wobble = lambda s: (500, 495 + (15 if (s // 2) % 2 else 0))   # noqa: E731  steps over the line and back, again and again
    c = Counter([LineCfg("L", (0.1, 0.5), (0.9, 0.5), "both")], [], W, H)
    run(c, make_tracker("sort"), [(wobble, None)], 20)
    assert len(c.counted_events()) == 1


def test_path_around_the_end_of_the_line_is_not_counted():
    short = LineCfg("L", (0.1, 0.5), (0.4, 0.5), "both")
    c = Counter([short], [], W, H)
    run(c, make_tracker("sort"), [(lambda s: (800, 300 + s * 20), None)], 30)   # far right of the segment's end
    assert c.counted_events() == []


def test_first_seen_exactly_on_the_line_does_not_count_until_it_really_crosses():
    c = Counter([HLINE], [], W, H)
    run(c, make_tracker("sort"), [(lambda s: (500, 500), None)], 10)               # sits on the line
    assert c.counted_events() == []


def test_two_lines_count_the_same_vehicle_once_each():
    l2 = LineCfg("L2", (0.1, 0.7), (0.9, 0.7), "forward")
    c = Counter([HLINE, l2], [], W, H)
    run(c, make_tracker("sort"), [(down(500), None)], 30)
    assert sorted(e.line_id for e in c.counted_events()) == ["L1", "L2"]


def test_flicker_track_seen_once_is_dropped():
    c = Counter([HLINE], [], W, H, min_hits=2)
    tr = make_tracker("sort")
    c.update(tr.update([Detected(box(500, 400), "car", 0.9)]), 0.0)
    c.update(tr.update([Detected(box(500, 600), "car", 0.9)]), 0.1)   # big jump: new track, old one lost
    assert c.counted_events() == [] and c.tracks_total == 0


def test_class_is_decided_from_the_whole_track():
    c = Counter([HLINE], [], W, H)
    tr = make_tracker("sort")
    for s in range(30):
        label = "truck" if s < 5 else "car"          # starts as a truck, is a car for most of its life
        c.update(tr.update([Detected(box(500, 300 + s * 20), label, 0.9)]), s / 10)
    assert [b["vehicle_class"] for b in c.buckets(900)] == ["car"]


def test_buckets_sum_equals_events_and_respect_bucket_boundaries():
    c = Counter([HLINE], [], W, H)
    run(c, make_tracker("sort"), [(down(300), None), (down(500), None), (down(700), None)], 30, fps=10)
    b = c.buckets(1)       # one-second buckets
    assert sum(x["vehicle_count"] for x in b) == len(c.counted_events()) == 3
    assert all(x["bucket_start_s"] == x["bucket_index"] for x in b)


def test_zone_presence_counts_once_including_first_frame_and_reentry():
    zone = ZoneCfg("Z1", ((0.3, 0.3), (0.7, 0.3), (0.7, 0.7), (0.3, 0.7)))
    c = Counter([], [zone], W, H)
    inside_then_out_then_in = lambda s: (500, 500) if s < 5 or s > 10 else (900, 900)   # noqa: E731
    run(c, make_tracker("sort"), [(inside_then_out_then_in, None)], 20)
    ev = c.counted_events()
    assert len(ev) == 1 and ev[0].direction == "not_applicable" and ev[0].t == 0.0 and ev[0].zone_id == "Z1"
    assert c.method == "zone_presence"


def test_overlapping_zones_count_once_per_zone():
    z1 = ZoneCfg("Z1", ((0.3, 0.3), (0.7, 0.3), (0.7, 0.7), (0.3, 0.7)))
    z2 = ZoneCfg("Z2", ((0.4, 0.4), (0.8, 0.4), (0.8, 0.8), (0.4, 0.8)))
    c = Counter([], [z1, z2], W, H)
    run(c, make_tracker("sort"), [(lambda s: (500, 550), None)], 10)
    assert sorted(e.zone_id for e in c.counted_events()) == ["Z1", "Z2"]


def test_line_event_is_attributed_to_the_first_zone_containing_the_crossing_or_none():
    zone = ZoneCfg("Z1", ((0.0, 0.4), (0.6, 0.4), (0.6, 0.6), (0.0, 0.6)))
    c = Counter([HLINE], [zone], W, H)
    run(c, make_tracker("sort"), [(down(300), None), (down(800), None)], 30)
    by_zone = sorted(str(e.zone_id) for e in c.counted_events())
    assert by_zone == ["None", "Z1"] and c.method == "line_crossing"


def test_counter_needs_a_line_or_a_zone():
    with pytest.raises(ValueError):
        Counter([], [], W, H)


def test_unknown_tracker_is_an_error_not_a_substitute():
    with pytest.raises(ValueError):
        make_tracker("botsort")


def test_tracker_keeps_ids_through_a_short_disappearance_and_separates_vehicles():
    tr = make_tracker("bytetrack")
    ids = []
    for s in range(12):
        dets = [Detected(box(200, 300 + s * 10), "car", 0.9), Detected(box(700, 300 + s * 10), "car", 0.9)]
        if s in (5, 6):
            dets = dets[1:]       # first vehicle hidden for two steps
        ids.append(sorted(t.id for t in tr.update(dets)))
    assert ids[0] == [1, 2] and ids[-1] == [1, 2]
    two_jobs = make_tracker("bytetrack")
    assert [t.id for t in two_jobs.update([Detected(box(100, 100), "car", 0.9)])] == [1]   # fresh tracker, ids restart
