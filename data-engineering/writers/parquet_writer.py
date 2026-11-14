"""Writer Parquet (colunar) via PyArrow — escrita incremental por lote."""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Union

import pyarrow as pa
import pyarrow.parquet as pq


def _records_to_table(batch: List[Dict[str, Any]]) -> pa.Table:
    """Converte lote para Table; nested structs viram JSON string + colunas planas.

    Para equivalência/validação, localizacao e metadados são gravados como
    strings JSON (compatível com CSV/JSONL) e também expandimos campos úteis.
    """
    ids = []
    cliente_ids = []
    produto_ids = []
    datas = []
    categorias = []
    quantidades = []
    precos = []
    valores = []
    estados = []
    descricoes = []
    localizacoes = []
    metadados_list = []
    cidades = []
    latitudes = []
    longitudes = []

    for r in batch:
        ids.append(r["id"])
        cliente_ids.append(r["cliente_id"])
        produto_ids.append(r["produto_id"])
        datas.append(r["data_transacao"])
        categorias.append(r["categoria"])
        quantidades.append(r["quantidade"])
        precos.append(r["preco_unitario"])
        valores.append(r["valor_total"])
        estados.append(r["estado"])
        descricoes.append(r["descricao"])
        loc = r["localizacao"]
        localizacoes.append(json.dumps(loc, ensure_ascii=False, separators=(",", ":")))
        cidades.append(loc["cidade"])
        latitudes.append(loc["latitude"])
        longitudes.append(loc["longitude"])
        meta = r.get("metadados")
        metadados_list.append(
            json.dumps(meta, ensure_ascii=False, separators=(",", ":")) if meta else None
        )

    return pa.table(
        {
            "id": pa.array(ids, type=pa.int64()),
            "cliente_id": pa.array(cliente_ids, type=pa.int64()),
            "produto_id": pa.array(produto_ids, type=pa.int64()),
            "data_transacao": pa.array(datas, type=pa.string()),
            "categoria": pa.array(categorias, type=pa.string()),
            "quantidade": pa.array(quantidades, type=pa.int32()),
            "preco_unitario": pa.array(precos, type=pa.string()),
            "valor_total": pa.array(valores, type=pa.string()),
            "estado": pa.array(estados, type=pa.string()),
            "descricao": pa.array(descricoes, type=pa.string()),
            "localizacao": pa.array(localizacoes, type=pa.string()),
            "metadados": pa.array(metadados_list, type=pa.string()),
            "cidade": pa.array(cidades, type=pa.string()),
            "latitude": pa.array(latitudes, type=pa.float64()),
            "longitude": pa.array(longitudes, type=pa.float64()),
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
