"""Gerador determinístico de linhas aluno×disciplina (espelha o relatório de notas).

Schema alinhado ao Colégio Mara & Lu / sistema angolano:
3 trimestres × (parcial + trimestral) = 1PP, 1PT, 2PP, 2PT, 3PP, 3PT.
Média anual e situação seguem as mesmas regras da aba Notas.
"""

from __future__ import annotations

import random
from datetime import datetime, timedelta
from decimal import Decimal, ROUND_HALF_UP
from typing import Any, Dict, Iterator, List, Optional

PERIODOS = ("1PP", "1PT", "2PP", "2PT", "3PP", "3PT")

SCHEMA_FIELDS = [
    "id",
    "aluno_id",
    "matricula_id",
    "aluno_nome",
    "turma_id",
    "turma_nome",
    "serie_classe",
    "curso",
    "ano_letivo",
    "turno",
    "disciplina_id",
    "disciplina",
    "periodos",
    "media_anual",
    "situacao",
    "nota_minima",
    "data_atualizacao",
    "turma_info",
    "metadados",
]

DISCIPLINAS = (
    "Língua Portuguesa",
    "Matemática",
    "História",
    "Geografia",
    "Ciências",
    "Educação Física",
    "Educação Moral e Cívica",
    "Inglês",
    "Física",
    "Química",
    "Biologia",
    "Informática",
)

TURNOS = ("manhã", "tarde", "noite")

CURSOS_SEC = (
    None,
    "Ciências Físicas e Biológicas",
    "Ciências Económicas e Jurídicas",
    "Humanidades",
)

PROVINCIAS = (
    ("Luanda", "Luanda", -8.8383, 13.2344),
    ("Benguela", "Benguela", -12.5763, 13.4055),
    ("Huambo", "Huambo", -12.7761, 15.7393),
    ("Huíla", "Lubango", -14.9172, 13.4925),
    ("Cabinda", "Cabinda", -5.5500, 12.2000),
)

NOMES = (
    "Ana", "Bruno", "Carla", "Daniel", "Elena", "Fábio", "Gisela", "Hugo",
    "Inês", "João", "Katia", "Luis", "Maria", "Nuno", "Olga", "Paulo",
    "Quintino", "Rita", "Sara", "Tiago", "Úrsula", "Vítor", "Wanda", "Xavier",
)
SOBRENOMES = (
    "Silva", "Santos", "Costa", "Pereira", "Oliveira", "Fernandes", "Rodrigues",
    "Martins", "Almeida", "Nascimento", "Dos Santos", "Manuel", "João",
)

_BASE_DATE = datetime(2025, 2, 1, 8, 0, 0)
_NOTE_QUANT = Decimal("0.1")


def nota_minima_para(serie: int) -> int:
    return 5 if 1 <= serie <= 6 else 10


def limite_max_para(serie: int) -> int:
    return 10 if serie <= 6 else 20


def _q(n: Decimal) -> str:
    return str(n.quantize(_NOTE_QUANT, rounding=ROUND_HALF_UP))


def _media_trimestre(a: Optional[str], b: Optional[str]) -> Optional[Decimal]:
    vals = [Decimal(x) for x in (a, b) if x is not None]
    if not vals:
        return None
    return sum(vals) / Decimal(len(vals))


def media_periodos(periodos: Dict[str, Optional[str]]) -> Optional[str]:
    t1 = _media_trimestre(periodos.get("1PP"), periodos.get("1PT"))
    t2 = _media_trimestre(periodos.get("2PP"), periodos.get("2PT"))
    t3 = _media_trimestre(periodos.get("3PP"), periodos.get("3PT"))
    trimestres = [t for t in (t1, t2, t3) if t is not None]
    if not trimestres:
        return None
    return _q(sum(trimestres) / Decimal(len(trimestres)))


def periodos_completos(periodos: Dict[str, Optional[str]]) -> bool:
    return all(periodos.get(k) is not None for k in PERIODOS)


