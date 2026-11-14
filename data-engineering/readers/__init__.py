"""Readers streaming para validação e benchmark."""

from .jsonl_reader import read_jsonl
from .csv_reader import read_csv
from .avro_reader import read_avro
from .parquet_reader import read_parquet, read_parquet_column
from .sql_reader import read_sql

READERS = {
    "jsonl": read_jsonl,
    "csv": read_csv,
    "avro": read_avro,
    "parquet": read_parquet,
    "sql": read_sql,
}

__all__ = [
    "read_jsonl",
    "read_csv",
    "read_avro",
    "read_parquet",
    "read_parquet_column",
    "read_sql",
    "READERS",
]
