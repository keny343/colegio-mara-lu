# Colégio Mara & Lu

## Laboratório de geração e benchmark de dados

Este projecto inclui um laboratório independente para gerar grandes volumes de dados sintéticos em lotes, persistir o mesmo conjunto em diferentes formatos e comparar desempenho, validação e consumo de disco.

## Objetivo

O módulo permite:
- gerar um conjunto determinístico com seed fixa
- processar em lotes para não carregar tudo em memória
- escrever para JSON Lines, CSV, Avro, Parquet e SQLite
- validar equivalência de contagens, somas e hashes
- mediar tempo de escrita, leitura, agregação e tamanho em disco
- exportar um resumo em JSON e um relatório Markdown

## Estrutura

- `backend/scripts/run-data-lab.js` — comando principal de execução
- `backend/src/data-lab/generator.js` — geração de dados determinística
- `backend/src/data-lab/writers.js` — serialização e leitura dos formatos

## Requisitos

- Node.js 20+
- SQLite 3 (via `better-sqlite3`)
- as libs do backend já são instaladas via `npm install`

## Execução

```bash
cd backend
npm install
npm run data:lab -- --count 100000 --batch 10000 --seed 42 --destinations jsonl,csv,avro,parquet,sql --repetitions 1
```

Também pode usar o comando curto:

```bash
npm run data:lab:sample
```

## Saída

Os resultados são guardados em:

```text
backend/data-lab-output/
  run-1/
    lab-summary.json
    lab-report.md
    jsonl.jsonl
    csv.csv
    avro.avro
    parquet.parquet
    dataset.sqlite
```

## Esquema de dados

O conjunto usa um modelo de transações sintéticas com estes campos:

- id
- cliente_id
- produto_id
- data_transacao
- categoria
- quantidade
- preco_unitario
- valor_total
- estado
- descricao
- localizacao
- metadados

## Regras determinísticas

- a mesma seed produz sempre a mesma sequência de registos
- a geração segue lotes com `batchSize`
- os valores numéricos usam aritmética decimal controlada em duas casas decimais
- as chaves e os hashes são comparados para validar equivalência entre destinos

## Validação

A validação principal compara:
- contagem total de registos
- somatório de `valor_total`
- hashes determinísticos dos primeiros registos

## Observações

- O laboratório foi desenhado para ser independente da aplicação escolar principal.
- Não altera o fluxo normal do sistema Colégio Mara & Lu.
- Os resultados podem ser usados para relatório técnico, benchmark e comparação de formatos.

