# ADR-003: jose-only auth, HttpOnly cookies, RBAC nav

Date: 2026-10-01 · Status: Accepted

## Context
Three JWT stacks (`jose`, `jsonwebtoken`, `jwt-decode`), readable `posAccessToken`
cookie (XSS), hardcoded 5 personas, dead `/api/users` + `/api/shifts` paths.

## Decision
- Canonical stack: `jose` (`lib/jwt.ts`, HS256, 15m access + 7d refresh). `lib/auth-utils.ts`
  is a compat shim; `lib/auth.ts` no longer depends on `jwt-decode`.
- Both cookies HttpOnly `SameSite=Strict`; client keeps access token in memory only.
- `withAuth` attaches `req.user`; shifts go through kernel `staff.scheduleShift/clockIn/clockOut`.
- Nav: personas are presets, `NAV_META.permission` + `ROLE_PERMISSIONS` are the gate
  (`canSeeNav` in `lib/personas.ts`).
- Rate limiting is Redis-backed with in-process fallback; enforced on auth + `/api/v1/*`.

## Consequences
- Standalone WS server (`index.ts`) still verifies with `jsonwebtoken` (separate process, same secret/HS256) — documented, not duplicated in Next.
- `generateToken()` legacy signer removed; use `signAccessToken/signTokenPair`.
