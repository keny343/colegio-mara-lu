"""Reader CSV — reconstrói campos aninhados a partir de JSON nas células."""

from __future__ import annotations

import csv
import json
from pathlib import Path
from typing import Any, Dict, Iterator, Union

from writers.csv_writer import CSV_DELIMITER


def read_csv(
    path: Union[str, Path],
    delimiter: str = CSV_DELIMITER,
) -> Iterator[Dict[str, Any]]:
    path = Path(path)
    with path.open("r", encoding="utf-8", newline="") as fh:
        reader = csv.DictReader(fh, delimiter=delimiter)
        for row in reader:
            loc_raw = row.get("localizacao") or ""
            meta_raw = row.get("metadados") or ""
            record: Dict[str, Any] = {
                "id": int(row["id"]),
                "cliente_id": int(row["cliente_id"]),
                "produto_id": int(row["produto_id"]),
                "data_transacao": row["data_transacao"],
                "categoria": row["categoria"],
                "quantidade": int(row["quantidade"]),
                "preco_unitario": row["preco_unitario"],
                "valor_total": row["valor_total"],
                "estado": row["estado"],
                "descricao": row["descricao"],
                "localizacao": json.loads(loc_raw) if loc_raw else {},
                "metadados": json.loads(meta_raw) if meta_raw else None,
            }
            yield record
