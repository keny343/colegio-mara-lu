"""Runner de benchmark entre formatos.

Métricas:
- tamanho em disco
- tempo de escrita / taxa de escrita
- tempo de leitura completa
- leitura de coluna única (Parquet)
- GROUP BY categoria COUNT + SUM(valor_total)
- compressão vs CSV
- pico de memória (psutil) quando possível
- ≥1 corrida com nota de cold-cache
- median/min/max quando --repeats N
"""

from __future__ import annotations

import gc
import json
import statistics
import time
from decimal import Decimal
from pathlib import Path
from typing import Any, Callable, Dict, Iterable, List, Optional, Union

from generator.synthetic import generate_batches
from readers import READERS
from readers.parquet_reader import parquet_group_by_categoria, read_parquet_column
from validation.equivalence import DEST_FILENAMES
from writers import WRITERS

try:
    import psutil

    _HAS_PSUTIL = True
except ImportError:  # pragma: no cover
    _HAS_PSUTIL = False


def _rss_mb() -> Optional[float]:
    if not _HAS_PSUTIL:
        return None
    proc = psutil.Process()
    return proc.memory_info().rss / (1024 * 1024)


def _peak_tracker():
    """Context-like helper: chama start/sample/stop."""
    state = {"peak": _rss_mb(), "samples": []}

    def sample() -> None:
        m = _rss_mb()
        if m is not None:
            state["samples"].append(m)
            if state["peak"] is None or m > state["peak"]:
                state["peak"] = m

    return state, sample


def _agg_stats(values: List[float]) -> Dict[str, float]:
    if not values:
        return {"median": 0.0, "min": 0.0, "max": 0.0, "mean": 0.0}
    return {
        "median": statistics.median(values),
        "min": min(values),
        "max": max(values),
        "mean": statistics.fmean(values) if hasattr(statistics, "fmean") else statistics.mean(values),
    }


def _write_one(
    dest: str,
    records: int,
    seed: int,
    batch_size: int,
    out_path: Path,
) -> Dict[str, Any]:
    writer = WRITERS[dest]
    state, sample = _peak_tracker()
    sample()
    gc.collect()
    t0 = time.perf_counter()
    batches = generate_batches(records, seed=seed, batch_size=batch_size)
    # Amostra memória a cada lote via tee manual
    def _tracked():
        for batch in batches:
            sample()
            yield batch

    stats = writer(_tracked(), out_path)
    elapsed = time.perf_counter() - t0
    sample()
    rate = records / elapsed if elapsed > 0 else 0.0
    return {
        **stats,
        "write_seconds": elapsed,
        "write_records_per_sec": rate,
        "peak_rss_mb": state["peak"],
    }


def _full_read(dest: str, path: Path) -> Dict[str, Any]:
    reader = READERS[dest]
    state, sample = _peak_tracker()
    sample()
    t0 = time.perf_counter()
    count = 0
    total = Decimal("0")
    for record in reader(path):
        count += 1
        total += Decimal(str(record["valor_total"]))
        if count % 50_000 == 0:
            sample()
    elapsed = time.perf_counter() - t0
    sample()
    return {
        "read_seconds": elapsed,
        "records": count,
        "sum_valor_total": str(total),
        "read_records_per_sec": count / elapsed if elapsed > 0 else 0.0,
        "peak_rss_mb": state["peak"],
    }


def _group_by_generic(dest: str, path: Path) -> Dict[str, Any]:
    """GROUP BY categoria em streaming para qualquer formato."""
    if dest == "parquet":
        t0 = time.perf_counter()
        result = parquet_group_by_categoria(path)
        elapsed = time.perf_counter() - t0
        return {"seconds": elapsed, "groups": result}

    reader = READERS[dest]
    agg: Dict[str, Dict[str, Any]] = {}
    t0 = time.perf_counter()
    for record in reader(path):
        cat = record["categoria"]
        bucket = agg.setdefault(cat, {"count": 0, "sum_valor_total": Decimal("0")})
        bucket["count"] += 1
        bucket["sum_valor_total"] += Decimal(str(record["valor_total"]))
    elapsed = time.perf_counter() - t0
    return {
        "seconds": elapsed,
        "groups": {
            k: {"count": v["count"], "sum_valor_total": str(v["sum_valor_total"])}
            for k, v in sorted(agg.items())
        },
    }


