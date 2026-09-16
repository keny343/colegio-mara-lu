# Testing — Colégio Mara & Lu

## Strategy

| Layer | Tool | Location | Status |
|-------|------|----------|--------|
| Unit / component | Jest + React Testing Library | `frontend/src/**/*.test.js` | Active |
| Backend unit | Jest | `backend/tests/**/*.test.js` | Active |
| End-to-end | Playwright | `frontend/e2e/` | Active |

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

## Backend unit tests

```bash
cd backend
npm test
```

Covers:

- Password policy (`passwordPolicy`)
- Academic RBAC / grade rules (`academicoRules`)
- Upload MIME/extension filter (`uploadFilters`)
- Auth middleware (missing token, inactive user, `token_version`, admin gate) with mocked DB

No live MySQL required for the unit suite.

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

- Frontend: install → unit tests → production build
- Backend: install → unit tests → `node --check src/server.js`

E2E remains optional/manual until secrets and a stable test environment are wired.

## Next coverage candidates

1. Enrollment status transitions (integration)
2. Grade write permissions end-to-end against a test DB
3. Rate-limit behaviour (integration)

## Quality bar for PRs

- Frontend and backend unit tests green
- `npm run build` green in `frontend/`
- No secrets in diff
- Manual smoke: login per role + one enrollment status change

Related: [SECURITY.md](./SECURITY.md), [DEPLOYMENT.md](./DEPLOYMENT.md).
