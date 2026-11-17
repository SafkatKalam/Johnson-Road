"""A small, dependency-free PDF writer for reports (F38 PDF export).

It writes plain text pages (PDF 1.4, built-in Helvetica, WinAnsi characters). No library needs installing. Characters that
Helvetica cannot show are replaced with "?". Tables are laid out as fixed columns of monospaced text (Courier)."""
from __future__ import annotations

from typing import Any

PAGE_W, PAGE_H = 595, 842          # A4 in points
MARGIN = 50
LINE = 13
LINES_PER_PAGE = int((PAGE_H - 2 * MARGIN) / LINE)


def _pdf_text(s: str) -> str:
    out = []
    for ch in s:
        code = ord(ch)
        if ch in "\\()":
            out.append("\\" + ch)
        elif 32 <= code < 127 or 160 <= code < 256:
            out.append(ch)
        elif ch in "—–":
            out.append("-")
        else:
            out.append("?")
    return "".join(out)


class _Doc:
    def __init__(self) -> None:
        self.pages: list[list[tuple[str, int, str]]] = [[]]   # (font, size, text) per line

    def line(self, text: str = "", font: str = "F1", size: int = 10) -> None:
        if len(self.pages[-1]) >= LINES_PER_PAGE:
            self.pages.append([])
        self.pages[-1].append((font, size, text))

    def render(self) -> bytes:
        objects: list[bytes] = []

        def add(body: bytes) -> int:
            objects.append(body)
            return len(objects)

        catalog = add(b"")            # placeholders filled below
        pages_id = add(b"")
        f1 = add(b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>")
        f2 = add(b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>")
        f3 = add(b"<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>")
        page_ids = []
        total = len(self.pages)
        for n, lines in enumerate(self.pages, start=1):
            ops = ["BT"]
            y = PAGE_H - MARGIN
            for font, size, text in lines:
                ops.append(f"/{font} {size} Tf 1 0 0 1 {MARGIN} {y} Tm ({_pdf_text(text)}) Tj")
                y -= LINE
            ops.append(f"/F1 8 Tf 1 0 0 1 {MARGIN} {MARGIN - 20} Tm (Page {n} of {total} - counts are estimates) Tj")
            ops.append("ET")
            stream = "\n".join(ops).encode("latin-1")
            content = add(b"<< /Length %d >>\nstream\n" % len(stream) + stream + b"\nendstream")
            page_ids.append(add((f"<< /Type /Page /Parent {pages_id} 0 R /MediaBox [0 0 {PAGE_W} {PAGE_H}] "
                                 f"/Resources << /Font << /F1 {f1} 0 R /F2 {f2} 0 R /F3 {f3} 0 R >> >> /Contents {content} 0 R >>").encode()))
        objects[catalog - 1] = f"<< /Type /Catalog /Pages {pages_id} 0 R >>".encode()
        objects[pages_id - 1] = f"<< /Type /Pages /Kids [{' '.join(f'{p} 0 R' for p in page_ids)}] /Count {len(page_ids)} >>".encode()

        out = bytearray(b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n")
        offsets = []
        for i, body in enumerate(objects, start=1):
            offsets.append(len(out))
            out += f"{i} 0 obj\n".encode() + body + b"\nendobj\n"
        xref = len(out)
        out += f"xref\n0 {len(objects) + 1}\n0000000000 65535 f \n".encode()
        for off in offsets:
            out += f"{off:010d} 00000 n \n".encode()
        out += f"trailer\n<< /Size {len(objects) + 1} /Root {catalog} 0 R >>\nstartxref\n{xref}\n%%EOF\n".encode()
        return bytes(out)


def _clock(seconds: float) -> str:
    s = int(seconds)
    return f"{s // 3600:02d}:{(s % 3600) // 60:02d}:{s % 60:02d}"


def build_report_pdf(rep: dict[str, Any], analysis_version: str) -> bytes:
    snap = rep.get("metadata_snapshot") or {}
    rows = rep["rows"]
    d = _Doc()
    d.line(str(rep["title"]), "F2", 14)
    d.line()
    d.line("Counts are estimates produced by automatic video analysis.")
    d.line(f"Method: {'line crossing' if rep['method'] == 'line_crossing' else 'zone presence'}    Version: {rep['version']}")
    d.line(f"Project: {snap.get('project', {}).get('name', '')}")
    d.line(f"Video: {snap.get('video', {}).get('name', '')}")
    meta = snap.get("metadata", {})
    if meta.get("cameraId") or meta.get("recordedDate"):
        d.line(f"Camera: {meta.get('cameraId') or '-'}    Recorded: {meta.get('recordedDate') or '-'} {meta.get('recordedStartTime') or ''}")
    d.line(f"Analysis: {analysis_version}")
    d.line(f"Generated: {rep['generated_at'].isoformat() if rep.get('generated_at') else ''}")
    d.line(f"Period length: {rep['bucket_seconds']} seconds; times are from the start of the video.")
    d.line()
    total = sum(r["vehicle_count"] for r in rows)
    d.line(f"Vehicles counted: {total}", "F2", 11)
    by_class: dict[str, int] = {}
    by_dir: dict[str, int] = {}
    per_bucket: dict[int, int] = {}
    for r in rows:
        by_class[r["vehicle_class"]] = by_class.get(r["vehicle_class"], 0) + r["vehicle_count"]
        by_dir[r["direction"]] = by_dir.get(r["direction"], 0) + r["vehicle_count"]
        per_bucket[r["bucket_index"]] = per_bucket.get(r["bucket_index"], 0) + r["vehicle_count"]
    d.line("By class: " + (", ".join(f"{k} {v}" for k, v in sorted(by_class.items(), key=lambda kv: -kv[1])) or "none"))
    d.line("By direction: " + (", ".join(f"{k.replace('_', ' ')} {v}" for k, v in sorted(by_dir.items())) or "none"))
    if per_bucket:
        idx, n = max(per_bucket.items(), key=lambda kv: (kv[1], -kv[0]))
        d.line(f"Busiest period: starts {_clock(idx * rep['bucket_seconds'])}, {n} vehicles")
    d.line()
    d.line("Counts by period", "F2", 11)
    header = f"{'Start':<10}{'Class':<12}{'Direction':<16}{'Line':<16}{'Zone':<16}{'Count':>6}"
    d.line(header, "F3", 9)
    for r in rows:
        d.line(f"{_clock(float(r['bucket_start_s'])):<10}{r['vehicle_class'][:11]:<12}{r['direction'].replace('_', ' ')[:15]:<16}"
               f"{(r.get('line_name') or '-')[:15]:<16}{(r.get('zone_name') or '-')[:15]:<16}{r['vehicle_count']:>6}", "F3", 9)
    if not rows:
        d.line("No vehicles were counted with these options.")
    return d.render()
