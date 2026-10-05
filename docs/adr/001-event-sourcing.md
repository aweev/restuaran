# ADR-001: Event-sourced kernel as canonical write path

Date: 2026-10-01 · Status: Accepted

## Context
Mutable Postgres tables (`Order`, `Table`, `MenuItem`…) were the only write path.
Cross-domain guards (86'd items, double-seat) lived in UI code or not at all.

## Decision
`kernel/` (CQRS+ES, single-CTE atomic append, hot/cold archive, versioned upcasters)
is the canonical write path. REST `POST/PATCH/DELETE` under `app/api/*` are legacy,
kept with `Sunset` + `X-Migrate-To: /api/kernel` headers until callers migrate.
Projections are canonical reads; direct table reads remain for history only.

## Consequences
- All invariants in aggregates; cross-module vetoes as policies (`noSoldItems86dPolicy`).
- `requestId` idempotency enforced at `CommandBus` (5000-entry LRU).
- Projection rebuild is parallel (concurrency 4); boot pays O(events × projections) once.
- Drift risk mitigated by `GET /api/kernel?health=1` + nightly reconciliation (to add as cron).