def situacao_de(periodos: Dict[str, Optional[str]], media: Optional[str], minimo: int) -> str:
    if media is None:
        return "Sem notas"
    if not periodos_completos(periodos):
        return "Em curso"
    return "Positiva" if Decimal(media) >= Decimal(minimo) else "Negativa"


def _make_record(rng: random.Random, row_id: int) -> Dict[str, Any]:
    serie = rng.randint(1, 12)
    max_nota = limite_max_para(serie)
    minimo = nota_minima_para(serie)
    curso = rng.choice(CURSOS_SEC) if serie >= 10 else None
    turno = rng.choice(TURNOS)
    turma_id = 1 + (serie - 1) * 3 + rng.randint(0, 2)
    turma_nome = f"{serie}ª {turno[0].upper()}{turno[1:]}"
    if curso:
        turma_nome = f"{serie}ª {curso.split()[0]} {turno}"

    aluno_id = rng.randint(1, 80_000)
    matricula_id = aluno_id * 10 + rng.randint(0, 9)
    nome = f"{rng.choice(NOMES)} {rng.choice(SOBRENOMES)}"
    disc_idx = rng.randint(0, len(DISCIPLINAS) - 1)
    disciplina = DISCIPLINAS[disc_idx]
    disciplina_id = disc_idx + 1

    # Probabilidade de períodos em falta (em curso / sem notas)
    fill_prob = rng.uniform(0.55, 1.0)
    periodos: Dict[str, Optional[str]] = {}
    for key in PERIODOS:
        if rng.random() < fill_prob:
            # distribuição enviesada para notas medianas
            raw = Decimal(str(round(rng.gauss(max_nota * 0.62, max_nota * 0.18), 1)))
            if raw < 0:
                raw = Decimal("0")
            if raw > max_nota:
                raw = Decimal(max_nota)
            periodos[key] = _q(raw)
        else:
            periodos[key] = None

    media = media_periodos(periodos)
    situacao = situacao_de(periodos, media, minimo)

    prov, mun, lat0, lon0 = rng.choice(PROVINCIAS)
    lat = lat0 + rng.uniform(-0.05, 0.05)
    lon = lon0 + rng.uniform(-0.05, 0.05)

    seconds = rng.randint(0, 86400 * 200)
    data = _BASE_DATE + timedelta(seconds=seconds)

    metadados: Optional[Dict[str, Any]] = None
    if rng.random() < 0.75:
        metadados = {
            "professor_id": rng.randint(1, 200),
            "origem": rng.choice(("lancamento", "importacao", "laboratorio")),
            "observacao": None if rng.random() < 0.7 else "recuperação",
        }

    return {
        "id": row_id,
        "aluno_id": aluno_id,
        "matricula_id": matricula_id,
        "aluno_nome": nome,
        "turma_id": turma_id,
        "turma_nome": turma_nome,
        "serie_classe": serie,
        "curso": curso,
        "ano_letivo": 2025,
        "turno": turno,
        "disciplina_id": disciplina_id,
        "disciplina": disciplina,
        "periodos": periodos,
        "media_anual": media,
        "situacao": situacao,
        "nota_minima": minimo,
        "data_atualizacao": data.strftime("%Y-%m-%dT%H:%M:%S"),
        "turma_info": {
            "escola": "Colégio Mara & Lu",
            "provincia": prov,
            "municipio": mun,
            "latitude": round(lat, 6),
            "longitude": round(lon, 6),
        },
        "metadados": metadados,
    }


def generate_records(
    n: int,
    seed: int = 42,
    start_id: int = 1,
) -> Iterator[Dict[str, Any]]:
    rng = random.Random(seed)
    for i in range(n):
        yield _make_record(rng, start_id + i)


def generate_batches(
    n: int,
    seed: int = 42,
    batch_size: int = 5_000,
    start_id: int = 1,
) -> Iterator[List[Dict[str, Any]]]:
    if batch_size < 1:
        raise ValueError("batch_size deve ser >= 1")
    batch: List[Dict[str, Any]] = []
    for record in generate_records(n, seed=seed, start_id=start_id):
        batch.append(record)
        if len(batch) >= batch_size:
            yield batch
            batch = []
    if batch:
        yield batch
