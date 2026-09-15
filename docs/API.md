# API — Colégio Mara & Lu

Base path: **`/api`**  
Health (no auth): **`GET /health`**

Authentication: session cookie `token` (httpOnly) or `Authorization: Bearer <jwt>`.

> This document is a curated map of the live router in `backend/src/routes/index.js`. It is not a full OpenAPI spec (roadmap item).

## Auth

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/auth/login` | Public | Login |
| POST | `/auth/logout` | Auth | Logout / clear cookie |
| GET | `/auth/perfil` | Auth | Current profile |
| PUT | `/auth/perfil` | Auth | Update profile |
| POST | `/auth/perfil/foto` | Auth | Avatar upload |
| PUT | `/auth/credenciais` | Auth | Change credentials |

## Public enrollment

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/public/inscricoes` | Public (rate limited) | Submit enrollment application |

## Series (classes / vacancies)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/series` | Public read | List classes / vacancy info |

Admin series CRUD lives under `/admin/series` (admin only).

## Family / student portal

| Method | Path | Description |
|--------|------|-------------|
| GET/POST | `/alunos` | Linked students |
| PUT/DELETE | `/alunos/:id` | Update / remove |
| GET | `/inscricoes/minhas` | Own applications |
| POST | `/inscricoes` | New application (authenticated flow) |
| PATCH | `/inscricoes/:id/cancelar` | Cancel |
| GET | `/aluno/matricula` | Active enrollment |
| GET | `/aluno/disciplinas` | Subjects |
| GET | `/aluno/horarios` | Timetable |
| GET | `/aluno/notas` | Grades |
| GET | `/aluno/faltas` | Absences |
| POST | `/aluno/faltas/justificar` | Justify absence |

## Documents, notifications, messages

| Method | Path | Description |
|--------|------|-------------|
| POST/GET | `/documentos` | Upload / list documents |
| GET/POST | `/notificacoes` | Notifications |
| PATCH | `/notificacoes/:id/lida` | Mark read |
| GET | `/mensagens/contactos` | Contacts |
| GET | `/mensagens/conversa/:outroId` | Thread |

## Administration

| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| GET | `/admin/dashboard` | Staff | KPIs + vacancy overview |
| GET | `/admin/inscricoes` | Staff | Enrollment queue |
| GET | `/admin/inscricoes/:id` | Staff | Detail |
| PATCH | `/admin/inscricoes/:id/status` | Staff | Status transition (+ turma on approval) |
| PATCH | `/admin/documentos/:id` | Staff | Document review |
| GET/POST | `/admin/usuarios` | Admin | Users |
| PUT | `/admin/usuarios/:id` | Admin | Update user |
| PATCH | `/admin/usuarios/:id/coordenador` | Admin/staff | Assign coordinator scope |
| * | `/admin/series` | Admin | Class / vacancy CRUD + sync |

## Academic (staff)

Under `/staff/...` (cursos, disciplinas, turmas, horários, matrículas, notas, pauta, config-avaliacao, plano curricular, usuários/equipa). Exact verbs follow REST conventions in the router.

## Professor

Under `/professor/...` (painel, disciplinas, alunos, materiais, faltas, notas, pauta, justificações).

## Files

| Method | Path | Description |
|--------|------|-------------|
| GET | `/arquivos/:arquivo(*)` | Authenticated file access |

## Error shape

Controllers typically return JSON with `message` (and optional details). Auth failures: `401`. Forbidden: `403`. Conflict (optimistic concurrency / stale `updated_at`): `409`.

## Rate limits (high level)

Configured in `backend/src/server.js`:

- Global API window
- Stricter login / enrollment / credentials windows
- Tighter message / notification / document windows

## Client

Frontend Axios instance: `frontend/src/services/api.js`  
- Local: CRA proxy → `http://localhost:49152`  
- Production: Vercel rewrites `/api/*` to the Render backend

Related: [SECURITY.md](./SECURITY.md), [TESTING.md](./TESTING.md).
