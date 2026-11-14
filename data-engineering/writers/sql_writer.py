"""Writer SQL — SQLite por padrão (portátil).

MySQL: use o mesmo DDL (sem tipos SQLite-específicos) apontando
DATABASE_URL / pymysql. Documentado no README. Exemplo de conexão MySQL::

    mysql+pymysql://user:pass@host:3306/lab_transacoes

A tabela ``transacoes`` espelha o schema lógico; campos aninhados
ficam como TEXT JSON.
"""

from __future__ import annotations

import json
import os
import sqlite3
from pathlib import Path
from typing import Any, Dict, Iterable, List, Union

DDL_SQLITE = """
CREATE TABLE IF NOT EXISTS transacoes (
    id INTEGER PRIMARY KEY,
    cliente_id INTEGER NOT NULL,
    produto_id INTEGER NOT NULL,
    data_transacao TEXT NOT NULL,
    categoria TEXT NOT NULL,
    quantidade INTEGER NOT NULL,
    preco_unitario TEXT NOT NULL,
    valor_total TEXT NOT NULL,
    estado TEXT NOT NULL,
    descricao TEXT NOT NULL,
    localizacao TEXT NOT NULL,
    metadados TEXT
);
"""

# DDL MySQL de referência (não executado por padrão):
DDL_MYSQL = """
CREATE TABLE IF NOT EXISTS transacoes (
    id BIGINT PRIMARY KEY,
    cliente_id BIGINT NOT NULL,
    produto_id BIGINT NOT NULL,
    data_transacao VARCHAR(32) NOT NULL,
    categoria VARCHAR(64) NOT NULL,
    quantidade INT NOT NULL,
    preco_unitario VARCHAR(32) NOT NULL,
    valor_total VARCHAR(32) NOT NULL,
    estado CHAR(2) NOT NULL,
    descricao TEXT NOT NULL,
    localizacao JSON NOT NULL,
    metadados JSON NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
"""

INSERT_SQL = """
INSERT INTO transacoes (
    id, cliente_id, produto_id, data_transacao, categoria, quantidade,
    preco_unitario, valor_total, estado, descricao, localizacao, metadados
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
"""


def _row(record: Dict[str, Any]) -> tuple:
    meta = record.get("metadados")
    return (
        record["id"],
        record["cliente_id"],
        record["produto_id"],
        record["data_transacao"],
        record["categoria"],
        record["quantidade"],
        record["preco_unitario"],
        record["valor_total"],
        record["estado"],
        record["descricao"],
        json.dumps(record["localizacao"], ensure_ascii=False, separators=(",", ":")),
        json.dumps(meta, ensure_ascii=False, separators=(",", ":")) if meta else None,
    )


def write_sql(
    batches: Iterable[List[Dict[str, Any]]],
    path: Union[str, Path],
) -> Dict[str, Any]:
    """Grava em arquivo SQLite (portátil, sem servidor)."""
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists():
        path.unlink()

    conn = sqlite3.connect(str(path))
    count = 0
    try:
        conn.execute(DDL_SQLITE)
        conn.execute("PRAGMA journal_mode=WAL")
        for batch in batches:
            rows = [_row(r) for r in batch]
            conn.executemany(INSERT_SQL, rows)
            count += len(rows)
        conn.commit()
    finally:
        conn.close()

    size = os.path.getsize(path)
    return {
        "path": str(path),
        "records": count,
        "bytes": size,
        "engine": "sqlite",
        "mysql_ddl_ref": "writers.sql_writer.DDL_MYSQL",
    }
