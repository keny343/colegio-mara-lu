"""CLI do laboratório — argparse (sem dependência obrigatória de click em runtime).

Subcomandos: generate (alias: run), validate, benchmark, full.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

# Garante imports relativos ao diretório data-engineering
_ROOT = Path(__file__).resolve().parent.parent
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))


def _add_common(parser: argparse.ArgumentParser) -> None:
    parser.add_argument("--records", type=int, default=10_000, help="Número de registros")
    parser.add_argument("--seed", type=int, default=42, help="Seed do PRNG (determinismo)")
    parser.add_argument("--batch-size", type=int, default=5_000, help="Tamanho do lote em memória")
    parser.add_argument(
        "--destinations",
        type=str,
        default="jsonl,csv,avro,parquet,sql",
        help="Lista separada por vírgula: jsonl,csv,avro,parquet,sql",
    )
    parser.add_argument(
        "--out",
        type=str,
        default="output/run1",
        help="Diretório de saída",
    )


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="lab",
        description="Laboratório de Engenharia de Dados — Colégio Mara & Lu",
    )
    sub = parser.add_subparsers(dest="command", required=True)

    p_gen = sub.add_parser("generate", aliases=["run"], help="Gera e grava nos destinos")
    _add_common(p_gen)

    p_val = sub.add_parser("validate", help="Valida equivalência e qualidade")
    p_val.add_argument("--out", type=str, default="output/run1")
    p_val.add_argument(
        "--destinations",
        type=str,
        default="jsonl,csv,avro,parquet,sql",
    )
    p_val.add_argument("--sample-size", type=int, default=100)

    p_bench = sub.add_parser("benchmark", help="Mede desempenho dos formatos")
    _add_common(p_bench)
    p_bench.add_argument("--repeats", type=int, default=1, help="Repetições (median/min/max)")
    p_bench.add_argument(
        "--report",
        type=str,
        default=None,
        help="Caminho do relatório JSON (default: <out>/benchmark_report.json)",
    )

    p_full = sub.add_parser("full", help="generate + validate + benchmark")
    _add_common(p_full)
    p_full.add_argument("--repeats", type=int, default=1)
    p_full.add_argument("--sample-size", type=int, default=100)

    p_charts = sub.add_parser("charts", help="Gera HTML comparativo a partir de um relatório JSON")
    p_charts.add_argument(
        "--report",
        type=str,
        required=True,
        help="Caminho para benchmark_report.json",
    )
    p_charts.add_argument(
        "--out-html",
        type=str,
        default=None,
        help="HTML de saída (default: ao lado do relatório)",
    )

    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)

    from lab.pipeline import parse_destinations, run_generate
    from validation.equivalence import validate_destinations
    from benchmark.runner import run_benchmark, save_report
    from benchmark.charts import write_charts

    if args.command == "charts":
        html = write_charts(args.report, args.out_html)
        print(f"Gráficos gerados em: {html}")
        return 0

    if args.command in ("generate", "run"):
        dests = parse_destinations(args.destinations)
        result = run_generate(
            out_dir=args.out,
            records=args.records,
            seed=args.seed,
            batch_size=args.batch_size,
            destinations=dests,
        )
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return 0

    if args.command == "validate":
        dests = parse_destinations(args.destinations)
        result = validate_destinations(
            out_dir=args.out,
            destinations=dests,
            sample_size=args.sample_size,
        )
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return 0 if result.get("equivalent") else 1

    if args.command == "benchmark":
        dests = parse_destinations(args.destinations)
        report = run_benchmark(
            out_dir=args.out,
            records=args.records,
            seed=args.seed,
            batch_size=args.batch_size,
            destinations=dests,
            repeats=args.repeats,
        )
        report_path = Path(args.report) if args.report else Path(args.out) / "benchmark_report.json"
        save_report(report, report_path)
        # Também copia para reports/
        reports_dir = _ROOT / "reports"
        reports_dir.mkdir(parents=True, exist_ok=True)
        save_report(report, reports_dir / f"benchmark_{Path(args.out).name}.json")
        html = write_charts(report_path)
        print(json.dumps(report, ensure_ascii=False, indent=2))
        print(f"\nRelatório salvo em: {report_path}", file=sys.stderr)
        print(f"Gráficos HTML: {html}", file=sys.stderr)
        return 0

    if args.command == "full":
        dests = parse_destinations(args.destinations)
        gen = run_generate(
            out_dir=args.out,
            records=args.records,
            seed=args.seed,
            batch_size=args.batch_size,
            destinations=dests,
        )
        print("=== GENERATE ===")
        print(json.dumps(gen, ensure_ascii=False, indent=2))

        val = validate_destinations(
            out_dir=args.out,
            destinations=dests,
            sample_size=args.sample_size,
        )
        print("=== VALIDATE ===")
        print(json.dumps(val, ensure_ascii=False, indent=2))

        # Benchmark regrava; usa subpasta para não destruir artefatos validados
        bench_dir = Path(args.out) / "benchmark"
        report = run_benchmark(
            out_dir=bench_dir,
            records=args.records,
            seed=args.seed,
            batch_size=args.batch_size,
            destinations=dests,
            repeats=args.repeats,
        )
        report_path = Path(args.out) / "benchmark_report.json"
        save_report(report, report_path)
        reports_dir = _ROOT / "reports"
        reports_dir.mkdir(parents=True, exist_ok=True)
        save_report(report, reports_dir / f"benchmark_{Path(args.out).name}.json")
        html = write_charts(report_path)
        print("=== BENCHMARK ===")
        print(json.dumps(report, ensure_ascii=False, indent=2))
        print(f"Gráficos HTML: {html}", file=sys.stderr)

        ok = bool(val.get("equivalent"))
        return 0 if ok else 1

    parser.error(f"Comando desconhecido: {args.command}")
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
