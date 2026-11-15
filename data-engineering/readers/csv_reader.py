"""Reader CSV — reconstrói campos aninhados a partir de JSON nas células."""

from __future__ import annotations

import csv
import json
from pathlib import Path
from typing import Any, Dict, Iterator, Union

from writers.csv_writer import CSV_DELIMITER


def _opt_str(v: Any) -> Any:
    if v is None or v == "":
        return None
    return v


def read_csv(
    path: Union[str, Path],
    delimiter: str = CSV_DELIMITER,
) -> Iterator[Dict[str, Any]]:
    path = Path(path)
    with path.open("r", encoding="utf-8", newline="") as fh:
        reader = csv.DictReader(fh, delimiter=delimiter)
        for row in reader:
            periodos_raw = row.get("periodos") or ""
            info_raw = row.get("turma_info") or ""
            meta_raw = row.get("metadados") or ""
            record: Dict[str, Any] = {
                "id": int(row["id"]),
                "aluno_id": int(row["aluno_id"]),
                "matricula_id": int(row["matricula_id"]),
                "aluno_nome": row["aluno_nome"],
                "turma_id": int(row["turma_id"]),
                "turma_nome": row["turma_nome"],
                "serie_classe": int(row["serie_classe"]),
                "curso": _opt_str(row.get("curso")),
                "ano_letivo": int(row["ano_letivo"]),
                "turno": row["turno"],
                "disciplina_id": int(row["disciplina_id"]),
                "disciplina": row["disciplina"],
                "periodos": json.loads(periodos_raw) if periodos_raw else {},
                "media_anual": _opt_str(row.get("media_anual")),
                "situacao": row["situacao"],
                "nota_minima": int(row["nota_minima"]),
                "data_atualizacao": row["data_atualizacao"],
                "turma_info": json.loads(info_raw) if info_raw else {},
                "metadados": json.loads(meta_raw) if meta_raw else None,
            }
            yield record
