# Restaurant OS Kernel (Phases 1–3)

The operating-system layer that the existing POS features plug into. It replaces
scattered mutable React state with a single **event-sourced, multi-tenant,
command-driven kernel** with a plugin architecture — plus (Phase 3) the
**integration fabric** that pushes events back out to the world: webhooks with
retry + DLQ, marketplace order injection, accounting/delivery connectors, a
public REST API with a generated SDK, and an event compaction job.

```
pos/kernel/
├── types/                  Domain primitives: DomainEvent, Command, Query,
│                           TenantContext, ActorContext, CommandResult, snapshots
├── event-store/            Append-only store (source of truth)
│   ├── event-store.ts          EventStore interface + buildEvent()
│   ├── in-memory-event-store.ts  dev/test backend (hot + cold archive tiers)
│   ├── postgres-event-store.ts   Neon/Postgres backend (sql.unsafe, archive UNION)
│   ├── versioned-store.ts        schemaVersion stamping + UpcastRegistry (reads)
│   ├── compaction.ts             EventCompactor: snapshot backfill + hot→cold prune
│   └── schema.sql               ros_events / ros_snapshots / ros_projections_state
│                                / ros_events_archive
├── aggregates/             Behavior + invariants (write model)
│   ├── aggregate.ts            Base class: raise/replay/markCommitted, exists, versioning
│   ├── order.aggregate.ts      Order: lines, kitchen lifecycle, payments, close/void
│   ├── table.aggregate.ts      seat/clear/clean/reserve lifecycle
│   ├── inventory.aggregate.ts  receive/consume/waste/adjust (stock invariants)
│   ├── reservation.aggregate.ts book/confirm/seat/complete/cancel/noShow/reschedule
│   ├── waitlist.aggregate.ts   join/notify/seat/remove/noShow
│   ├── menu.aggregate.ts       create/price/86/modifier groups (margin math)
│   ├── shift.aggregate.ts      schedule/clock/breaks (worked-time + overtime)
│   ├── platform-order.aggregate.ts  marketplace mapping (received→completed|cancelled)
│   ├── registry.ts             registerAggregate, loadAggregate, loadExisting,
│   │                           saveAggregate, appendEvent (optimistic lock)
│   └── repository.ts           AggregateRepository: the unified write path
├── commands/               CQRS write side
│   ├── command-bus.ts          dispatch + permission gate + policies + hooks
│   ├── define-command.ts       declarative handler shape: load → mutate → commit → publish
│   └── core-handlers.ts        19 core commands, 4 queries (order/table/inventory/kitchen)
├── queries/                CQRS read side
│   └── query-bus.ts            ask() with permission gate; ctx carries repository
├── projections/            Event-sourced read models (replace context state)
│   ├── projection.ts           Projection + registry, rebuild/catch-up/onChange
│   └── builtins.ts             kitchen.queue, tables.board, inventory.board
├── hooks/                  Extension points
│   └── hook-bus.ts             command:before/after/failed, event:published
├── modules/                Plugin architecture — every domain IS a module
│   ├── module-registry.ts      install/activate/deactivate/uninstall + deps
│   ├── reservations.module.ts  7 commands, 2 queries, reservations.board
│   ├── waitlist.module.ts      4 commands, 2 queries, waitlist.board
│   ├── menu.module.ts          6 commands, 3 queries, menu.board + 86 policy
│   ├── staff.module.ts         5 commands, 2 queries, event-recomputed board
│   ├── platform.module.ts      3 commands (marketplace injection), 2 queries,
│   │                           platform.orders — nested dispatch through the bus
│   ├── integrations.module.ts  webhook.subscribe/update/unsubscribe +
│   │                           outbound.replay, list.webhooks/list.outbound,
│   │                           webhooks.endpoints, event:published fanout
│   └── socket-bridge.ts        event:published → semantic rooms + legacy aliases
├── integrations/           Phase 3 integration fabric
│   ├── fabric.ts               IntegrationFabric { webhooks, connectors, registry }
│   ├── outbound-queue.ts       OutboundQueue: retry/backoff/DLQ/replay + transports
│   ├── webhooks.ts             HMAC signing, envelope, fanout, HttpWebhookTransport
│   ├── webhook-endpoint.aggregate.ts  event-sourced subscriptions (secret on stream)
│   ├── connectors.ts           Connector interface + ConnectorRegistry
│   ├── accounting.connector.ts sales/payments/voids → journal entry messages
│   └── delivery.connector.ts   marketplace progress → delivery status messages
├── tenant/                 Multi-tenancy + auth adapter
│   ├── tenant.ts               newTenant, systemActor, assertTenant, tenantFromEnv
│   └── permission-map.ts       existing RBAC → kernel capabilities
├── server/                 Server-side helpers
│   └── kernel-singleton.ts     shared getKernel() for /api/kernel
├── react/                  Client bridge
│   └── kernel-provider.tsx     useKernel / useCommand / useProjection (via /api/kernel)
├── kernel.ts               Orchestrator: repository, buses, modules, boot/shutdown
└── index.ts                createKernel() + bootKernel() public entry point
```

