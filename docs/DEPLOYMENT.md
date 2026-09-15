# Deployment — Colégio Mara & Lu

## Production topology

| Layer | Platform | Notes |
|-------|----------|-------|
| Frontend | **Vercel** | CRA build; SPA rewrites |
| Backend | **Render** | Node `npm start` |
| Database | **MySQL** (cloud) | e.g. Aiven / managed MySQL |
| Files | **Supabase** storage | Avatars, documents, materials |

Example backend URL (current): `https://colegio-mara-lu-backend.onrender.com`  
Frontend rewrites: `frontend/vercel.json` proxies `/api/*` and `/uploads/*` to the API host.

## Environment variables

### Backend (Render)

Required:

- `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` (+ `DB_SSL` if needed)
- `JWT_SECRET` (≥ 32 characters in production)
- `FRONTEND_URL` (exact Vercel origin)
- `NODE_ENV=production`
- `PORT` (provided by host)

Uploads:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_KEY`

Optional:

- `ADDITIONAL_ORIGINS` (comma-separated)
- Legacy Cloudinary vars if still used in a branch of uploads

### Frontend (Vercel)

- Prefer **omit** `REACT_APP_API_URL` when using `vercel.json` rewrites (same-origin `/api`)
- If calling the API directly, set `REACT_APP_API_URL` to the Render origin

Never commit real `.env` files.

## Build & start

```bash
# Frontend
cd frontend
npm ci
npm run build

# Backend
cd backend
npm ci
npm start
```

## Local development

See root `INSTALACAO.md`.

Typical:

```bash
# Terminal 1
cd backend && npm run dev   # :49152

# Terminal 2
cd frontend && npm start    # :3000 (proxies API)
```

## Cold starts

Render free/sleeping instances may delay the first API request. Document this in demos; consider a paid always-on instance for interviews.

## Health check

`GET /health` on the backend — use for uptime monitors.

## Checklist before go-live

- [ ] Strong `JWT_SECRET`
- [ ] CORS origins match the live frontend URL
- [ ] MySQL backups enabled
- [ ] Supabase bucket policies reviewed
- [ ] `E2E_TEST` not set in production
- [ ] Smoke test: login (admin, professor, aluno) + enrollment status change
- [ ] Frontend build succeeds (`CI=false` script already used for CRA warnings policy)

More narrative: `docs/RELATORIO-E-HOSPEDAGEM.md`.

Related: [SECURITY.md](./SECURITY.md), [TESTING.md](./TESTING.md).
