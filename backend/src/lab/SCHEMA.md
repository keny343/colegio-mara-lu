# Schema dos dados escolares do laboratório

Cada registo de topo representa um aluno sintético. O catálogo de turmas e disciplinas é lido da base de dados do sistema; os restantes dados do aluno e as notas são gerados sinteticamente.

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | inteiro | Identificador sequencial dentro da execução. |
| `nome` | texto | Nome sintético do aluno. |
| `email` | texto | Email sintético com tag da seed e identificador do registo. |
| `role` | texto | Valor fixo `aluno`. |
| `ativo` | inteiro | Valor fixo `0`, para não ativar o utilizador gerado. |
| `data_nascimento` | data ISO (`YYYY-MM-DD`) | Data sintética derivada da série e do ano letivo. |
| `sexo` | texto | `M` ou `F`, escolhido pelo gerador. |
| `nacionalidade` | texto | Valor fixo `Angolana`. |
| `nome_mae` | texto | Nome sintético. |
| `nome_pai` | texto | Nome sintético. |
| `responsavel` | texto | Nome sintético escolhido entre mãe e pai. |
| `telefone_emergencia` | texto | Número sintético com indicativo `+244`. |
| `turma_id` | inteiro | Identificador de turma do catálogo ativo. |
| `turma_nome` | texto | Nome da turma do catálogo. |
| `curso_id` | inteiro ou nulo | Identificador do curso do catálogo, quando existe. |
| `curso_nome` | texto | Nome do curso; texto vazio quando não há curso associado. É a chave usada pela agregação adaptada. |
| `serie_classe` | inteiro | Série/classe da turma. |
| `ano_letivo` | inteiro | Ano letivo da turma. |
| `turno` | texto | Turno da turma; usa `manha` se não estiver definido. |
| `notas` | lista de objetos | Notas sintéticas por disciplina e período. |

Cada objeto de `notas` contém:

| Campo | Tipo | Descrição |
|---|---|---|
| `disciplina_id` | inteiro | Identificador de disciplina do catálogo. |
| `disciplina` | texto | Nome da disciplina do catálogo. |
| `periodo` | texto | Um dos períodos `1PP`, `1PT`, `2PP`, `2PT`, `3PP`, `3PT`, podendo incluir `EXN` ou `DEF` conforme a configuração da turma. |
| `nota` | decimal | Nota sintética: escala máxima 10 para as classes 1–6 e 20 para as restantes; arredondada a duas casas. |
| `professor_id` | inteiro ou nulo | Professor associado à disciplina na turma, quando disponível. |

## Regras de geração

- A seed torna os dados sintéticos repetíveis; o catálogo real de turmas/disciplinas pode alterar os resultados se mudar entre execuções.
- Cada aluno recebe uma turma ativa aleatória do catálogo disponível.
- Para cada disciplina compatível, são geradas notas para os seis períodos regulares e, quando configurado, para exame nacional (`EXN`) ou defesa final (`DEF`).
- Os nomes, contactos, datas de nascimento e notas não são copiados de alunos reais.
- `SCHEMA_FIELDS` em `generator.js` é a definição de referência dos campos de topo.