## Surface (live, not enumerated here)

Commands, queries, projections and modules grow with the domain — the old
static counts rotted within weeks. Discover the live surface at runtime via
`GET /api/kernel` (`audit:view`), or read [`docs/KERNEL-REFERENCE.md`](../docs/KERNEL-REFERENCE.md)
for the curated reference.

## How a write flows (unified path)

```
UI ──useCommand().run("order.addLine", {...})        marketplace ──POST /api/v1/commands
      └─> POST /api/kernel                                 └─> (same kernel)
            └─> CommandBus.dispatch  (permission gate → policies → hook: command:before)
                  └─> AggregateRepository.load     (AGGREGATE_NOT_FOUND guard + snapshot)
                        └─> agg.addLine()          (invariants live in the aggregate)
                              └─> AggregateRepository.save
                                    ├─> EventStore.appendMany  (optimistic lock, schemaVersion stamp)
                                    ├─> snapshot policy        (every N versions)
                                    └─> hooks emit event:published
                                          ├─> projections update (kitchen.queue, tables.board, ...)
                                          ├─> SocketBridge → semantic rooms + legacy alias events
                                          └─> integration fanout → webhook queue + connector queue
                                               (signed deliveries, retry → DLQ → replay)
```

Every handler — core or module — goes through the same repository, so the
existence guard and snapshot policy can never be forgotten.

## Cross-domain guarantees (the OS win)

Because domains are modules over one kernel, they can enforce rules on each
other without entangling code:

| Guard | Where | Mechanism |
|---|---|---|
| Table double-booking | `reservation.book` | overlaps active rows from `reservations.board` |
| Seating onto occupied tables | `waitlist.seat` | reads `tables.board` status |
| Selling 86'd items | `order.addLine` | `menu` module registers a **CommandPolicy** that vetoes any line referencing an unsellable `MenuItem` |
| Injecting 86'd items from a marketplace | `platform.ingestOrder` | ingest drives the *core command bus*, so the menu policy vetoes injected orders too |
| Clocking into someone's shift | `staff.clockIn` | aggregate-level ownership check (scheduling rights override) |

The 86-policy is the flagship: the menu module vets a command owned by the
order domain — impossible to bolt on cleanly in a monolithic POS.

## Socket bridge

Listens on `event:published` and fans out per `DEFAULT_ROUTES`:

- **Canonical** `ros.event` with `{ orgId, venueId, eventType, aggregateId, payload }`
  for new OS-aware clients.
- **Legacy aliases** (`order_new`, `order_preparing`, `order_ready`,
  `reservation_new`, ...) emitted with the exact payloads the existing
  `lib/socket-client.ts` listeners expect — current UI keeps working untouched.
- **Semantic rooms** (`allStations`, `kitchen`, `servers`, `reception`,
  `backOffice`, `management`) map onto the standalone server's actual rooms via
  a configurable `DEFAULT_ROOM_MAP`.
- Transport is pluggable: `HttpSocketTransport` POSTs to the existing
  `/internal/emit` endpoint (enabled when `INTERNAL_EMIT_SECRET` is set);
  `RecordingSocketTransport` is used by the smoke test.

Order events carry routing context (`serverId`, `tableId`, `customerId`,
`channel`) on every payload, so the bridge never loads an aggregate to decide
rooms.

## Invariants live in aggregates, not the API

`order.close` → `ORDER_UNPAID`; `inventory.consume` → `INSUFFICIENT_STOCK`;
negative line quantities → `INVALID_LINE_QUANTITY`; skipping `sent → ready`
without `begin` → `BAD_LINE_STATE`; reservations and platform orders have
terminal-state machines. The command bus never validates business rules — every
client (POS UI, kiosk, platform, integration) gets identical guarantees.

## Event schema versioning

`VersionedEventStore` stamps every append with `metadata.schemaVersion` and
runs registered **upcasters** on every read/subscribe, so aggregates only ever
see the current payload shape. Snapshots are version-tagged and skipped when
stale (forcing a replay through the upcast chain). Event payloads remain
forward-only — no destructive migrations, history stays replayable forever.

