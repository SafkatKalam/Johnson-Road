"""F46: list every installed Python package and frontend package with its declared licence, from local metadata only
(nothing is sent anywhere). Writes docs/LICENCE_INVENTORY.md. This is an inventory for a legal review, not a legal opinion.

Usage (from backend/):  python tools/licence_inventory.py
"""
from __future__ import annotations

import json
from datetime import date
from importlib import metadata
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
WATCH = ("GPL", "AGPL", "LGPL", "SSPL", "Commons Clause", "BUSL", "Elastic", "Unknown", "UNKNOWN", "")


def python_packages() -> list[tuple[str, str, str]]:
    rows = []
    for dist in metadata.distributions():
        name = dist.metadata.get("Name") or "?"
        lic = (dist.metadata.get("License-Expression") or "").strip()
        if not lic:
            classifiers = [c.split("::")[-1].strip() for c in dist.metadata.get_all("Classifier") or [] if c.startswith("License ::")]
            lic = "; ".join(classifiers) or (dist.metadata.get("License") or "").strip().splitlines()[0:1][0] if (dist.metadata.get("License") or "").strip() else "; ".join(classifiers)
        rows.append((name, dist.version, lic or "Unknown"))
    return sorted(set(rows), key=lambda r: r[0].lower())


def npm_packages() -> list[tuple[str, str, str]]:
    root_pkg = json.loads((ROOT / "frontend" / "package.json").read_text(encoding="utf-8"))
    direct = {**root_pkg.get("dependencies", {}), **root_pkg.get("devDependencies", {})}
    rows = []
    for name in sorted(direct):
        pj = ROOT / "frontend" / "node_modules" / name / "package.json"
        if not pj.is_file():
            rows.append((name, direct[name], "not installed"))
            continue
        data = json.loads(pj.read_text(encoding="utf-8"))
        lic = data.get("license") or (data.get("licenses") or [{}])[0].get("type") if isinstance(data.get("licenses"), list) else data.get("license")
        rows.append((name, data.get("version", "?"), str(lic or "Unknown")))
    return rows


def flag(lic: str) -> str:
    return "**review**" if any(w and w.lower() in lic.lower() for w in WATCH if w) or lic in ("Unknown", "") else ""


def main() -> int:
    py, js = python_packages(), npm_packages()
    out = [
        "# Licence inventory", "",
        f"Generated {date.today().isoformat()} by `backend/tools/licence_inventory.py` from locally installed metadata. "
        "Declared licences only; a legal review must confirm them for the actual delivery model (F46).", "",
        "## Model weights", "",
        "| File | Source | Licence to check |", "|---|---|---|",
        "| `backend/yolov8n.pt`, `backend/yolo11n.pt` | Ultralytics | AGPL-3.0, or an Ultralytics Enterprise licence for closed-source/commercial delivery. **review** |",
        "", "Packages marked **review** have a copyleft, unknown or unusual licence.", "",
        f"## Python packages in the backend environment ({len(py)})", "", "| Package | Version | Declared licence | |", "|---|---|---|---|",
        *[f"| {n} | {v} | {l} | {flag(l)} |" for n, v, l in py],
        "", f"## Frontend direct dependencies ({len(js)})", "", "| Package | Version | Declared licence | |", "|---|---|---|---|",
        *[f"| {n} | {v} | {l} | {flag(l)} |" for n, v, l in js],
    ]
    target = ROOT / "docs" / "LICENCE_INVENTORY.md"
    target.write_text("\n".join(out) + "\n", encoding="utf-8")
    print(f"wrote {target} ({len(py)} Python, {len(js)} frontend packages)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
