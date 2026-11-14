"""Gera HTML comparativo a partir de benchmark_report.json (RF10).

Sem dependência de matplotlib — saída autodocumentada para o relatório.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, List, Union


def _bar_svg(labels: List[str], values: List[float], title: str, unit: str) -> str:
    width = 640
    height = 280
    pad_l, pad_r, pad_t, pad_b = 56, 16, 36, 48
    chart_w = width - pad_l - pad_r
    chart_h = height - pad_t - pad_b
    vmax = max(values) if values else 1.0
    if vmax <= 0:
        vmax = 1.0
    n = max(len(values), 1)
    gap = 12
    bar_w = max(8, (chart_w - gap * (n + 1)) / n)
    rects = []
    texts = []
    for i, (lab, val) in enumerate(zip(labels, values)):
        x = pad_l + gap + i * (bar_w + gap)
        h = (val / vmax) * chart_h
        y = pad_t + chart_h - h
        rects.append(
            f'<rect x="{x:.1f}" y="{y:.1f}" width="{bar_w:.1f}" height="{h:.1f}" fill="#E8641A" rx="2"/>'
        )
        texts.append(
            f'<text x="{x + bar_w / 2:.1f}" y="{height - 16}" text-anchor="middle" '
            f'font-size="11" fill="#6B3A1F">{lab}</text>'
        )
        texts.append(
            f'<text x="{x + bar_w / 2:.1f}" y="{y - 4:.1f}" text-anchor="middle" '
            f'font-size="10" fill="#3D1F0A">{val:.3g}{unit}</text>'
        )
    return f"""
<svg viewBox="0 0 {width} {height}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="{title}">
  <text x="{pad_l}" y="22" font-size="14" font-weight="600" fill="#3D1F0A">{title}</text>
  <line x1="{pad_l}" y1="{pad_t + chart_h}" x2="{width - pad_r}" y2="{pad_t + chart_h}" stroke="#E5D5C8"/>
  {''.join(rects)}
  {''.join(texts)}
</svg>
"""


def render_html(report: Dict[str, Any]) -> str:
    formats = report.get("formats") or {}
    labels = [k.upper() for k in formats]
    bytes_vals = [float((formats[k].get("bytes_stats") or {}).get("median") or formats[k].get("bytes") or 0) for k in formats]
    write_vals = [
        float((formats[k].get("write_seconds") or {}).get("median") or 0) for k in formats
    ]
    read_vals = [
        float((formats[k].get("full_read_seconds") or {}).get("median") or 0) for k in formats
    ]

    rows = []
    for name, meta in formats.items():
        b = (meta.get("bytes_stats") or {}).get("median", meta.get("bytes"))
        w = (meta.get("write_seconds") or {}).get("median")
        r = (meta.get("full_read_seconds") or {}).get("median")
        c = meta.get("compression_vs_csv")
        rows.append(
            f"<tr><td>{name}</td><td>{b}</td><td>{w}</td><td>{r}</td><td>{c}</td></tr>"
        )

    return f"""<!DOCTYPE html>
<html lang="pt">
<head>
  <meta charset="utf-8"/>
  <title>Benchmark — Colégio Mara &amp; Lu</title>
  <style>
    body {{ font-family: Georgia, serif; margin: 2rem; color: #3D1F0A; background: #FBF5EE; }}
    h1 {{ font-size: 1.4rem; }}
    .meta {{ color: #6B3A1F; font-size: 0.95rem; }}
    table {{ border-collapse: collapse; width: 100%; margin: 1.5rem 0; background: #fff; }}
    th, td {{ border: 1px solid #E5D5C8; padding: 0.5rem 0.65rem; text-align: left; font-size: 0.9rem; }}
    th {{ background: #FFF0E6; }}
    .charts {{ display: grid; gap: 1.5rem; }}
    .chart {{ background: #fff; border: 1px solid #E5D5C8; padding: 0.75rem; }}
  </style>
</head>
<body>
  <h1>Benchmark de formatos de armazenamento</h1>
  <p class="meta">
    Registros: {report.get("records")} · seed {report.get("seed")} ·
    batch {report.get("batch_size")} · repeats {report.get("repeats")}
  </p>
  <table>
    <thead>
      <tr><th>Formato</th><th>Bytes (mediana)</th><th>Escrita s</th><th>Leitura s</th><th>vs CSV</th></tr>
    </thead>
    <tbody>
      {''.join(rows)}
    </tbody>
  </table>
  <div class="charts">
    <div class="chart">{_bar_svg(labels, bytes_vals, "Tamanho em disco", " B")}</div>
    <div class="chart">{_bar_svg(labels, write_vals, "Tempo de escrita", " s")}</div>
    <div class="chart">{_bar_svg(labels, read_vals, "Tempo de leitura completa", " s")}</div>
  </div>
  <p class="meta">{report.get("cold_cache_note", "")}</p>
</body>
</html>
"""


def write_charts(report_path: Union[str, Path], out_html: Union[str, Path, None] = None) -> Path:
    report_path = Path(report_path)
    report = json.loads(report_path.read_text(encoding="utf-8"))
    out = Path(out_html) if out_html else report_path.with_name("benchmark_charts.html")
    out.write_text(render_html(report), encoding="utf-8")
    return out
