"""Reader Avro via fastavro."""

from __future__ import annotations

from pathlib import Path
from typing import Any, Dict, Iterator, Union

from fastavro import reader as avro_reader


def read_avro(path: Union[str, Path]) -> Iterator[Dict[str, Any]]:
    path = Path(path)
    with path.open("rb") as fh:
        for record in avro_reader(fh):
            yield dict(record)
