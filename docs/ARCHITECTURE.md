# Architecture — Colégio Mara & Lu

## Overview

Full-stack school management platform for enrollment, academic operations, and family communication.

```text
┌─────────────────────────────────────────┐
│  Frontend (React 18 + React Router)     │
│  Vercel                                 │
│  Roles: admin · coordenador · professor │
│         aluno / encarregado             │
└──────────────────┬──────────────────────┘
                   │ HTTPS / REST (/api)
                   ▼
┌─────────────────────────────────────────┐
│  Backend (Node.js + Express)            │
│  Render                                 │
│  Auth · RBAC · Controllers · Uploads    │
└──────────────────┬──────────────────────┘
                   │
        ┌──────────┴──────────┐
        ▼                     ▼
┌───────────────┐    ┌────────────────────┐
│ MySQL         │    │ Object storage     │
│ Academic data │    │ (Supabase uploads) │
└───────────────┘    └────────────────────┘
```

## Repository layout

| Path | Responsibility |
|------|----------------|
| `frontend/` | CRA React SPA, Design System V2, role-based routes |
| `backend/` | Express API, middleware, business rules |
| `backend/database.sql` | Canonical schema + seed baseline |
| `docs/` | Architecture, security, API, testing, deploy |
| `INSTALACAO.md` | Local setup checklist |

## Backend layers

```text
HTTP request
  → Helmet / CORS / rate limit / request ID
  → Routes (`/api/...`)
  → Auth + RBAC middleware
  → Controllers
  → MySQL (mysql2) / storage adapters
  → JSON response
```

**Entry point:** `backend/src/server.js`  
**Router:** `backend/src/routes/index.js`  
**Auth:** `backend/src/middleware/auth.js`  
**Academic rules:** `backend/src/utils/academicoRules.js`

## Frontend layers

```text
App.js (route guards)
  → AuthContext (session)
  → Layouts (Admin / Professor / Portal navbar)
  → Pages + UI kit (`components/ui`)
  → api.js (Axios, credentials)
```

Public surface: landing, login, public enrollment.  
Authenticated surfaces are isolated by role after login.

## Domain modules

| Module | Description |
|--------|-------------|
| Auth & users | Login, profile, credentials, user admin |
| Enrollments | Public application → staff review → approval |
| Academic | Courses, subjects, classes, schedules |
| Grades | Period-based marks (1PP/1PT …), grade sheets |
| Attendance | Absences + justifications |
| Materials | Teaching materials / curriculum plans |
| Messaging | Internal messages + notifications |
| Documents | Enrollment document upload & review |

## Design decisions

| Decision | Choice | Why |
|----------|--------|-----|
| SPA + separate API | React + Express | Clear deploy split (Vercel / Render) |
| Cookie JWT | httpOnly cookie (+ Bearer fallback) | Reduce XSS token theft vs localStorage |
| RBAC in middleware + DB | Roles refreshed per request | Scope changes apply without re-login wait only |
| Runtime schema helpers | `ensure*.js` on boot | Safer cloud deploys without migration runner |
| Role-specific UIs | Admin / Professor / Portal shells | Dense product UI for staff; clearer student UX |

See also: [SECURITY.md](./SECURITY.md), [DATABASE.md](./DATABASE.md), [DEPLOYMENT.md](./DEPLOYMENT.md).
