"""Writer JSON Lines (.jsonl) — um objeto JSON por linha."""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any, Dict, Iterable, Iterator, List, Union


def write_jsonl(
    batches: Iterable[List[Dict[str, Any]]],
    path: Union[str, Path],
) -> Dict[str, Any]:
    """Escreve lotes em arquivo JSONL. Retorna estatísticas básicas."""
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    count = 0
    with path.open("w", encoding="utf-8", newline="\n") as fh:
        for batch in batches:
            for record in batch:
                fh.write(json.dumps(record, ensure_ascii=False, separators=(",", ":")))
                fh.write("\n")
                count += 1
    size = os.path.getsize(path)
    return {"path": str(path), "records": count, "bytes": size}


def iter_jsonl_batches(
    source_batches: Iterator[List[Dict[str, Any]]],
) -> Iterator[List[Dict[str, Any]]]:
    """Passthrough útil quando se quer teear o gerador."""
    yield from source_batches
