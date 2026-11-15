"""Writer Parquet (colunar) via PyArrow — escrita incremental por lote."""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Union

import pyarrow as pa
import pyarrow.parquet as pq


def _records_to_table(batch: List[Dict[str, Any]]) -> pa.Table:
    """Converte lote para Table; nested structs viram JSON string + colunas úteis."""
    ids = []
    aluno_ids = []
    matricula_ids = []
    nomes = []
    turma_ids = []
    turma_nomes = []
    series = []
    cursos = []
    anos = []
    turnos = []
    disc_ids = []
    disciplinas = []
    periodos_list = []
    medias = []
    situacoes = []
    minimas = []
    datas = []
    turma_infos = []
    metadados_list = []
    provincias = []
    municipios = []

    for r in batch:
        ids.append(r["id"])
        aluno_ids.append(r["aluno_id"])
        matricula_ids.append(r["matricula_id"])
        nomes.append(r["aluno_nome"])
        turma_ids.append(r["turma_id"])
        turma_nomes.append(r["turma_nome"])
        series.append(r["serie_classe"])
        cursos.append(r.get("curso"))
        anos.append(r["ano_letivo"])
        turnos.append(r["turno"])
        disc_ids.append(r["disciplina_id"])
        disciplinas.append(r["disciplina"])
        periodos_list.append(
            json.dumps(r["periodos"], ensure_ascii=False, separators=(",", ":"))
        )
        medias.append(r.get("media_anual"))
        situacoes.append(r["situacao"])
        minimas.append(r["nota_minima"])
        datas.append(r["data_atualizacao"])
        info = r["turma_info"]
        turma_infos.append(json.dumps(info, ensure_ascii=False, separators=(",", ":")))
        provincias.append(info.get("provincia"))
        municipios.append(info.get("municipio"))
        meta = r.get("metadados")
        metadados_list.append(
            json.dumps(meta, ensure_ascii=False, separators=(",", ":")) if meta else None
        )

    return pa.table(
        {
            "id": pa.array(ids, type=pa.int64()),
            "aluno_id": pa.array(aluno_ids, type=pa.int64()),
            "matricula_id": pa.array(matricula_ids, type=pa.int64()),
            "aluno_nome": pa.array(nomes, type=pa.string()),
            "turma_id": pa.array(turma_ids, type=pa.int64()),
            "turma_nome": pa.array(turma_nomes, type=pa.string()),
            "serie_classe": pa.array(series, type=pa.int32()),
            "curso": pa.array(cursos, type=pa.string()),
            "ano_letivo": pa.array(anos, type=pa.int32()),
            "turno": pa.array(turnos, type=pa.string()),
            "disciplina_id": pa.array(disc_ids, type=pa.int32()),
            "disciplina": pa.array(disciplinas, type=pa.string()),
            "periodos": pa.array(periodos_list, type=pa.string()),
            "media_anual": pa.array(medias, type=pa.string()),
            "situacao": pa.array(situacoes, type=pa.string()),
            "nota_minima": pa.array(minimas, type=pa.int32()),
            "data_atualizacao": pa.array(datas, type=pa.string()),
            "turma_info": pa.array(turma_infos, type=pa.string()),
            "metadados": pa.array(metadados_list, type=pa.string()),
            "provincia": pa.array(provincias, type=pa.string()),
            "municipio": pa.array(municipios, type=pa.string()),
        }
    )


def write_parquet(
    batches: Iterable[List[Dict[str, Any]]],
    path: Union[str, Path],
    compression: str = "snappy",
) -> Dict[str, Any]:
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    count = 0
    writer: Optional[pq.ParquetWriter] = None
    try:
        for batch in batches:
            if not batch:
                continue
            table = _records_to_table(batch)
            if writer is None:
                writer = pq.ParquetWriter(path, table.schema, compression=compression)
            writer.write_table(table)
            count += len(batch)
    finally:
        if writer is not None:
            writer.close()

    size = os.path.getsize(path) if path.exists() else 0
    return {
        "path": str(path),
        "records": count,
        "bytes": size,
        "compression": compression,
    }
