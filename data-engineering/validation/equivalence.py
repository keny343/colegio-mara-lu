"""Validação de equivalência entre formatos e regras de qualidade.

Métricas:
- contagem de registros
- soma de media_anual (não-nulas)
- amostra de hashes de chaves distintas (id)
- regras de qualidade (não-nulos, ranges, situação vs média)
"""

from __future__ import annotations

import hashlib
import json
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Any, Callable, Dict, Iterable, Iterator, List, Optional, Union

from generator.synthetic import (
    PERIODOS,
    media_periodos,
    nota_minima_para,
    situacao_de,
)
from readers import READERS

DEST_FILENAMES = {
    "jsonl": "notas_aluno.jsonl",
    "csv": "notas_aluno.csv",
    "avro": "notas_aluno.avro",
    "parquet": "notas_aluno.parquet",
    "sql": "notas_aluno.db",
}


def _canonical_record(record: Dict[str, Any]) -> str:
    """Serialização canônica para hash (ordem de chaves estável)."""
    payload = {
        "id": record["id"],
        "aluno_id": record["aluno_id"],
        "matricula_id": record["matricula_id"],
        "disciplina_id": record["disciplina_id"],
        "serie_classe": record["serie_classe"],
        "periodos": record["periodos"],
        "media_anual": (
            None if record.get("media_anual") is None else str(record["media_anual"])
        ),
        "situacao": record["situacao"],
        "nota_minima": record["nota_minima"],
    }
    return json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def compute_fingerprint(
    records: Iterable[Dict[str, Any]],
    sample_size: int = 100,
) -> Dict[str, Any]:
    """Calcula contagem, soma de médias e hashes amostrados sem carregar tudo em lista."""
    count = 0
    total = Decimal("0")
    sample_hashes: List[str] = []
    id_hashes: Dict[int, str] = {}

    for record in records:
        count += 1
        media = record.get("media_anual")
        if media is not None and media != "":
            try:
                total += Decimal(str(media))
            except (InvalidOperation, TypeError):
                pass

        rid = int(record["id"])
        digest = hashlib.sha256(_canonical_record(record).encode("utf-8")).hexdigest()[:16]
        if len(sample_hashes) < sample_size:
            sample_hashes.append(f"{rid}:{digest}")
            id_hashes[rid] = digest
        elif rid % max(1, count // sample_size) == 0 and len(sample_hashes) < sample_size * 2:
            sample_hashes.append(f"{rid}:{digest}")
            id_hashes[rid] = digest

    sample_payload = "|".join(sorted(sample_hashes))
    aggregate = hashlib.sha256(sample_payload.encode("utf-8")).hexdigest()

    sampled = sorted(sample_hashes)[:sample_size]
    return {
        "count": count,
        "sum_media_anual": str(total),
        "sample_size": len(sampled),
        "sample_hashes": sampled,
        "aggregate_sample_hash": aggregate,
        "distinct_ids_sampled": len(id_hashes),
    }


def quality_rules(records: Iterable[Dict[str, Any]]) -> Dict[str, Any]:
    """Aplica regras de qualidade em streaming (domínio notas)."""
    checked = 0
    violations: List[Dict[str, Any]] = []
    max_report = 50

    for record in records:
        checked += 1
        rid = record.get("id")

        def _fail(rule: str, detail: str) -> None:
            if len(violations) < max_report:
                violations.append({"id": rid, "rule": rule, "detail": detail})

        for field in (
            "id", "aluno_id", "matricula_id", "aluno_nome", "turma_id", "turma_nome",
            "serie_classe", "ano_letivo", "turno", "disciplina_id", "disciplina",
            "periodos", "situacao", "nota_minima", "data_atualizacao", "turma_info",
        ):
            if record.get(field) is None or record.get(field) == "":
                _fail("not_null", f"{field} nulo/vazio")

        serie = record.get("serie_classe")
        if not isinstance(serie, int) or not (1 <= serie <= 12):
            _fail("serie_classe", f"serie={serie}")

        esperado_min = nota_minima_para(int(serie)) if isinstance(serie, int) else None
        if esperado_min is not None and record.get("nota_minima") != esperado_min:
            _fail(
                "nota_minima_consistente",
                f"esperado={esperado_min} obtido={record.get('nota_minima')}",
            )

        periodos = record.get("periodos") or {}
        if not isinstance(periodos, dict):
            _fail("periodos_validos", "periodos não é objecto")
        else:
            max_nota = 10 if isinstance(serie, int) and serie <= 6 else 20
            for key in PERIODOS:
                val = periodos.get(key)
                if val is None:
                    continue
                try:
                    n = Decimal(str(val))
                    if n < 0 or n > max_nota:
                        _fail("nota_range", f"{key}={val} max={max_nota}")
                except (InvalidOperation, TypeError) as exc:
                    _fail("nota_decimal", f"{key}: {exc}")

            media_calc = media_periodos(periodos)
            media_rec = record.get("media_anual")
            if media_calc is None and media_rec is not None:
                _fail("media_anual", "média presente sem períodos")
            elif media_calc is not None and media_rec is not None:
                if Decimal(str(media_calc)) != Decimal(str(media_rec)):
                    _fail(
                        "media_anual_consistente",
                        f"esperado={media_calc} obtido={media_rec}",
                    )

            minimo = int(record.get("nota_minima") or 0)
            situacao_esp = situacao_de(periodos, media_rec if media_rec is not None else media_calc, minimo)
            if record.get("situacao") != situacao_esp:
                _fail(
                    "situacao_consistente",
                    f"esperado={situacao_esp} obtido={record.get('situacao')}",
                )

        info = record.get("turma_info") or {}
        if not isinstance(info, dict) or "escola" not in info:
            _fail("turma_info_valida", "turma_info sem escola")

        if record.get("situacao") not in ("Positiva", "Negativa", "Em curso", "Sem notas"):
            _fail("situacao_enum", f"situacao={record.get('situacao')}")

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

    refs = [v for v in fingerprints.values() if "error" not in v]
    equivalent = False
    if len(refs) >= 2:
        base = refs[0]
        equivalent = all(
            r["count"] == base["count"]
            and r["sum_media_anual"] == base["sum_media_anual"]
            and r["aggregate_sample_hash"] == base["aggregate_sample_hash"]
            for r in refs[1:]
        )
    elif len(refs) == 1:
        equivalent = True

    return {
        "out_dir": str(out_dir),
        "destinations": destinations,
        "domain": "notas_aluno",
        "fingerprints": fingerprints,
        "equivalent": equivalent,
        "quality": quality,
    }
