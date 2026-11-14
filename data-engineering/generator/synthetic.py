"""Gerador determinístico de transações comerciais sintéticas.

Usa seed fixa (random.Random) e Decimal para valores monetários.
Emite registros em lotes via iterator — nunca carrega o dataset inteiro
em memória.
"""

from __future__ import annotations

import random
from datetime import datetime, timedelta
from decimal import Decimal, ROUND_HALF_UP
from typing import Any, Dict, Iterator, List, Optional

SCHEMA_FIELDS = [
    "id",
    "cliente_id",
    "produto_id",
    "data_transacao",
    "categoria",
    "quantidade",
    "preco_unitario",
    "valor_total",
    "estado",
    "descricao",
    "localizacao",
    "metadados",
]

CATEGORIAS = (
    "Eletronicos",
    "Vestuario",
    "Alimentos",
    "Casa",
    "Esportes",
    "Livros",
    "Beleza",
    "Brinquedos",
    "Automotivo",
    "Saude",
)

ESTADOS = (
    "SP", "RJ", "MG", "RS", "PR", "BA", "SC", "GO", "PE", "CE",
    "DF", "ES", "PA", "MT", "MS", "AM", "MA", "PB", "RN", "AL",
)

CIDADES = {
    "SP": ("São Paulo", -23.5505, -46.6333),
    "RJ": ("Rio de Janeiro", -22.9068, -43.1729),
    "MG": ("Belo Horizonte", -19.9167, -43.9345),
    "RS": ("Porto Alegre", -30.0346, -51.2177),
    "PR": ("Curitiba", -25.4284, -49.2733),
    "BA": ("Salvador", -12.9714, -38.5014),
    "SC": ("Florianópolis", -27.5954, -48.5480),
    "GO": ("Goiânia", -16.6869, -49.2648),
    "PE": ("Recife", -8.0476, -34.8770),
    "CE": ("Fortaleza", -3.7172, -38.5433),
    "DF": ("Brasília", -15.8267, -47.9218),
    "ES": ("Vitória", -20.3155, -40.3128),
    "PA": ("Belém", -1.4558, -48.4902),
    "MT": ("Cuiabá", -15.6010, -56.0974),
    "MS": ("Campo Grande", -20.4697, -54.6201),
    "AM": ("Manaus", -3.1190, -60.0217),
    "MA": ("São Luís", -2.5307, -44.3068),
    "PB": ("João Pessoa", -7.1195, -34.8450),
    "RN": ("Natal", -5.7945, -35.2110),
    "AL": ("Maceió", -9.6658, -35.7350),
}

CANAIS = ("online", "loja", "marketplace", "telefone")

_BASE_DATE = datetime(2023, 1, 1, 0, 0, 0)
_MONEY_QUANT = Decimal("0.01")


def _money(value: Decimal) -> str:
    return str(value.quantize(_MONEY_QUANT, rounding=ROUND_HALF_UP))


def _make_record(rng: random.Random, tx_id: int) -> Dict[str, Any]:
    categoria = rng.choice(CATEGORIAS)
    estado = rng.choice(ESTADOS)
    cidade, lat0, lon0 = CIDADES[estado]
    # Pequeno jitter determinístico na coordenada
    lat = lat0 + rng.uniform(-0.05, 0.05)
    lon = lon0 + rng.uniform(-0.05, 0.05)

    quantidade = rng.randint(1, 20)
    preco = Decimal(str(round(rng.uniform(5.0, 999.99), 2)))
    valor_total = preco * quantidade

    seconds = rng.randint(0, 86400 * 700)  # ~2 anos
    data = _BASE_DATE + timedelta(seconds=seconds)

    metadados: Optional[Dict[str, Any]] = None
    if rng.random() < 0.7:
        metadados = {
            "canal": rng.choice(CANAIS),
            "promocao": rng.random() < 0.25,
            "vendedor_id": rng.randint(1, 500) if rng.random() < 0.6 else None,
        }

    return {
        "id": tx_id,
        "cliente_id": rng.randint(1, 50_000),
        "produto_id": rng.randint(1, 5_000),
        "data_transacao": data.strftime("%Y-%m-%dT%H:%M:%S"),
        "categoria": categoria,
        "quantidade": quantidade,
        "preco_unitario": _money(preco),
        "valor_total": _money(valor_total),
        "estado": estado,
        "descricao": f"{categoria} item #{rng.randint(1, 9999)}",
        "localizacao": {
            "cidade": cidade,
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
    """Gera *n* registros um a um (streaming)."""
    rng = random.Random(seed)
    for i in range(n):
        yield _make_record(rng, start_id + i)


def generate_batches(
    n: int,
    seed: int = 42,
    batch_size: int = 5_000,
    start_id: int = 1,
) -> Iterator[List[Dict[str, Any]]]:
    """Gera *n* registros em lotes de até *batch_size*.

    Nunca materializa o dataset completo — apenas o lote corrente.
    """
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
