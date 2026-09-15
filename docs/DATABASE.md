# Database — Colégio Mara & Lu

## Engine

**MySQL** via `mysql2` connection pool (`backend/src/config/db.js` or equivalent under `backend/src`).

## Schema sources

| Artifact | Role |
|----------|------|
| `backend/database.sql` | Canonical create script + baseline |
| `backend/setup_aiven.sql` | Cloud/Aiven-oriented reset helper |
| `backend/alter_table_usuarios.sql` | One-off column patch |
| `backend/src/utils/ensureSchema.js` | Boot-time idempotent columns (`token_version`, etc.) |
| `ensureIndexes.js`, `ensureNotasSchema.js`, … | Runtime safety for academic features |
| `backend/scripts/migrate-*.js` | Manual data migrations (grades model, etc.) |

There is **no** Knex/Prisma migration runner. Schema evolution mixes SQL scripts + boot helpers — document intentional changes in PRs.

## Core entities

```text
usuarios
  ├── alunos
  │     └── inscricoes → series
  │           └── documentos
  ├── notificacoes / mensagens
  └── (staff roles)

cursos → disciplinas
turmas → matriculas → alunos
      → horarios
      → turma_professores
notas / faltas / justificacoes
materiais / planos_curriculares
```

### Users (`usuarios`)

- Roles: `aluno`, `admin`, `professor`, `coordenador`
- `ativo` gates access
- Coordinator scope: `curso_coordenado`, `nivel_coordenado`
- Auth hardening fields (e.g. `token_version`) ensured at boot

### Enrollments (`inscricoes`)

Statuses: `pendente` → `em_analise` → `aprovada` | `rejeitada` | `cancelada`

Approval typically links the student into a **turma** via matrícula flows.

### Academic

- **Séries / classes** with vacancy counters (`vagas_total`, `vagas_disponiveis`)
- **Turmas**, **disciplinas**, **horários**
- **Notas** by period codes used in Angola secondary model (e.g. 1PP / 1PT …)
- **Faltas** + justifications with attachments

## Integrity & concurrency

Some update endpoints accept `updated_at` for optimistic checks and return **409** on conflict — important for concurrent staff edits (enrollments, vacancies).

## Seeding / local setup

1. Create empty database
2. Run `backend/database.sql`
3. Copy `backend/.env.example` → `.env` and fill credentials
4. Start API (`npm run dev`) — boot helpers may apply additive columns

## Backups

Production MySQL (e.g. Aiven or host-managed) should have automated backups enabled outside this repo. Document restore runbooks in the hosting provider.

Related: [ARCHITECTURE.md](./ARCHITECTURE.md), UML drafts in `docs/diagrama_er.puml`.
