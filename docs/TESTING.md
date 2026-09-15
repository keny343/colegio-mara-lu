# Testing — Colégio Mara & Lu

## Strategy

| Layer | Tool | Location | Status |
|-------|------|----------|--------|
| Unit / component | Jest + React Testing Library | `frontend/src/**/*.test.js` | Active |
| End-to-end | Playwright | `frontend/e2e/` | Active |
| Backend automated | — | — | Not yet (roadmap) |

## Frontend unit tests

```bash
cd frontend
npm test
```

Uses `react-scripts test --watchAll=false`.

Notable coverage areas:

- Role helpers (`utils/roles.test.js`)
- API / error helpers
- Auth & notification contexts
- `useFetch`
- Selected UI (e.g. MobileDrawer, Mensagens chat area)
- Flow-oriented unit suite (`e2e-fluxos.test.js`)

Setup: `frontend/src/setupTests.js`

## Playwright E2E

```bash
cd frontend
npm run test:e2e
```

Config: `frontend/e2e/playwright.config.js`  
Specs include auth and **session isolation** checks.

Requirements:

- Backend + frontend reachable as configured for E2E
- Never enable `E2E_TEST=true` in production (`server.js` hard-fails)

## CI

GitHub Actions workflow: `.github/workflows/ci.yml`

- Install frontend deps
- Run unit tests
- Production build

E2E is optional/manual until secrets and a stable test environment are wired.

## Backend testing roadmap

Priority candidates:

1. Auth middleware (inactive user, token_version)
2. Enrollment status transitions
3. Grade write permissions (professor vs coordenador)
4. Rate-limit behaviour (integration)

## Quality bar for PRs

- Unit tests green
- `npm run build` green in `frontend/`
- No secrets in diff
- Manual smoke: login per role + one enrollment status change

Related: [SECURITY.md](./SECURITY.md), [DEPLOYMENT.md](./DEPLOYMENT.md).
