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
            "SELECT id, aluno_id, matricula_id, aluno_nome, turma_id, turma_nome, "
            "serie_classe, curso, ano_letivo, turno, disciplina_id, disciplina, "
            "periodos, media_anual, situacao, nota_minima, data_atualizacao, "
            "turma_info, metadados FROM notas_aluno ORDER BY id"
        )
        while True:
            rows = cur.fetchmany(5000)
            if not rows:
                break
            for row in rows:
                meta_raw = row["metadados"]
                yield {
                    "id": row["id"],
                    "aluno_id": row["aluno_id"],
                    "matricula_id": row["matricula_id"],
                    "aluno_nome": row["aluno_nome"],
                    "turma_id": row["turma_id"],
                    "turma_nome": row["turma_nome"],
                    "serie_classe": row["serie_classe"],
                    "curso": row["curso"],
                    "ano_letivo": row["ano_letivo"],
                    "turno": row["turno"],
                    "disciplina_id": row["disciplina_id"],
                    "disciplina": row["disciplina"],
                    "periodos": json.loads(row["periodos"]),
                    "media_anual": row["media_anual"],
                    "situacao": row["situacao"],
                    "nota_minima": row["nota_minima"],
                    "data_atualizacao": row["data_atualizacao"],
                    "turma_info": json.loads(row["turma_info"]),
                    "metadados": json.loads(meta_raw) if meta_raw else None,
                }
    finally:
        conn.close()
