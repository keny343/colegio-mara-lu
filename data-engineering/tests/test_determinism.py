"""Testes de determinismo do gerador (N pequeno)."""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from generator.synthetic import (
    generate_batches,
    generate_records,
    media_periodos,
    nota_minima_para,
    situacao_de,
)


def test_same_seed_same_records():
    a = list(generate_records(50, seed=42))
    b = list(generate_records(50, seed=42))
    assert a == b


def test_different_seed_different_records():
    a = list(generate_records(50, seed=42))
    b = list(generate_records(50, seed=99))
    assert a != b


def test_batches_cover_all_and_preserve_order():
    flat = list(generate_records(23, seed=7))
    batched = []
    for batch in generate_batches(23, seed=7, batch_size=10):
        batched.extend(batch)
    assert len(batched) == 23
    assert batched == flat


def test_notas_schema_and_rules():
    rec = next(generate_records(1, seed=1))
    assert "periodos" in rec
    assert set(rec["periodos"].keys()) == {"1PP", "1PT", "2PP", "2PT", "3PP", "3PT"}
    assert rec["nota_minima"] == nota_minima_para(rec["serie_classe"])
    media = media_periodos(rec["periodos"])
    assert rec["media_anual"] == media
    assert rec["situacao"] == situacao_de(rec["periodos"], media, rec["nota_minima"])


def test_schema_has_nested_turma_info():
    rec = next(generate_records(1, seed=3))
    assert rec["turma_info"]["escola"] == "Colégio Mara & Lu"
    assert "provincia" in rec["turma_info"]
    assert "latitude" in rec["turma_info"]
    assert "longitude" in rec["turma_info"]
