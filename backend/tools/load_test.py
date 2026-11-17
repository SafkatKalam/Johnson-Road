"""F44: measure API response times under concurrent use, and optionally queue several uploads at once.

Usage (from backend/; the API must be running):
    set JR_TOKEN=<a signed-in user's access token>        (never paste a real token into a file)
    python tools/load_test.py --base http://127.0.0.1:5000 --users 20 --seconds 30
    python tools/load_test.py --base ... --upload path/to/video.mp4 --project <project id> --uploads 4

Read-only by default: it calls GET /api/projects, /api/jobs, /api/analytics/summary, /api/notifications.
With --upload it uploads the given video N times at once (creates N real videos in that project).
Prints count, error count, and latency percentiles per route. Results are evidence for agreeing limits (O17/O43/O50);
re-run on the production hardware before promising capacity.
"""
from __future__ import annotations

import argparse
import os
import statistics
import threading
import time
import uuid
from collections import defaultdict

import httpx

ROUTES = ["/api/projects", "/api/jobs", "/api/analytics/summary", "/api/notifications"]


def pct(values: list[float], p: float) -> float:
    if not values:
        return 0.0
    values = sorted(values)
    k = min(len(values) - 1, max(0, int(round(p / 100 * (len(values) - 1)))))
    return values[k]


def run_reads(base: str, token: str, users: int, seconds: int) -> dict[str, dict]:
    stats: dict[str, list[float]] = defaultdict(list)
    errors: dict[str, int] = defaultdict(int)
    lock = threading.Lock()
    stop = time.monotonic() + seconds

    def user(i: int) -> None:
        with httpx.Client(base_url=base, headers={"Authorization": f"Bearer {token}"}, timeout=30) as c:
            n = i
            while time.monotonic() < stop:
                route = ROUTES[n % len(ROUTES)]
                n += 1
                t0 = time.perf_counter()
                try:
                    r = c.get(route)
                    ok = r.status_code < 500
                except httpx.HTTPError:
                    ok = False
                dt = (time.perf_counter() - t0) * 1000
                with lock:
                    stats[route].append(dt)
                    if not ok:
                        errors[route] += 1

    threads = [threading.Thread(target=user, args=(i,)) for i in range(users)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    return {r: {"count": len(v), "errors": errors[r], "p50_ms": pct(v, 50), "p95_ms": pct(v, 95), "p99_ms": pct(v, 99),
                "mean_ms": statistics.fmean(v) if v else 0.0} for r, v in stats.items()}


def run_uploads(base: str, token: str, project: str, path: str, n: int) -> list[tuple[int, float]]:
    results: list[tuple[int, float]] = []
    lock = threading.Lock()

    def one() -> None:
        t0 = time.perf_counter()
        with open(path, "rb") as fh, httpx.Client(base_url=base, timeout=None) as c:
            r = c.post(f"/api/projects/{project}/uploads", files={"file": (os.path.basename(path), fh)},
                       headers={"Authorization": f"Bearer {token}", "Idempotency-Key": f"load-{uuid.uuid4()}"})
        with lock:
            results.append((r.status_code, time.perf_counter() - t0))

    threads = [threading.Thread(target=one) for _ in range(n)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    return results


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--base", default="http://127.0.0.1:5000")
    ap.add_argument("--users", type=int, default=10)
    ap.add_argument("--seconds", type=int, default=20)
    ap.add_argument("--upload")
    ap.add_argument("--project")
    ap.add_argument("--uploads", type=int, default=2)
    args = ap.parse_args()
    token = os.environ.get("JR_TOKEN")
    if not token:
        ap.error("set JR_TOKEN to a signed-in user's access token")
    print(f"Reads: {args.users} users for {args.seconds}s against {args.base}")
    for route, s in sorted(run_reads(args.base, token, args.users, args.seconds).items()):
        print(f"  {route:<26} n={s['count']:<6} errors={s['errors']:<4} p50={s['p50_ms']:.0f}ms p95={s['p95_ms']:.0f}ms p99={s['p99_ms']:.0f}ms")
    if args.upload:
        if not args.project:
            ap.error("--upload needs --project")
        print(f"Uploads: {args.uploads} at once of {args.upload}")
        for status, secs in run_uploads(args.base, token, args.project, args.upload, args.uploads):
            print(f"  status {status} in {secs:.1f}s")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
