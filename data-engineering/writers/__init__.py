"""Writers para múltiplos formatos a partir do mesmo gerador lógico."""

from .jsonl import write_jsonl
from .csv_writer import write_csv, CSV_DELIMITER, CSV_DELIMITER_NAME
from .avro_writer import write_avro
from .parquet_writer import write_parquet
from .sql_writer import write_sql

WRITERS = {
    "jsonl": write_jsonl,
    "csv": write_csv,
    "avro": write_avro,
    "parquet": write_parquet,
    "sql": write_sql,
}

__all__ = [
    "write_jsonl",
    "write_csv",
    "write_avro",
    "write_parquet",
    "write_sql",
    "WRITERS",
    "CSV_DELIMITER",
    "CSV_DELIMITER_NAME",
]
