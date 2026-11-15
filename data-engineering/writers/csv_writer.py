"""Writer CSV UTF-8 com cabeçalho.

Delimitador: vírgula (`,`) — documentado como CSV_DELIMITER.
Campos aninhados (periodos, turma_info, metadados) são serializados como JSON
em células de texto para preservar a estrutura em um CSV plano.
"""

from __future__ import annotations

import csv
import json
import os
from pathlib import Path
from typing import Any, Dict, Iterable, List, Union

from generator.synthetic import SCHEMA_FIELDS

# Delimitador documentado (vírgula). Alternativa comum: ";" (pt-BR Excel).
CSV_DELIMITER = ","
CSV_DELIMITER_NAME = "comma"

_NESTED = ("periodos", "turma_info", "metadados")


def _flatten(record: Dict[str, Any]) -> Dict[str, Any]:
    row = {k: record.get(k) for k in SCHEMA_FIELDS}
    for nested in _NESTED:
        val = row.get(nested)
        if val is None:
            row[nested] = ""
        else:
            row[nested] = json.dumps(val, ensure_ascii=False, separators=(",", ":"))
    if row.get("curso") is None:
        row["curso"] = ""
    if row.get("media_anual") is None:
        row["media_anual"] = ""
    return row


def write_csv(
    batches: Iterable[List[Dict[str, Any]]],
    path: Union[str, Path],
    delimiter: str = CSV_DELIMITER,
) -> Dict[str, Any]:
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    count = 0
    with path.open("w", encoding="utf-8", newline="") as fh:
        writer = csv.DictWriter(
            fh,
            fieldnames=SCHEMA_FIELDS,
            delimiter=delimiter,
            quoting=csv.QUOTE_MINIMAL,
        )
        writer.writeheader()
        for batch in batches:
            for record in batch:
                writer.writerow(_flatten(record))
                count += 1
    size = os.path.getsize(path)
    return {
        "path": str(path),
        "records": count,
        "bytes": size,
        "delimiter": delimiter,
        "delimiter_name": CSV_DELIMITER_NAME if delimiter == "," else "custom",
    }
