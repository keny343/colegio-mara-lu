"""Testes de escrita + validação de equivalência (N pequeno)."""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from lab.pipeline import run_generate
from validation.equivalence import validate_destinations, compute_fingerprint, quality_rules
from generator.synthetic import generate_records


DESTS = ["jsonl", "csv", "avro", "parquet", "sql"]


@pytest.fixture
def small_run(tmp_path: Path):
    out = tmp_path / "run"
    result = run_generate(
        out_dir=out,
        records=200,
        seed=42,
        batch_size=50,
        destinations=DESTS,
    )
    return out, result


def test_generate_creates_all_files(small_run):
    out, result = small_run
    assert result["records"] == 200
    for dest in DESTS:
        assert dest in result["writes"]
        path = Path(result["writes"][dest]["path"])
        assert path.exists()
        assert path.stat().st_size > 0


def test_destinations_are_equivalent(small_run):
    out, _ = small_run
    report = validate_destinations(out, DESTS, sample_size=50)
    assert report["equivalent"] is True
    counts = {d: report["fingerprints"][d]["count"] for d in DESTS}
    assert all(c == 200 for c in counts.values())
    sums = {d: report["fingerprints"][d]["sum_valor_total"] for d in DESTS}
    assert len(set(sums.values())) == 1


def test_quality_rules_pass_on_synthetic():
    records = generate_records(100, seed=42)
    result = quality_rules(records)
    assert result["passed"] is True
    assert result["checked"] == 100


def test_fingerprint_stable():
    a = compute_fingerprint(generate_records(80, seed=11), sample_size=20)
    b = compute_fingerprint(generate_records(80, seed=11), sample_size=20)
    assert a["count"] == b["count"]
    assert a["sum_valor_total"] == b["sum_valor_total"]
    assert a["aggregate_sample_hash"] == b["aggregate_sample_hash"]
