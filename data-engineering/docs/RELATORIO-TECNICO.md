# Relatório técnico — Laboratório de Engenharia de Dados

## Objectivo

Comparar formatos de armazenamento (JSONL, CSV, Avro, Parquet, SQL) com um
dataset sintético alinhado ao domínio do **Colégio Mara & Lu**: linhas
**aluno × disciplina** com notas do sistema angolano (1PP–3PT), média anual e situação.

O objectivo é gerar o **mesmo conjunto lógico** de registos académicos, persistí-lo
em cinco destinos, validar equivalência e medir tamanho, escrita, leitura e agregações.
As conclusões devem basear-se em execuções reproduzíveis (seed + parâmetros fixos).

## Ambientes

| Ambiente | Uso |
|----------|-----|
| CLI Python (`data-engineering/`) | Escalas S/M (1M / 10M), validação completa, gráficos HTML |
| Painel admin (Node + MySQL) | Tarefas manuais até 25 000 registos em produção (Render), SQL em `lab_notas_aluno` |
| Validação | Contagens, somas de `media_anual`, hashes amostrados |

## Schema

Schema `NotaAluno` (≥19 campos): id, aluno_id, matricula_id, aluno_nome, turma_id,
turma_nome, serie_classe, curso, ano_letivo, turno, disciplina_id, disciplina,
periodos (nested 1PP–3PT), media_anual, situacao, nota_minima, data_atualizacao,
turma_info (nested), metadados (opcional).

Regras: nota mínima 5 (1ª–6ª) ou 10 (restantes); escala 0–10 / 0–20; situação
derivada da média e da completude dos períodos.

- Seed fixa; lotes configuráveis; Decimal/`toFixed(1)` para notas.
- CLI: `random.Random(seed)`. Admin Node: Mulberry32 (reproduzível no painel; não bit-a-bit idêntico ao Python).

## Destinos

Ver `README.md` do lab. Destinos: JSON Lines, CSV UTF-8 (delimitador `,`), Avro
(schema `schemas/nota_aluno.avsc`), Parquet colunar, SQL (SQLite no CLI / MySQL no admin).

## Validação

Critérios: contagens iguais, `sum(media_anual)` alinhada, amostra de hashes de chaves.
Qualidade: não-nulos essenciais, intervalos de nota, consistência média/situação.

## Benchmark

Métricas típicas: bytes em disco, taxa de escrita/leitura, `GROUP BY disciplina`,
compressão vs CSV, pico de memória. Relatórios JSON + HTML (`benchmark/charts.py`).

## Artefactos

- Schema: `schemas/nota_aluno.avsc`
- Gerador: `generator/synthetic.py` (Python) e `backend/src/lab/generator.js` (admin)
- Painel: Admin → Lab de dados
