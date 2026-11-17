"""F43: compare the app's counts with a manual count (ground truth), or two runs with each other (repeatability).

Usage (from backend/):
    python tools/evaluate_counts.py --app report.csv --truth manual.csv [--by class,direction] [--out result.md]
    python tools/evaluate_counts.py --app run1.csv --truth run2.csv --label-truth "run 2"      (repeatability)

--app    a CSV exported by the app (Reports > CSV); the table under the "bucket_index,..." header line is read.
--truth  a CSV with columns: bucket_start_seconds, vehicle_class, direction, count  (line/zone columns optional).
         One row per period and class (and direction) counted by a person watching the same video.
--by     which columns to group by besides the period: any of class, direction, line, zone (default: class).

It prints, and optionally writes as Markdown: the total from each side, the absolute and percentage difference, the mean
absolute error per period, and the worst periods. It does NOT turn confidence scores into an accuracy figure.
"""
from __future__ import annotations

import argparse
import csv
import io
from collections import defaultdict
from pathlib import Path

COLS = {"class": "vehicle_class", "direction": "direction", "line": "line", "zone": "zone"}


def _read_rows(path: Path) -> list[dict[str, str]]:
    text = path.read_text(encoding="utf-8-sig")
    lines = text.splitlines()
    start = next((i for i, l in enumerate(lines) if l.startswith("bucket_index,") or l.startswith("bucket_start_seconds,")), 0)
    return list(csv.DictReader(io.StringIO("\n".join(lines[start:]))))


def _aggregate(rows: list[dict[str, str]], by: list[str]) -> dict[tuple, int]:
    out: dict[tuple, int] = defaultdict(int)
    for r in rows:
        start = float(r.get("bucket_start_seconds") or 0)
        key = (start,) + tuple((r.get(COLS[b]) or "").strip().lower() for b in by)
        out[key] += int(float(r.get("count") or 0))
    return out


def evaluate(app_rows, truth_rows, by: list[str]) -> dict:
    a, t = _aggregate(app_rows, by), _aggregate(truth_rows, by)
    keys = sorted(set(a) | set(t))
    diffs = [(k, a.get(k, 0), t.get(k, 0)) for k in keys]
    total_a, total_t = sum(a.values()), sum(t.values())
    mae = sum(abs(x - y) for _, x, y in diffs) / len(diffs) if diffs else 0.0
    worst = sorted(diffs, key=lambda d: -abs(d[1] - d[2]))[:10]
    return {
        "total_app": total_a, "total_truth": total_t, "difference": total_a - total_t,
        "difference_percent": (100.0 * (total_a - total_t) / total_t) if total_t else None,
        "groups": len(diffs), "mean_absolute_error_per_group": mae, "worst": worst,
    }


def to_markdown(res: dict, by: list[str], app_label: str, truth_label: str) -> str:
    pct = f"{res['difference_percent']:+.1f}%" if res["difference_percent"] is not None else "n/a (truth total is 0)"
    lines = [
        "# Count comparison", "",
        f"| | {app_label} | {truth_label} |", "|---|---|---|",
        f"| Total | {res['total_app']} | {res['total_truth']} |", "",
        f"Difference: {res['difference']:+d} ({pct}). Groups compared (period x {', '.join(by)}): {res['groups']}. "
        f"Mean absolute error per group: {res['mean_absolute_error_per_group']:.2f}.", "",
        "## Largest differences", "", f"| Period start (s) | {' | '.join(by)} | {app_label} | {truth_label} |",
        "|" + "---|" * (3 + len(by)),
    ]
    for key, x, y in res["worst"]:
        lines.append(f"| {key[0]:g} | {' | '.join(key[1:])} | {x} | {y} |")
    lines += ["", "Counts from the app are estimates. This comparison measures them; it is not a confidence score."]
    return "\n".join(lines)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--app", required=True, type=Path)
    ap.add_argument("--truth", required=True, type=Path)
    ap.add_argument("--by", default="class")
    ap.add_argument("--out", type=Path)
    ap.add_argument("--label-app", default="app")
    ap.add_argument("--label-truth", default="manual count")
    args = ap.parse_args()
    by = [b.strip() for b in args.by.split(",") if b.strip()]
    if any(b not in COLS for b in by):
        ap.error(f"--by takes: {', '.join(COLS)}")
    res = evaluate(_read_rows(args.app), _read_rows(args.truth), by)
    md = to_markdown(res, by, args.label_app, args.label_truth)
    print(md)
    if args.out:
        args.out.write_text(md, encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
