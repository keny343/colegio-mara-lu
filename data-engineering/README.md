# Laboratório de Engenharia de Dados — Colégio Mara & Lu

Laboratório acadêmico para gerar, gravar, validar e comparar formatos de dados
comerciais sintéticos em **streaming** (nunca carrega o dataset inteiro em memória).

Formatos: **JSON Lines**, **CSV (UTF-8)**, **Avro**, **Parquet** e **SQL (SQLite)**.

---

## 1. Instalação

```powershell
cd c:\Users\HP\Desktop\colegio-mara-lu\data-engineering

# Use o .venv já existente ou crie um novo
.\.venv\Scripts\Activate.ps1
# Se ainda não existir:
# python -m venv .venv
# .\.venv\Scripts\Activate.ps1

python -m pip install --upgrade pip
pip install -r requirements.txt
```

Dependências principais: `fastavro`, `pyarrow`, `psutil`, `click` (opcional), `pytest`.
**Pandas não é necessário** — o lab prioriza iterators/lotes.

---

## 2. Schema lógico (`Transacao`)

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | long | Identificador único |
| `cliente_id` | long | Cliente |
| `produto_id` | long | Produto |
| `data_transacao` | string ISO 8601 | Data/hora |
| `categoria` | string | Categoria do item |
| `quantidade` | int | Quantidade ≥ 1 |
| `preco_unitario` | Decimal (string) | Preço unitário |
| `valor_total` | Decimal (string) | `quantidade * preco_unitario` |
| `estado` | string (UF) | Estado brasileiro |
| `descricao` | string | Descrição textual |
| `localizacao` | nested | `{cidade, latitude, longitude}` |
| `metadados` | nested opcional | `{canal, promocao, vendedor_id}` |

Schema Avro explícito: [`schemas/transacao.avsc`](schemas/transacao.avsc).

### CSV

- Encoding: **UTF-8**
- Cabeçalho: sim
- Delimitador: **vírgula (`,`)** — constante `CSV_DELIMITER` em `writers/csv_writer.py`
- Campos aninhados (`localizacao`, `metadados`) serializados como JSON na célula

### SQL

- **Padrão:** arquivo SQLite (`transacoes.db`) — portátil, sem servidor
- **MySQL (referência):** DDL em `writers/sql_writer.py` (`DDL_MYSQL`). Exemplo de URL:
  `mysql+pymysql://user:pass@host:3306/lab_transacoes`

---

## 3. Comandos CLI

Do diretório `data-engineering`:

```powershell
python main.py --help
# ou
python -m lab --help
```

### Gerar / gravar

```powershell
python main.py generate --records 10000 --seed 42 --batch-size 5000 `
  --destinations jsonl,csv,avro,parquet,sql --out output/run1
```

Alias: `python main.py run ...`

O **mesmo dataset lógico** (seed fixa) alimenta todos os destinos selecionados,
cada um via iterator em lotes.

### Validar equivalência e qualidade

```powershell
python main.py validate --out output/run1 `
  --destinations jsonl,csv,avro,parquet,sql --sample-size 100
```

Verifica: contagens, `sum(valor_total)`, hashes amostrados de chaves, regras de qualidade.

### Benchmark

```powershell
python main.py benchmark --records 10000 --seed 42 --batch-size 5000 `
  --destinations jsonl,csv,avro,parquet,sql --out output/bench1 --repeats 3
```

Métricas: tamanho em disco, tempo/taxa de escrita, leitura completa, leitura de
coluna única (Parquet), `GROUP BY categoria` (COUNT + SUM), compressão vs CSV,
pico de RSS (`psutil`). Com `--repeats N` reporta **median / min / max**.
A 1ª repetição é anotada como **cold-cache relativa** (ver nota no relatório JSON).

### Pipeline completo

```powershell
python main.py full --records 10000 --seed 42 --batch-size 5000 `
  --destinations jsonl,csv,avro,parquet,sql --out output/run1
```

---

## 4. Painel admin (produção)

Em produção o **admin** executa tarefas manuais em **Admin → Lab de dados** (`/admin/lab-dados`):

- Gerar e gravar (JSONL, CSV, Avro, Parquet, SQL MySQL `lab_transacoes`)
- Validar equivalência
- Benchmark com gráficos comparativos
- Descarregar artefactos da última corrida

Limite do painel: **25 000** registos (Render). Escalas S/M continuam neste CLI.

API (JWT admin): `GET/POST /api/admin/lab/*` (status, generate, validate, benchmark, download).

## 5. Reprodução acadêmica (CLI)

| Perfil | Registros | Exemplo |
|--------|-----------|---------|
| Smoke | 1 000 | `--records 1000` |
| **S** (padrão lab) | **1 000 000** | `--records 1000000` |
| **M** | **10 000 000** | `--records 10000000` |

### Escala S — 1 milhão

```powershell
python main.py full --records 1000000 --seed 42 --batch-size 20000 `
  --destinations jsonl,csv,avro,parquet,sql --out output/S_1M --repeats 1
```

### Escala M — 10 milhões

```powershell
python main.py full --records 10000000 --seed 42 --batch-size 50000 `
  --destinations jsonl,csv,avro,parquet,sql --out output/M_10M --repeats 1
```

**Dicas**

- Disco: escala M pode ocupar vários GB (CSV/JSONL especialmente).
- Use `--batch-size` maior em máquinas com mais RAM (só o lote fica em memória).
- Relatórios em `output/<run>/benchmark_report.json` e `reports/`.
- Logs de execução podem ser redirecionados: `... *> logs\run_S.log`

### Smoke test rápido (1 000 registros)

```powershell
python main.py full --records 1000 --seed 42 --batch-size 500 `
  --destinations jsonl,csv,avro,parquet,sql --out output/smoke
```

### Gráficos (RF10)

```powershell
python main.py charts --report output/smoke/benchmark_report.json
# → output/smoke/benchmark_charts.html
```

### Testes unitários

```powershell
pytest tests/ -q
```

Relatório técnico (esqueleto): [`docs/RELATORIO-TECNICO.md`](docs/RELATORIO-TECNICO.md).

---

## 6. Layout do pacote

```
data-engineering/
  main.py                 # python main.py ...
  lab/                    # python -m lab
  generator/synthetic.py  # PRNG com seed + Decimal + batches
  writers/                # jsonl, csv, avro, parquet, sql
  readers/                # leitores streaming
  validation/             # equivalência + qualidade
  benchmark/              # runner de métricas
  schemas/transacao.avsc
  tests/
  output/  logs/  reports/
```

---

## 7. Determinismo

- Gerador usa `random.Random(seed)` (não o RNG global).
- Mesmo `--seed` + mesmo `--records` ⇒ mesmos registros em qualquer destino/máquina.
- Valores monetários com `decimal.Decimal` e quantização `0.01`.

---

## 8. Licença / uso

Material didático do projeto **Colégio Mara & Lu**. Uso acadêmico e de laboratório.
