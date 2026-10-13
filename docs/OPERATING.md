# Operating Guide (NFRs & Runbook)

## SLOs

- Availability: 99.9% during service hours (measured at `GET /api/kernel?health=1`).
- Command latency: p99 < 300ms for writes (`POST /api/kernel`), p99 < 150ms for
  projection reads (`GET /api/kernel?projection=...`).
- Rate limit: 60 req/min per token on `/api/kernel` (429 + `Retry-After` on exceed;
  `X-RateLimit-Limit/Remaining/Reset` on all responses).

## PCI scope

- Card payments go through `payment.authorize → payment.capture` intents only
  (`POST /api/payments/intent`; never accept PANs — only Stripe payment-method
  ids from Terminal/Stripe.js). Provider via `ROS_PAYMENT_PROVIDER`:
  `manual` (cash/POS default) | `simulated-stripe` (demos/tests) |
  `stripe-terminal` (requires `STRIPE_SECRET_KEY`).
- Stripe webhooks (`POST /api/payments/webhook`) verify `stripe-signature`
  against `STRIPE_WEBHOOK_SECRET`; Stripe event id is the kernel `requestId`,
  so redeliveries are idempotent.
- No PAN storage: the event store keeps `method`, `amount`, `amountCents`,
  `gateway`, `gatewayRef` (e.g. `pi_...`) — never card numbers.
  `get.aggregateEvents` requires `audit:view`.
- Webhook secrets are write-only (`list.webhooks` exposes `hasSecret`, never `secret`).

## Venue fiscal configuration

- Tax/gratuity/currency are kernel events, not device prefs:
  `venue.create` carries `taxRate/serviceModel/tableCount/slaMinutes/gratuityRate`;
  `venue.configureTax` makes fiscal changes explicit and auditable.
- The guest check is stamped server-side: checkout calls `order.applyTax`
  with the venue rate before `order.sendToKitchen`. Client cart math is a
  preview only. Every `* 0.05` hardcode has been removed.
- Menu CSV import (`name, price` per line) lives in the setup wizard;
  `menu.setRecipe` wires stock recipes; firing depletes inventory via the
  recipe hook and zero-stock triggers auto-86.

## Server-section scoping

- Order mutation handlers check `order:edit_own`; the `orderSectionPolicy`
  vetoes edit_own-only actors on another server's ticket (`FORBIDDEN` with a
  "ask a manager to transfer" message). Managers/cashiers hold `order:edit`.
- Unassigned tickets (kiosk drafts, `serverId` null) are editable by any taker.

## Projection checkpoints

- `ros_projections_state` persists per-projection cursors; boot loads them and
  replays incrementally (`catchUpAll`), then saves. Memory fallback in dev.
- Hot-board caps: `orders.board` 2000 (closed/voided first),
  `reservations.board` 2000 (terminal states first), `customers.board` 10000
  (least-recently-active first). Full history stays in the event log.

## GDPR / retention

- PII (customer phone/email, reservation contacts) is gated:
  - `customers.board` and `list.customers` never carry PII.
  - Full PII only via `get.customer` (requires `customer:view`; board PII masked
    unless the actor holds `customer:view_pii`).
  - `reservations.board` / `list.reservations.onDate` / `get.reservation` mask
    phone/email unless the actor holds `customer:view_pii`.
- Erasure: `customer.erase` (or aggregate purge per retention policy) removes PII;
  ledger totals remain as anonymized aggregates for accounting.
- Retention default: 24 months for order/payment events, then compact/archive
  (`EventCompactor`) per venue policy.

## Offline reconciliation

- The POS queues writes while offline (`ConnectionPill` / `StaleDataNotice`).
- On reconnect, replayed commands that the server rejects are **recorded in
  Needs Attention** (persistent `pos.attention` entries, not dropped silently):
  1. Conflicts (double-seat, double-book) surface as rejected commands — re-issue.
  2. Payments recorded offline are matched against settlement reports before close.
  3. Voids/comps applied offline require manager PIN (`order:comp`).
- `VERSION_CONFLICT` carries structured `details.{expectedVersion,currentVersion}`;
  the dialog shows yours-vs-latest with retry/reload (message regex is legacy fallback).

## Multi-tenant strategy

- Today: process-singleton kernel (`kernel-singleton`) keyed by
  `ROS_ORG_ID` / `ROS_VENUE_ID`; tenant isolation enforced per event
  (`tenant.orgId/venueId` on every row; cross-tenant reads return
  `AGGREGATE_NOT_FOUND`).
- Roadmap: per-tenant kernel instances (one `EventStore` namespace + projection
  registry per venue) behind the same command/query surface; API keys map to
  `orgId/venueId` scopes.

## Hardware matrix

| Role        | Device                    | Min spec              |
| ----------- | ------------------------- | --------------------- |
| Till        | Tablet / desktop + cash   | 4GB RAM, Chrome/Edge  |
| KDS         | Wall display              | 2GB RAM, kiosk mode   |
| Handheld    | Phone (PWA)               | 44px touch targets    |
| Printer     | ESC/POS receipt           | USB/LAN               |
| Terminal    | Card reader (SDK)         | PCI-PTS certified     |

## Migration / decommission: legacy mutable tables

1. Dual-write: legacy `/api/tables` PATCH routes emit the equivalent kernel
   command (`table.seat/clear/clean/reposition`) where still present.
2. Backfill: replay legacy rows as `table.create` + state-setting commands once,
   then rebuild projections and diff `tables.board` vs legacy table.
3. Cutover: flip reads to `tables.board`; legacy endpoints return 410 with the
   kernel command to use instead.
4. Decommission: drop the mutable tables columns after one full retention window
   with zero 410 hits.

## Backup & restore (nightly, 5 minutes to set up)

The till is the event store in Postgres. Lose it and you lose every ticket,
payment and drawer session ever recorded.

1. **Nightly dump** (cron on the DB host or a GitHub Action):
   `pg_dump "$DATABASE_URL" -Fc -f "ros-$(date +%F).dump"`, keep 14 copies.
2. **Verify**: `pg_restore --list` the newest dump weekly; alert on failure.
3. **Restore**: new database → `pg_restore -d "$DATABASE_URL"` → redeploy
   (the kernel rebuilds every projection from events on boot; checkpoints
   resume from `projection_checkpoints`).
4. **Retention**: event rows are the audit trail — never `DELETE` them to save
   space; use compaction (`ROS_COMPACTION_INTERVAL_MS`) instead.

## Field updates & versioning

- Set `NEXT_PUBLIC_APP_VERSION` at build time (e.g. `v2026.10.07`). The login
  screen shows the build so a manager can confirm every tablet matches.
- Tablets run the PWA: after deploy, each device picks it up on next launch;
  the service worker purges auth-cache entries on version change
  (`CLEAR_AUTH_CACHE` in `public/sw.js`).
- Stuck mid-service? The login screen shows the venue's support contact
  (Settings → Store profile). No contact set → it says to ask a manager.
