# ADR-002: Offline-first kernel client

Date: 2026-10-01 · Status: Accepted

## Context
POS terminals lose connectivity mid-rush. Lost writes = lost revenue.

## Decision
`kernel/react/kernel-provider.tsx` owns a durable queue:
- IndexedDB (`pos-kernel/offlineQueue`) primary, localStorage mirror/fallback.
- 5s flush, in-order, stable `requestId`; only `TypeError` (network) requeues, never 4xx/5xx.
- Caps: 200 items, 25 attempts, 7-day TTL; `connection live|connecting|offline` + `pendingCount` surfaced.
- Service worker via `InjectManifest` (`public/sw.js`) caches shell; API uses NetworkFirst (5 min).

## Consequences
- Every write must go through `useCommand` to get queuing; raw `fetch` bypasses it (migration in Phase 1).
- Conflict UI still needed for concurrent edits (table moves, order mods).
