"""Validação de equivalência entre formatos e regras de qualidade.

Métricas:
- contagem de registros
- soma de valor_total
- amostra de hashes de chaves distintas (id)
- regras de qualidade (não-nulos, ranges, consistência monetária)
"""

from __future__ import annotations

import hashlib
import json
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Any, Callable, Dict, Iterable, Iterator, List, Optional, Union

from readers import READERS

DEST_FILENAMES = {
    "jsonl": "transacoes.jsonl",
    "csv": "transacoes.csv",
    "avro": "transacoes.avro",
    "parquet": "transacoes.parquet",
    "sql": "transacoes.db",
}


def _canonical_record(record: Dict[str, Any]) -> str:
    """Serialização canônica para hash (ordem de chaves estável)."""
    payload = {
        "id": record["id"],
        "cliente_id": record["cliente_id"],
        "produto_id": record["produto_id"],
        "data_transacao": record["data_transacao"],
        "categoria": record["categoria"],
        "quantidade": record["quantidade"],
        "preco_unitario": str(record["preco_unitario"]),
        "valor_total": str(record["valor_total"]),
        "estado": record["estado"],
        "descricao": record["descricao"],
        "localizacao": record["localizacao"],
        "metadados": record.get("metadados"),
    }
    return json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def compute_fingerprint(
    records: Iterable[Dict[str, Any]],
    sample_size: int = 100,
) -> Dict[str, Any]:
    """Calcula contagem, soma e hashes amostrados sem carregar tudo em lista."""
    count = 0
    total = Decimal("0")
    sample_hashes: List[str] = []
    # Amostra uniforme simples: primeiros + a cada passo após sample_size
    id_hashes: Dict[int, str] = {}

    for record in records:
        count += 1
        try:
            total += Decimal(str(record["valor_total"]))
        except (InvalidOperation, KeyError, TypeError):
            pass

        rid = int(record["id"])
        digest = hashlib.sha256(_canonical_record(record).encode("utf-8")).hexdigest()[:16]
        if len(sample_hashes) < sample_size:
            sample_hashes.append(f"{rid}:{digest}")
            id_hashes[rid] = digest
        elif rid % max(1, count // sample_size) == 0 and len(sample_hashes) < sample_size * 2:
            sample_hashes.append(f"{rid}:{digest}")
            id_hashes[rid] = digest

    # Hash agregado das amostras ordenadas por id
    sample_payload = "|".join(sorted(sample_hashes))
    aggregate = hashlib.sha256(sample_payload.encode("utf-8")).hexdigest()

    sampled = sorted(sample_hashes)[:sample_size]
    return {
        "count": count,
        "sum_valor_total": str(total),
        "sample_size": len(sampled),
        "sample_hashes": sampled,
        "aggregate_sample_hash": aggregate,
        "distinct_ids_sampled": len(id_hashes),
    }


def quality_rules(records: Iterable[Dict[str, Any]]) -> Dict[str, Any]:
    """Aplica regras de qualidade em streaming."""
    checked = 0
    violations: List[Dict[str, Any]] = []
    max_report = 50

    for record in records:
        checked += 1
        rid = record.get("id")

        def _fail(rule: str, detail: str) -> None:
            if len(violations) < max_report:
                violations.append({"id": rid, "rule": rule, "detail": detail})

        # Não-nulos essenciais
        for field in (
            "id", "cliente_id", "produto_id", "data_transacao", "categoria",
            "quantidade", "preco_unitario", "valor_total", "estado", "descricao",
            "localizacao",
        ):
            if record.get(field) is None or record.get(field) == "":
                _fail("not_null", f"{field} nulo/vazio")

        qty = record.get("quantidade")
        if not isinstance(qty, int) or qty < 1:
            _fail("quantidade_positiva", f"quantidade={qty}")

        try:
            preco = Decimal(str(record["preco_unitario"]))
            total = Decimal(str(record["valor_total"]))
            expected = (preco * Decimal(qty)).quantize(Decimal("0.01"))
            if total != expected:
                _fail(
                    "valor_total_consistente",
                    f"esperado={expected} obtido={total}",
                )
            if preco <= 0:
                _fail("preco_positivo", f"preco={preco}")
        except (InvalidOperation, KeyError, TypeError) as exc:
            _fail("decimal_valido", str(exc))

        loc = record.get("localizacao") or {}
        if not isinstance(loc, dict) or "cidade" not in loc:
            _fail("localizacao_valida", "localizacao sem cidade")

        estado = record.get("estado")
        if not isinstance(estado, str) or len(estado) != 2:
            _fail("estado_uf", f"estado={estado}")

    return {
        "checked": checked,
        "violations": violations,
        "violation_count": len(violations),
        "passed": len(violations) == 0,
    }


def validate_destinations(
    out_dir: Union[str, Path],
    destinations: List[str],
    sample_size: int = 100,
    run_quality: bool = True,
) -> Dict[str, Any]:
    """Compara fingerprints entre destinos e opcionalmente roda qualidade no primeiro."""
    out_dir = Path(out_dir)
    fingerprints: Dict[str, Any] = {}
    quality: Optional[Dict[str, Any]] = None

    for i, dest in enumerate(destinations):
        if dest not in READERS or dest not in DEST_FILENAMES:
            raise ValueError(f"Destino desconhecido: {dest}")
        path = out_dir / DEST_FILENAMES[dest]
        if not path.exists():
            fingerprints[dest] = {"error": f"arquivo ausente: {path}"}
            continue
        reader_fn: Callable[[Path], Iterator[Dict[str, Any]]] = READERS[dest]
        fingerprints[dest] = compute_fingerprint(reader_fn(path), sample_size=sample_size)
        if run_quality and i == 0 and "error" not in fingerprints[dest]:
            quality = quality_rules(reader_fn(path))

    # Equivalência: count + sum + aggregate hash
    refs = [v for v in fingerprints.values() if "error" not in v]
    equivalent = False
    if len(refs) >= 2:
        base = refs[0]
        equivalent = all(
            r["count"] == base["count"]
            and r["sum_valor_total"] == base["sum_valor_total"]
            and r["aggregate_sample_hash"] == base["aggregate_sample_hash"]
            for r in refs[1:]
        )
    elif len(refs) == 1:
        equivalent = True

    return {
        "out_dir": str(out_dir),
        "destinations": destinations,
        "fingerprints": fingerprints,
        "equivalent": equivalent,
        "quality": quality,
    }