## Multi-tenancy

Every event carries `{ orgId, venueId, zoneId? }`. The store scopes all reads
and writes by tenant; snapshots are keyed by tenant. Verified by the smoke test
(a tenant-1 reservation returns `AGGREGATE_NOT_FOUND` in tenant 2).

## Storage backends

- **In-memory** (default in dev): full `EventStore`, zero setup, hot + cold
  (archive) tiers for compaction.
- **Postgres/Neon**: set `ROS_USE_PG=1` and run `pos/kernel/event-store/schema.sql`.
  Unique constraint `(org_id, venue_id, aggregate_type, aggregate_id,
  aggregate_version)` is the optimistic-concurrency guarantee at the DB layer.
  Compaction moves rows to `ros_events_archive` in one atomic CTE; all reads
  UNION hot + cold, so nothing observable changes — the hot table just shrinks.

## Phase 3: integration fabric

`kernel/integrations/` is the fabric that pushes the event stream back out to the
world, wired by the `ros.integrations` module on the `event:published` hook.

### Webhooks with retry + DLQ

Subscriptions are event-sourced aggregates (`webhook.subscribed` /
`webhook.updated` / `webhook.unsubscribed`), managed by
`webhook.subscribe` / `webhook.update` / `webhook.unsubscribe`
(`integration:manage` capability) and readable via `list.webhooks`
(the signing secret is redacted; only `hasSecret` is exposed).

On `event:published`, every active matching endpoint gets a delivery enqueued on
the shared `OutboundQueue`:

- Body: canonical envelope `{ id, type, occurredAt, position, tenant,
  aggregate, actor, payload, metadata }`
- Headers: `X-ROS-Event`, `X-ROS-Timestamp`, `X-ROS-Signature`
  (HMAC-SHA256 over `${timestamp}.${body}`), `X-ROS-Delivery` (delivery id —
  receivers dedupe on it). Verify with `verifyWebhookSignature()`.
- `webhook.*` / `outbound.*` infra events are never delivered (not even to `*`).

Delivery: `pending → (ok) delivered`; failures retry with exponential backoff
(`baseDelayMs * factor^(attempts-1)`, capped; default 1s → 2s → 4s → … ×5) and
land in the DLQ as `dead` when `maxAttempts` exhausts. Dead letters requeue via
`outbound.replay` (fresh attempt budget) — used by the smoke test to walk an
endpoint through outage → recovery.

```ts
await bootKernel(kernel, {
  integrations: {
    webhookTransport: new HttpWebhookTransport(), // RecordingOutboundTransport in tests
    retry: { maxAttempts: 5, baseDelayMs: 1000, factor: 2, maxDelayMs: 60000 },
    autoProcess: true, // drain on fanout + interval sweep (false by default)
    processIntervalMs: 2000,
  },
})
```

### Platform / marketplace order injection

`ros.platform` injects external orders (Uber Eats, DoorDash, ...) through
`platform.ingestOrder`. Key properties:

- **Idempotent**: the aggregate id is `sha256(platform # externalOrderId)`
  shaped as a UUID, so a retried marketplace webhook maps onto the same stream
  and returns `aggregateId` with zero new events.
- **Same guarantees as POS orders**: ingest drives the *core command bus*
  (`order.create` → `order.addLine` × n → optional `order.sendToKitchen`),
  so the menu 86-policy vetoes an injected order with `MENU_ITEM_UNAVAILABLE`
  — and the partially-created POS order is auto-voided (the voided `orderId`
  comes back in `error.details` for the audit trail).
- **Lifecycle**: `PlatformOrder` (received → completed | cancelled) —
  `platform.cancelOrder` voids the linked POS order first (a closed order
  rejects the cancel atomically), `platform.completeOrder` marks marketplace
  completion. Read via `get.platformOrder` / `list.platformOrders` (projection
  `platform.orders`).

### Accounting + delivery connectors

Connectors are pure translator functions (`event → outbound message`) over the
same queue/DLQ machinery, registered in the `ConnectorRegistry` and delivered
to a connector transport (logs by default; point at a provider URL in prod):

- **accounting** (`order.closed` → `sale` journal with `gross`/`paid` totals
  stamped on the close event, `order.paymentRecorded` → `payment`,
  `order.voided` → `void`) — a QuickBooks/Xero ingester shape.
- **delivery** (`platform.orderReceived` → `accepted`, `order.sentToKitchen`
  → `preparing`, `kitchen.lineReady` → `ready`, `order.closed` →
  `completed`, `platform.orderCancelled` → `cancelled`) — only for
  channel-`platform` orders; POS orders are ignored.

