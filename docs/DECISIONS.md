# Technical decisions — Colégio Mara & Lu

## ADR-001 — Separate SPA and API

**Problem:** Need independent scaling and hosting for UI vs business logic.  
**Options:** Monolith SSR · SPA + API · BFF  
**Decision:** React SPA + Express REST API  
**Why:** Matches Vercel/Render split; clear RBAC boundary on API; simpler mobile-ready API reuse.

## ADR-002 — JWT in httpOnly cookies

**Problem:** Persist session without exposing tokens to XSS via `localStorage`.  
**Options:** localStorage JWT · httpOnly cookie · server sessions only  
**Decision:** JWT in httpOnly cookie (+ Bearer for tooling)  
**Why:** Better default against XSS token theft; works with Vercel↔Render cross-site using Secure + SameSite=None when needed.

## ADR-003 — RBAC with DB role refresh

**Problem:** Role/scope changes must not leave stale privileges in long-lived tokens.  
**Decision:** JWT carries identity; middleware reloads `role` / coordinator scope from MySQL each request; `token_version` invalidates after password change.  
**Why:** Safer privilege revocation without full session store.

## ADR-004 — Boot-time schema helpers

**Problem:** Cloud deploys without a formal migration runner.  
**Decision:** Idempotent `ensure*.js` utilities on startup + SQL scripts in repo.  
**Why:** Reduces “forgot to migrate” outages; trade-off is less strict versioned migrations (documented debt).

## ADR-005 — Public enrollment without open staff signup

**Problem:** Collect applications without exposing admin registration.  
**Decision:** Public `POST /public/inscricoes` with rate limits; accounts inactive until staff approval.  
**Why:** Reduces account farming while keeping conversion funnel online.

## ADR-006 — Design System V2 for product UI

**Problem:** Landing and admin looked like different products.  
**Decision:** Shared tokens in `frontend/src/index.css`; DM Sans in product shells; Playfair reserved for institutional marketing.  
**Why:** Consistent SaaS feel without losing school brand identity.
