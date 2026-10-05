# Security Hardening Guide

1. **Tokens**: access (15m) in memory only; refresh (7d) HttpOnly `SameSite=Strict`, rotated on use.
   Both cookies HttpOnly — XSS cannot steal them via JS. CSP in `next.config.ts` headers.
2. **AuthZ**: kernel checks `requiredPermission` per command/query; projections gated by
   `assertProjectionAccess` on both `/api/kernel` and `/api/v1/queries`.
3. **Rate limits**: login 8/15m per ip:email; `/api/v1/commands` 120/min, `/queries` 180/min per key+IP (Redis, else in-process).
4. **API keys**: static `ROS_PUBLIC_API_KEYS`, timing-safe compare, 503 when unconfigured.
   For production, move to DB-backed keys with `scopes/expiresAt/lastUsedAt` + audit.
5. **Input**: Zod at command bus (`INVALID_PAYLOAD` with issues) + route schemas; aggregates own invariants.
6. **PII**: `customers.board` excludes email/phone; `reservations.board` still carries contact —
   add column masking before exposing to `reservation:view` roles.
7. **Writes**: use `sqlWrite`, never `sql`, for mutations (`lib/db.ts` forgiving reads return `[]` in dev).
8. **Audit**: `audit()` is best-effort — add outbox table + alerting before compliance sign-off.
9. **Secrets**: never commit `.env.local`; `JWT_SECRET` required in prod; rotate `INTERNAL_EMIT_SECRET` independently.
