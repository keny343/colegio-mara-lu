"""Testes de determinismo do gerador (N pequeno)."""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from generator.synthetic import generate_batches, generate_records


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


def test_money_fields_are_decimal_strings():
    rec = next(generate_records(1, seed=1))
    assert "." in rec["preco_unitario"]
    assert "." in rec["valor_total"]
    from decimal import Decimal

    preco = Decimal(rec["preco_unitario"])
    qty = Decimal(rec["quantidade"])
    total = Decimal(rec["valor_total"])
    assert total == (preco * qty).quantize(Decimal("0.01"))


def test_schema_has_nested_localizacao():
    rec = next(generate_records(1, seed=3))
    assert "cidade" in rec["localizacao"]
    assert "latitude" in rec["localizacao"]
    assert "longitude" in rec["localizacao"]
