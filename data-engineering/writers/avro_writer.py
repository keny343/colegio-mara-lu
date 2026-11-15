"""Writer Avro com schema explícito (schemas/nota_aluno.avsc)."""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Union

from fastavro import parse_schema, writer as avro_file_writer

_DEFAULT_SCHEMA = (
    Path(__file__).resolve().parent.parent / "schemas" / "nota_aluno.avsc"
)


def load_avro_schema(schema_path: Optional[Union[str, Path]] = None) -> dict:
    path = Path(schema_path) if schema_path else _DEFAULT_SCHEMA
    with path.open("r", encoding="utf-8") as fh:
        return parse_schema(json.load(fh))


def write_avro(
    batches: Iterable[List[Dict[str, Any]]],
    path: Union[str, Path],
    schema_path: Optional[Union[str, Path]] = None,
) -> Dict[str, Any]:
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    schema = load_avro_schema(schema_path)
    count = 0

    def _records():
        nonlocal count
        for batch in batches:
            for record in batch:
                count += 1
                yield record

    with path.open("wb") as fh:
        avro_file_writer(fh, schema, _records())

    size = os.path.getsize(path)
    return {
        "path": str(path),
        "records": count,
        "bytes": size,
        "schema": str(schema_path or _DEFAULT_SCHEMA),
    }
