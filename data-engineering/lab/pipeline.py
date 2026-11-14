"""Pipeline: gera o mesmo dataset lógico e grava em múltiplos destinos.

Como a geração é determinística (seed fixa), cada destino é alimentado
pelo mesmo gerador lógico — sem materializar o dataset inteiro em memória.
"""

from __future__ import annotations

import json
import time
from pathlib import Path
from typing import Any, Dict, List, Optional, Union

from generator.synthetic import generate_batches
from validation.equivalence import DEST_FILENAMES
from writers import WRITERS


def parse_destinations(raw: str) -> List[str]:
    parts = [p.strip().lower() for p in raw.split(",") if p.strip()]
    unknown = [p for p in parts if p not in WRITERS]
    if unknown:
        raise ValueError(f"Destinos desconhecidos: {unknown}. Válidos: {list(WRITERS)}")
    if not parts:
        raise ValueError("Informe ao menos um destino")
    return parts


def run_generate(
    out_dir: Union[str, Path],
    records: int,
    seed: int = 42,
    batch_size: int = 5_000,
    destinations: Optional[List[str]] = None,
) -> Dict[str, Any]:
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    destinations = destinations or list(WRITERS.keys())

    results: Dict[str, Any] = {
        "out_dir": str(out_dir),
        "records": records,
        "seed": seed,
        "batch_size": batch_size,
        "destinations": destinations,
        "writes": {},
    }

    t0 = time.perf_counter()
    for dest in destinations:
        path = out_dir / DEST_FILENAMES[dest]
        if path.exists():
            path.unlink()
        batches = generate_batches(records, seed=seed, batch_size=batch_size)
        stats = WRITERS[dest](batches, path)
        results["writes"][dest] = stats
    results["elapsed_seconds"] = time.perf_counter() - t0

    meta_path = out_dir / "run_meta.json"
    with meta_path.open("w", encoding="utf-8") as fh:
        json.dump(results, fh, ensure_ascii=False, indent=2)
    results["meta_path"] = str(meta_path)
    return results
