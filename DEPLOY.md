# Deployment / Operations Runbook

## Env
| Var | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | yes | Postgres 13+ |
| `JWT_SECRET` | yes | HS256 signing; boot throws in prod if missing |
| `ROS_USE_PG` | dev only | `1` = Postgres event store locally (prod always Postgres) |
| `ROS_ORG_ID` / `ROS_VENUE_ID` | yes | Tenant scope; stable slugs — changing them starts an empty venue |
| `INTERNAL_EMIT_SECRET` | for realtime | Enables kernel SocketBridge + `/internal/emit` |
| `NEXT_PUBLIC_SOCKET_URL` | for realtime | Browser → socket server |
| `WS_PORT` | no | Standalone WS (`npm run start:ws`, default 3001) |
| `NEXT_PUBLIC_APP_VERSION` | recommended | Build tag shown on login + fleet list (e.g. `v2026.10.07`) |
| `ROS_PAYMENT_PROVIDER` | no | `manual` (default) \| `simulated-stripe` \| `stripe-terminal` (see `docs/CARD-PILOT.md`) |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` / `STRIPE_TERMINAL_LOCATION` | card pilot only | Live terminal; unset = manual |
| `UPSTASH_REDIS_REST_URL/TOKEN` | prod | Shared rate-limit store; fallback is per-instance Map |

## Database
```bash
psql "$DATABASE_URL" -f db/schema.sql
psql "$DATABASE_URL" -f kernel/event-store/schema.sql
psql "$DATABASE_URL" -f db/seed.sql   # demo only
npm run verify:sql                    # no-DB static check
```

## Processes
- `npm run dev` / `npm run build && npm run start` — Next app.
- `npm run start:ws` — standalone Socket.IO (needs `JWT_SECRET`, `INTERNAL_EMIT_SECRET`).
- Compaction: pass `compaction: { intervalMs }` to `bootKernel` (or cron `EventCompactor.run`).

## Health
- `GET /api/kernel?health=1` (needs `audit:view`) — projections, positions, counts.
- `/dashboard/diagnostics` (needs `audit:view`) — health, offline queue, printer test, stress checklist.
- Nightly backup + Sunday restore-verify: `.github/workflows/backup.yml` (needs `BACKUP_DATABASE_URL` secret).

## Seed accounts
All `pos1234`: `owner/manager/host/waiter(+2)/bartender/cashier/kitchen@copperfig.test`.
Demo only. Before any real service: change every password, set staff PINs
(Staff → PIN), set `JWT_SECRET` to a long random value, and confirm
`ROS_USE_PG=1` with `ROS_ORG_ID`/`ROS_VENUE_ID` fixed.
