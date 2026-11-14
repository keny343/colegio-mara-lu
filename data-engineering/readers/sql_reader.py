"""Reader SQLite — streaming via cursor."""

from __future__ import annotations

import json
import sqlite3
from pathlib import Path
from typing import Any, Dict, Iterator, Union


def read_sql(path: Union[str, Path]) -> Iterator[Dict[str, Any]]:
    path = Path(path)
    conn = sqlite3.connect(str(path))
    conn.row_factory = sqlite3.Row
    try:
        cur = conn.execute(
            "SELECT id, cliente_id, produto_id, data_transacao, categoria, "
            "quantidade, preco_unitario, valor_total, estado, descricao, "
            "localizacao, metadados FROM transacoes ORDER BY id"
        )
        while True:
            rows = cur.fetchmany(5000)
            if not rows:
                break
            for row in rows:
                meta_raw = row["metadados"]
                yield {
                    "id": row["id"],
                    "cliente_id": row["cliente_id"],
                    "produto_id": row["produto_id"],
                    "data_transacao": row["data_transacao"],
                    "categoria": row["categoria"],
                    "quantidade": row["quantidade"],
                    "preco_unitario": row["preco_unitario"],
                    "valor_total": row["valor_total"],
                    "estado": row["estado"],
                    "descricao": row["descricao"],
                    "localizacao": json.loads(row["localizacao"]),
                    "metadados": json.loads(meta_raw) if meta_raw else None,
                }
    finally:
        conn.close()
