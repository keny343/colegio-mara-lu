# Relatório técnico — Laboratório de Engenharia de Dados

**Projecto:** Colégio Mara & Lu  
**Âmbito:** Geração sintética e armazenamento multi-formato (JSONL · CSV · Avro · Parquet · SQL)  
**Versão do lab:** pasta `data-engineering/` + painel admin `/admin/lab-dados`

---

## 1. Introdução

O objectivo é gerar o **mesmo conjunto lógico** de transações comerciais sintéticas, persistí-lo em cinco destinos, validar equivalência e medir tamanho, escrita, leitura e agregações. As conclusões devem basear-se em execuções reproduzíveis (seed + parâmetros fixos).

## 2. Requisitos e arquitectura

| Camada | Papel |
|--------|--------|
| CLI Python (`python main.py`) | Escalas académicas S/M (1M / 10M), streaming, Avro/Parquet via `fastavro`/`pyarrow`, SQL SQLite |
| Painel admin (Node + MySQL) | Tarefas manuais até 25 000 registos em produção (Render), SQL em `lab_transacoes` |
| Validação | Contagens, somas de `valor_total`, hashes amostrados |
| Benchmark + charts | JSON de métricas + HTML SVG (`benchmark/charts.py`) / gráficos Recharts no admin |

## 3. Modelo e geração

Schema `Transacao` (≥12 campos): id, cliente_id, produto_id, data_transacao, categoria, quantidade, preco_unitario, valor_total, estado, descricao, localizacao (nested), metadados (opcional).

- Seed fixa; lotes configuráveis; Decimal/`toFixed(2)` para dinheiro.
- CLI: `random.Random(seed)`. Admin Node: Mulberry32 (reproduzível no painel; não bit-a-bit idêntico ao Python).

## 4. Implementação

Ver `README.md` do lab. Destinos: JSON Lines, CSV UTF-8 (delimitador `,`), Avro (schema `schemas/transacao.avsc`), Parquet colunar, SQL (SQLite no CLI / MySQL no admin).

## 5. Validação

```powershell
python main.py validate --out output/smoke --destinations jsonl,csv,avro,parquet,sql
```

Critérios: contagens iguais, `sum(valor_total)` alinhada, amostra de hashes de chaves.

## 6. Experiências e benchmark

Ambiente a documentar em cada corrida: OS, CPU, RAM, disco, versões Python/Node/MySQL.

Smoke (referência no repositório): `output/smoke/benchmark_report.json` + HTML via:

```powershell
python main.py charts --report output/smoke/benchmark_report.json
```

Escala S/M: comandos no README (`--records 1000000` / `10000000`).

## 7. Análise (orientação)

- **CSV/JSONL:** interoperáveis; maior tamanho; leitura full-scan.
- **Avro:** schema embutido; bom para ingestão linha-a-linha.
- **Parquet:** melhor para leitura selectiva de colunas e analytics.
- **SQL:** índices, agregações (`GROUP BY`), integridade; overhead de SGBD.

Confirmar sempre com as medianas das corridas no ambiente do grupo.

## 8. Limitações

- Cache fria vs quente; Render free (cold start); painel limitado a 25k.
- Escrita Avro/Parquet no admin é implementação didáctica (sem compressão avançada).
- Ameaças à validade: hardware, carga concurrente, page cache do SO.

## 9. Conclusão

Usar o **CLI Python** para o relatório académico (S/M). Usar o **painel admin** para demonstração operacional e tarefas manuais em produção. Trabalho futuro: compressão Snappy/ZSTD, PostgreSQL, leitura colunar nativa no Node.

### Anexos

- Schema: `schemas/transacao.avsc`
- Logs/meta: `output/<run>/run_meta.json`, `benchmark_report.json`
- Painel: `/admin/lab-dados` (role `admin`)
