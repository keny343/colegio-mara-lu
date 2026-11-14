"""Reader Parquet — leitura completa e leitura de coluna única."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, Iterator, List, Optional, Union

import pyarrow.parquet as pq


def read_parquet(path: Union[str, Path]) -> Iterator[Dict[str, Any]]:
    """Lê o arquivo Parquet em batches de row-groups (streaming)."""
    path = Path(path)
    pf = pq.ParquetFile(path)
    for batch in pf.iter_batches(batch_size=8192):
        cols = batch.to_pydict()
        n = batch.num_rows
        for i in range(n):
            loc_raw = cols["localizacao"][i]
            meta_raw = cols["metadados"][i]
            yield {
                "id": cols["id"][i],
                "cliente_id": cols["cliente_id"][i],
                "produto_id": cols["produto_id"][i],
                "data_transacao": cols["data_transacao"][i],
                "categoria": cols["categoria"][i],
                "quantidade": cols["quantidade"][i],
                "preco_unitario": cols["preco_unitario"][i],
                "valor_total": cols["valor_total"][i],
                "estado": cols["estado"][i],
                "descricao": cols["descricao"][i],
                "localizacao": json.loads(loc_raw) if isinstance(loc_raw, str) else loc_raw,
                "metadados": (
                    json.loads(meta_raw)
                    if isinstance(meta_raw, str)
                    else meta_raw
                ),
            }


def read_parquet_column(
    path: Union[str, Path],
    column: str = "categoria",
) -> List[Any]:
    """Lê apenas uma coluna (vantagem colunar do Parquet)."""
    path = Path(path)
    table = pq.read_table(path, columns=[column])
    return table.column(0).to_pylist()


def parquet_group_by_categoria(path: Union[str, Path]) -> Dict[str, Dict[str, Any]]:
    """GROUP BY categoria: COUNT(*) e SUM(valor_total) sobre colunas Parquet."""
    from decimal import Decimal

    path = Path(path)
    table = pq.read_table(path, columns=["categoria", "valor_total"])
    categorias = table.column("categoria").to_pylist()
    valores = table.column("valor_total").to_pylist()

    agg: Dict[str, Dict[str, Any]] = {}
    for cat, val in zip(categorias, valores):
        bucket = agg.setdefault(cat, {"count": 0, "sum_valor_total": Decimal("0")})
        bucket["count"] += 1
        bucket["sum_valor_total"] += Decimal(str(val))

    return {
        k: {"count": v["count"], "sum_valor_total": str(v["sum_valor_total"])}
        for k, v in sorted(agg.items())
    }
