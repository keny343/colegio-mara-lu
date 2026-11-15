"""Reader Parquet — leitura completa e leitura de coluna única."""

from __future__ import annotations

import json
from decimal import Decimal
from pathlib import Path
from typing import Any, Dict, Iterator, List, Union

import pyarrow.parquet as pq


def read_parquet(path: Union[str, Path]) -> Iterator[Dict[str, Any]]:
    """Lê o arquivo Parquet em batches de row-groups (streaming)."""
    path = Path(path)
    pf = pq.ParquetFile(path)
    for batch in pf.iter_batches(batch_size=8192):
        cols = batch.to_pydict()
        n = batch.num_rows
        for i in range(n):
            periodos_raw = cols["periodos"][i]
            info_raw = cols["turma_info"][i]
            meta_raw = cols["metadados"][i]
            yield {
                "id": cols["id"][i],
                "aluno_id": cols["aluno_id"][i],
                "matricula_id": cols["matricula_id"][i],
                "aluno_nome": cols["aluno_nome"][i],
                "turma_id": cols["turma_id"][i],
                "turma_nome": cols["turma_nome"][i],
                "serie_classe": cols["serie_classe"][i],
                "curso": cols["curso"][i],
                "ano_letivo": cols["ano_letivo"][i],
                "turno": cols["turno"][i],
                "disciplina_id": cols["disciplina_id"][i],
                "disciplina": cols["disciplina"][i],
                "periodos": (
                    json.loads(periodos_raw)
                    if isinstance(periodos_raw, str)
                    else periodos_raw
                ),
                "media_anual": cols["media_anual"][i],
                "situacao": cols["situacao"][i],
                "nota_minima": cols["nota_minima"][i],
                "data_atualizacao": cols["data_atualizacao"][i],
                "turma_info": (
                    json.loads(info_raw) if isinstance(info_raw, str) else info_raw
                ),
                "metadados": (
                    json.loads(meta_raw)
                    if isinstance(meta_raw, str)
                    else meta_raw
                ),
            }


def read_parquet_column(
    path: Union[str, Path],
    column: str = "disciplina",
) -> List[Any]:
    """Lê apenas uma coluna (vantagem colunar do Parquet)."""
    path = Path(path)
    table = pq.read_table(path, columns=[column])
    return table.column(0).to_pylist()


def parquet_group_by_disciplina(path: Union[str, Path]) -> Dict[str, Dict[str, Any]]:
    """GROUP BY disciplina: COUNT(*) e SUM(media_anual) sobre colunas Parquet."""
    path = Path(path)
    table = pq.read_table(path, columns=["disciplina", "media_anual"])
    disciplinas = table.column("disciplina").to_pylist()
    medias = table.column("media_anual").to_pylist()

    agg: Dict[str, Dict[str, Any]] = {}
    for disc, media in zip(disciplinas, medias):
        bucket = agg.setdefault(disc, {"count": 0, "sum_media_anual": Decimal("0")})
        bucket["count"] += 1
        if media is not None and media != "":
            bucket["sum_media_anual"] += Decimal(str(media))

    return {
        k: {"count": v["count"], "sum_media_anual": str(v["sum_media_anual"])}
        for k, v in sorted(agg.items())
    }


# Alias legado para callers antigos
parquet_group_by_categoria = parquet_group_by_disciplina
