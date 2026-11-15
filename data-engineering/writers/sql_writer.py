"""Writer SQL — SQLite por padrão (portátil).

MySQL: use o mesmo DDL apontando DATABASE_URL / pymysql. Exemplo::

    mysql+pymysql://user:pass@host:3306/lab_notas_aluno

A tabela ``notas_aluno`` espelha o schema lógico; campos aninhados
ficam como TEXT JSON.
"""

from __future__ import annotations

import json
import os
import sqlite3
from pathlib import Path
from typing import Any, Dict, Iterable, List, Union

DDL_SQLITE = """
CREATE TABLE IF NOT EXISTS notas_aluno (
    id INTEGER PRIMARY KEY,
    aluno_id INTEGER NOT NULL,
    matricula_id INTEGER NOT NULL,
    aluno_nome TEXT NOT NULL,
    turma_id INTEGER NOT NULL,
    turma_nome TEXT NOT NULL,
    serie_classe INTEGER NOT NULL,
    curso TEXT,
    ano_letivo INTEGER NOT NULL,
    turno TEXT NOT NULL,
    disciplina_id INTEGER NOT NULL,
    disciplina TEXT NOT NULL,
    periodos TEXT NOT NULL,
    media_anual TEXT,
    situacao TEXT NOT NULL,
    nota_minima INTEGER NOT NULL,
    data_atualizacao TEXT NOT NULL,
    turma_info TEXT NOT NULL,
    metadados TEXT
);
"""

# DDL MySQL de referência (não executado por padrão):
DDL_MYSQL = """
CREATE TABLE IF NOT EXISTS notas_aluno (
    id BIGINT PRIMARY KEY,
    aluno_id BIGINT NOT NULL,
    matricula_id BIGINT NOT NULL,
    aluno_nome VARCHAR(200) NOT NULL,
    turma_id BIGINT NOT NULL,
    turma_nome VARCHAR(120) NOT NULL,
    serie_classe INT NOT NULL,
    curso VARCHAR(120) NULL,
    ano_letivo INT NOT NULL,
    turno VARCHAR(32) NOT NULL,
    disciplina_id INT NOT NULL,
    disciplina VARCHAR(120) NOT NULL,
    periodos JSON NOT NULL,
    media_anual VARCHAR(16) NULL,
    situacao VARCHAR(32) NOT NULL,
    nota_minima INT NOT NULL,
    data_atualizacao VARCHAR(32) NOT NULL,
    turma_info JSON NOT NULL,
    metadados JSON NULL,
    INDEX idx_disciplina (disciplina),
    INDEX idx_situacao (situacao)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
"""

INSERT_SQL = """
INSERT INTO notas_aluno (
    id, aluno_id, matricula_id, aluno_nome, turma_id, turma_nome,
    serie_classe, curso, ano_letivo, turno, disciplina_id, disciplina,
    periodos, media_anual, situacao, nota_minima, data_atualizacao,
    turma_info, metadados
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
"""


def _row(record: Dict[str, Any]) -> tuple:
    meta = record.get("metadados")
    return (
        record["id"],
        record["aluno_id"],
        record["matricula_id"],
        record["aluno_nome"],
        record["turma_id"],
        record["turma_nome"],
        record["serie_classe"],
        record.get("curso"),
        record["ano_letivo"],
        record["turno"],
        record["disciplina_id"],
        record["disciplina"],
        json.dumps(record["periodos"], ensure_ascii=False, separators=(",", ":")),
        record.get("media_anual"),
        record["situacao"],
        record["nota_minima"],
        record["data_atualizacao"],
        json.dumps(record["turma_info"], ensure_ascii=False, separators=(",", ":")),
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
