"""Reader JSON Lines — streaming linha a linha."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, Iterator, Union


def read_jsonl(path: Union[str, Path]) -> Iterator[Dict[str, Any]]:
    path = Path(path)
    with path.open("r", encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if line:
                yield json.loads(line)
