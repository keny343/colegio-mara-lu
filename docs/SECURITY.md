# Security — Colégio Mara & Lu

## Threat model (summary)

| Asset | Risk | Mitigation in this project |
|-------|------|----------------------------|
| User sessions | Token theft | httpOnly cookies, Secure on HTTPS, short TTL (24h) |
| Passwords | Offline cracking | bcrypt (10–12 rounds), password policy |
| Brute-force login | Credential stuffing | Rate limit + per-account lock (5 fails / 15 min) |
| Privilege escalation | Cross-role access | RBAC middleware; role reloaded from DB |
| Public enrollment spam | Abuse of open form | Dedicated rate limit (10 / 15 min) |
| Uploaded files | Malware / wrong type | MIME/extension filters, size caps, auth’d downloads |
| Secrets in repo | Leak | `.env` / hosting env vars only |

## Authentication

- **JWT** signed with `JWT_SECRET`
- Delivered primarily as **httpOnly** cookie `token`
- Also accepts `Authorization: Bearer <token>`
- Payload includes `id`, `role`, `v` (`token_version`)
- Password change increments `token_version` → old sessions invalid
- Inactive users (`ativo = 0`) cannot authenticate successfully for staff/portal use

There is **no open self-registration** for staff accounts. Public enrollment creates a pending/inactive pathway until staff approval.

## Authorization (RBAC)

Roles: `admin` | `coordenador` | `professor` | `aluno`

| Middleware (backend) | Typical use |
|----------------------|-------------|
| `authMiddleware` | Any authenticated user |
| `adminMiddleware` | Platform administration |
| `staffMiddleware` | Admin + coordenador (+ selected staff flows) |
| `coordenadorOuAdminMiddleware` | Academic oversight |
| `professorMiddleware` | Teaching scope |
| `notasAccessMiddleware` | Grade write/read rules |

Coordinators may have **scope**: `curso_coordenado` and/or `nivel_coordenado`. Frontend mirrors checks in `frontend/src/utils/roles.js`.

## Hardening stack

- **Helmet** with tuned CSP
- **CORS** allowlist (`FRONTEND_URL`, `ADDITIONAL_ORIGINS`)
- **express-rate-limit** on API, login, enrollment, credentials, messages, documents
- Body size limit (~1mb)
- `Cache-Control: no-store` on `/api`
- Production guard: `E2E_TEST=true` is refused when `NODE_ENV=production`
- Weak JWT secret length warning in production

## Password policy

Implemented in `backend/src/utils/passwordPolicy.js` (minimum length and complexity: letters + numbers).

## Uploads

- Filters: `backend/src/config/uploadFilters.js`
- Avatars / documents / materials → storage adapter (Supabase)
- Justifications may use local multer under controlled path
- Non-public files served through authenticated routes

## Operational checklist

Before every push:

```bash
git status
git diff
```

Search the diff for: `password`, `secret`, `token`, `api_key`, `JWT_SECRET`, `DATABASE_URL`, service keys.

Never commit `.env` files or real credentials.

## Known gaps / roadmap

- Formal security regression suite on the API
- OpenAPI-driven auth matrix review
- Optional 2FA for admin accounts
- Automated secret scanning in CI

Related: [ARCHITECTURE.md](./ARCHITECTURE.md), [API.md](./API.md).
