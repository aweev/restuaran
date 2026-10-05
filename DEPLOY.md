# Deployment / Operations Runbook

## Env
| Var | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | yes | Postgres 13+ |
| `JWT_SECRET` | yes | HS256 signing; boot throws in prod if missing |
| `ROS_USE_PG` | dev only | `1` = Postgres event store locally (prod always Postgres) |
| `INTERNAL_EMIT_SECRET` | for realtime | Enables kernel SocketBridge + `/internal/emit` |
| `NEXT_PUBLIC_SOCKET_URL` | for realtime | Browser → socket server |
| `WS_PORT` | no | Standalone WS (`npm run start:ws`, default 3001) |
| `ROS_PUBLIC_API_KEYS` | for `/api/v1` | `key[,key=role]`; empty = 503 disabled |
| `UPSTASH_REDIS_REST_URL/TOKEN` | prod | Shared rate-limit store; fallback is per-instance Map |
| `TWILIO_*` | no | Waitlist SMS |

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
- `GET /api/v1/meta` (API key) — live command/query/projection surface; SDK generated from it (`npm run kernel:sdk:check` in CI).

## Seed accounts
All `pos1234`: `owner/manager/host/waiter(+2)/bartender/cashier/kitchen@copperfig.test`.
