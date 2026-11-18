# Laboratório de dados — Colégio Mara Lu

Este pacote contém o backend do laboratório e o componente React da sua interface. A geração usa o catálogo real de turmas e disciplinas do sistema; os registos representam alunos e notas, não transações.

## Conteúdo

- `backend/src/lab/benchmark.js`, `generator.js`, `pipeline.js`, `readers.js`, `sinks.js`, `binaryFormats.js` e `csvValidation.js`: geração, escrita, leitura, validação e benchmark.
- `frontend/src/pages/AdminLabDados.js` e `AdminLabDados.css`: página do painel, copiada da aplicação React do Colégio.
- `backend/src/lab/SCHEMA.md`: campos, tipos e regras da geração escolar.
- O pipeline produz JSONL, CSV, Avro, Parquet e scripts SQL. Metadados, logs e relatórios são guardados no diretório de saída configurado pelo backend.

## Dependências e instalação

Requisitos: Node.js compatível com a aplicação (recomendado Node.js 18 ou superior), dependências do backend e uma base de dados configurada com turmas ativas e disciplinas compatíveis.

O laboratório é integrado no backend e não é um executável independente. Na cópia completa do sistema, execute a partir da pasta `backend` do sistema:

```powershell
cd backend
npm install
npm start
```

Configure as variáveis de ambiente e a ligação à base de dados conforme `backend/.env.example` e a documentação principal do sistema. Não copie nem partilhe um ficheiro `.env` com credenciais.

Para executar a interface, use a aplicação React existente:

```powershell
cd frontend
npm install
npm start
```

O componente deste pacote depende das bibliotecas e dos componentes partilhados da aplicação (React, Recharts, Lucide, API, notificações e UI). A página está disponível em `/admin/lab-dados` para utilizadores administradores, com sessão autenticada e backend ativo.

## Reprodução

No painel, escolha o volume, a seed, o tamanho do lote, o número de repetições e os formatos. Execute **Gerar e gravar**, **Validar equivalência** ou **Benchmark**. O painel comunica com os endpoints autenticados `/admin/lab/status`, `/generate`, `/validate`, `/benchmark`, `/jobs/:id`, `/jobs/:id/cancel` e `/download-link`, sob `/api/admin/lab`.

Durante uma tarefa, **Cancelar tarefa** envia um pedido ao backend; não se limita a interromper o polling do browser. O backend pára cooperativamente nos pontos seguros de geração, escrita, validação ou benchmark. O estado passa por `cancelling` e termina em `cancelled`. Se uma geração ou benchmark for cancelado, a pasta parcial criada por essa tarefa é removida e não é publicada em `latest.json`.

Na aplicação completa, o controlador está em `backend/src/controllers/labController.js` e a rota protegida é registada em `backend/src/routes/index.js`:

```js
router.post('/admin/lab/jobs/:id/cancel', adminMiddleware, labController.cancel);
```

### Como comprovar o processamento em lotes

O tamanho configurado, isoladamente, não prova quantos lotes foram realmente processados. A comprovação vem dos contadores atualizados depois de cada lote concluído:

- Enquanto a tarefa corre, `GET /api/admin/lab/jobs/:id` devolve `batch_progress` por destino, com `batch_count`, registos processados e a distribuição observada dos tamanhos.
- Depois da conclusão, o painel apresenta os lotes observados por destino; cada destino em `run_meta.json` (e os resultados de escrita) contém `batch_count` e `batch_size_distribution`. O `run.log` regista o tamanho configurado no início e os lotes efetivamente observados no fim.
- Por exemplo, volume 1.000 e lote 500 deve produzir `batch_count: 2` e distribuição `{"500": 2}`. Volume 1.100 e lote 500 deve produzir três lotes: `{"500": 2, "100": 1}`. Se o lote for maior que o volume, observa-se apenas um lote parcial.

Em caso de cancelamento, consulte o estado final do job. Os contadores visíveis durante a execução indicam apenas lotes completos; o cancelamento não transforma uma execução parcial numa execução concluída.

Os artefactos de benchmark incluídos como amostra foram produzidos antes da adição desses contadores e, por isso, não contêm `batch_count` nem `batch_size_distribution`. As novas execuções incluem estes campos; a amostra histórica não foi alterada para evitar apresentar valores inferidos como medições observadas.

O módulo `pipeline.js` é chamado pelo controlador HTTP do backend; não aceita os argumentos `--records` ou `--seed` como comando de linha de comandos. Os limites de volume e de lotes são configurados pelas variáveis `LAB_MAX_RECORDS` e `LAB_MAX_BATCH`.

## Schema e regras de geração

Um registo representa um aluno e inclui identificadores e dados da turma/curso, série, ano letivo, turno e uma lista `notas`. Cada nota contém disciplina, período, valor e professor. A lista de campos está definida em `generator.js` (`SCHEMA_FIELDS`).

A geração usa uma seed determinística. As turmas e disciplinas são carregadas da base de dados real; nomes, contactos, datas e notas são sintéticos. As notas têm uma distribuição sintética com maioria positiva e uma fração negativa. Os dados gerados não são dados reais de alunos.

## Agregação adaptada ao domínio escolar

A agregação é adaptada aos dados que o sistema realmente gera:

- `curso_nome` funciona como a categoria do agrupamento.
- `alunos` conta os registos de alunos por curso (há um registo gerado por aluno).
- `notas` conta as notas incluídas nesses registos.
- `soma_notas` soma `notas[].nota`, com precisão de duas casas decimais.

O benchmark calcula esta agregação em JSONL, CSV, Avro e Parquet; no Parquet, projeta apenas `curso_nome` e `notas`. O script SQL é gerado para carga no MySQL, mas a consulta agregada SQL não é executada pelo benchmark de ficheiros.

Consulta equivalente no MySQL, após carregar os dados gerados:

```sql
SELECT
  COALESCE(c.nome, '(sem curso)') AS categoria,
  COUNT(DISTINCT a.id) AS alunos,
  COUNT(n.nota) AS notas,
  ROUND(COALESCE(SUM(n.nota), 0), 2) AS soma_notas
FROM matriculas m
JOIN alunos a ON a.id = m.aluno_id
JOIN turmas t ON t.id = m.turma_id
LEFT JOIN cursos c ON c.id = t.curso_id
LEFT JOIN notas n ON n.matricula_id = m.id
GROUP BY COALESCE(c.nome, '(sem curso)');
```

Neste contexto, `soma_notas` é uma soma de notas escolares, não um valor monetário.

O destino SQL é gerado como script para execução no MySQL configurado pelo sistema. O benchmark de leitura dos formatos de ficheiro não executa uma consulta SQL no servidor; a carga e consulta SQL dependem do ambiente configurado.