### External access

External clients go through the same authenticated surface: `POST /api/kernel`
(commands, `requestId` idempotent) and `GET /api/kernel?query=…` /
`?projection=…` (permission-gated reads). The retired `/api/v1` static-key API
and the generated SDK (`sdk/ros-sdk.ts`, `kernel-sdk.cjs`) were removed with
the legacy REST cutover — one surface, one auth model, no drift to police.

### Event compaction job

`EventCompactor` (in `kernel/event-store/compaction.ts`) converges every run:

1. **Snapshot backfill** — any stream at/over `minEventsPerAggregate` gets a
   fresh snapshot, even if no write happened recently (bounds replay to
   `snapshot + tail`).
2. **Prune (opt-in)** — events at/below the snapshot version move to the cold
   archive (`compactAggregate`, atomic CTE on Postgres). Replay never needs
   them (the snapshot covers that range) and reads merge the archive back, so
   projections and audit queries are untouched — only the hot set shrinks.

Optimistic locking is archive-aware (the version check spans hot ∪ cold), so
writes after compaction never conflict. Schedule it via
`bootKernel(kernel, { compaction: { intervalMs, minEventsPerAggregate, prune } })`
(cap disposer registered on `kernel.shutdown()`), or run `new
EventCompactor(store, opts).run(tenant)` manually. `dryRun: true` only reports.

## Verifying

```bash
npm run kernel:smoke       # compiles kernel + runs 129 end-to-end assertions
npm run kernel:typecheck   # kernel in isolation (green despite app type debt)
npm run kernel:sdk:check   # committed SDK matches the live surface
```

Smoke coverage: module installation, KDS line lifecycle, socket bridge routing,
double-booking guard, waitlist↔tables integration, 86 cross-module policy,
staff time-clock state machine, upcasting, snapshot policy + replay-from-snapshot,
auth-adapter permission gating, tenant isolation, audit trail, **outbound queue
retry/backoff/DLQ/replay, webhook subscribe→sign→deliver→unsubscribe with HMAC
verification, platform injection idempotency + 86-veto-through-ingest +
cancel/complete lifecycle, accounting + delivery connectors, compaction
(snapshot backfill, hot→cold archive, audit intact, post-compaction writes),
and surface + SDK freshness**.

## Wiring into the existing app

```tsx
// app/layout.tsx  (wrap existing providers; do not remove them yet)
import { KernelProvider } from "@/kernel/react/kernel-provider"

<KernelProvider>
  <AuthProvider>
    <AppProviders>{children}</AppProviders>
  </AuthProvider>
</KernelProvider>
```

```tsx
// inside a component, replacing e.g. OrderContext usage
import { useCommand, useProjection } from "@/kernel/react/kernel-provider"

const { run } = useCommand()
const kitchen = useProjection<KitchenQueueState>("kitchen.queue")

await run("order.sendToKitchen", { orderId })
```

Server-side, the singleton kernel is created and booted lazily by
`kernel/server/kernel-singleton.ts` (shared by `app/api/kernel/route.ts` and
`app/api/v1/*`): `createKernel({ tenant })` +
`bootKernel(kernel, { socket: { enabled: true }, integrations: { autoProcess: true } })`.

The kernel runs **alongside** the existing contexts. Migrate module by module
(each context becomes a thin `useProjection` call) without touching the UI tree.

## Phase roadmap

- **Phase 1 (done)**: event-sourced kernel, CQRS, aggregates, projections,
  multi-tenant store, plugin registry, auth adapter, client bridge, smoke suite.
- **Phase 2 (done)**: socket bridge w/ legacy compatibility; reservations,
  waitlist, menu, staff-shift aggregates delivered as *modules*; snapshot
  policy (AggregateRepository), event schema versioning (upcasters),
  cross-module policies, unified guarded write path.
- **Phase 3 (done)**: integration fabric (`OutboundQueue` w/ retry + DLQ,
  webhook subscriptions + HMAC delivery, accounting/delivery connectors),
  platform/marketplace order injection (idempotent, policy-gated, atomic
  cancel/complete), public API (`/api/v1`, API-key auth) + generated SDK
  (`npm run kernel:sdk`), event compaction job (snapshot backfill + hot→cold
  archive with transparent reads + archive-aware optimistic locking).
- **Phase 4**: intelligence layer (demand forecast → auto-schedule, menu
  engineering, dynamic pricing), offline-first sync protocol, hardware drivers.