def run_benchmark(
    out_dir: Union[str, Path],
    records: int,
    seed: int = 42,
    batch_size: int = 5_000,
    destinations: Optional[List[str]] = None,
    repeats: int = 1,
    cold_cache_note: bool = True,
) -> Dict[str, Any]:
    """Executa benchmark completo. Regrava a cada repeat para medir write."""
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    destinations = destinations or list(WRITERS.keys())
    repeats = max(1, repeats)

    report: Dict[str, Any] = {
        "records": records,
        "seed": seed,
        "batch_size": batch_size,
        "destinations": destinations,
        "repeats": repeats,
        "cold_cache_note": (
            "A primeira repetição (repeat=1) é tratada como cold-cache relativa "
            "ao processo: GC forçado antes da escrita; o SO pode ainda manter "
            "páginas em page cache. Para cold-cache real de disco, reinicie o "
            "serviço / limpe cache do SO (ex.: sync; echo 3 > /proc/sys/vm/drop_caches "
            "no Linux) entre corridas."
            if cold_cache_note
            else None
        ),
        "formats": {},
    }

    csv_bytes_ref: Optional[int] = None

    for dest in destinations:
        filename = DEST_FILENAMES[dest]
        path = out_dir / filename
        write_times: List[float] = []
        write_rates: List[float] = []
        read_times: List[float] = []
        sizes: List[int] = []
        peaks: List[float] = []
        last_write: Dict[str, Any] = {}
        last_read: Dict[str, Any] = {}
        group_by: Dict[str, Any] = {}
        col_read: Optional[Dict[str, Any]] = None

        for rep in range(1, repeats + 1):
            if path.exists():
                path.unlink()
            # Cold-cache note applies to first repeat
            last_write = _write_one(dest, records, seed, batch_size, path)
            write_times.append(last_write["write_seconds"])
            write_rates.append(last_write["write_records_per_sec"])
            sizes.append(last_write.get("bytes", path.stat().st_size if path.exists() else 0))
            if last_write.get("peak_rss_mb") is not None:
                peaks.append(last_write["peak_rss_mb"])

            last_read = _full_read(dest, path)
            read_times.append(last_read["read_seconds"])
            if last_read.get("peak_rss_mb") is not None:
                peaks.append(last_read["peak_rss_mb"])

            if rep == repeats:
                group_by = _group_by_generic(dest, path)
                if dest == "parquet":
                    t0 = time.perf_counter()
                    col = read_parquet_column(path, "categoria")
                    col_elapsed = time.perf_counter() - t0
                    col_read = {
                        "column": "categoria",
                        "seconds": col_elapsed,
                        "values": len(col),
                    }

        if dest == "csv":
            csv_bytes_ref = sizes[-1] if sizes else None

        fmt_report: Dict[str, Any] = {
            "path": str(path),
            "bytes": sizes[-1] if sizes else 0,
            "bytes_stats": _agg_stats([float(s) for s in sizes]),
            "write_seconds": _agg_stats(write_times),
            "write_records_per_sec": _agg_stats(write_rates),
            "full_read_seconds": _agg_stats(read_times),
            "peak_rss_mb": _agg_stats(peaks) if peaks else None,
            "group_by_categoria": group_by,
            "single_column_read": col_read,
            "last_write": last_write,
            "last_read": last_read,
            "cold_cache_first_repeat": True,
        }
        report["formats"][dest] = fmt_report

    # Compressão vs CSV
    if csv_bytes_ref and csv_bytes_ref > 0:
        for dest, fmt in report["formats"].items():
            b = fmt["bytes"]
            fmt["compression_vs_csv"] = {
                "csv_bytes": csv_bytes_ref,
                "ratio": b / csv_bytes_ref,
                "savings_pct": (1 - b / csv_bytes_ref) * 100.0,
            }

    return report


def save_report(report: Dict[str, Any], path: Union[str, Path]) -> Path:
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as fh:
        json.dump(report, fh, ensure_ascii=False, indent=2)
    return path
