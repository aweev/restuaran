# Comprehensive Gap Analysis: Restaurant POS System

> **Status:** Verified against source on 2026-09-30. Three material claims in the
> original draft were corrected after code inspection — see
> [Appendix: Verification & Corrections](#appendix-verification--corrections).

---

## Executive Summary

This is a **sophisticated, event-sourced POS platform** with a well-designed kernel architecture (CQRS/ES, modular domain boundaries, cross-module policies, projection-based read models). It demonstrates **strong engineering discipline** in the backend kernel. However, the **frontend layer remains largely legacy** — still fetching from REST APIs and managing local state in React contexts, creating a **split-brain architecture** where the kernel's guarantees (consistency, auditability, cross-module guards) are bypassed by the UI. The system is **~70% "kernel-first" in design but ~30% "kernel-first" in practice**.

---

## 1. Architecture & System Design

### 1.1 Split-Brain: Kernel vs. Legacy REST Contexts (Critical)

**Problem:** The kernel provides a complete command/query/projection surface (`/api/kernel` POST/GET), but **every frontend context** (`OrderContext`, `MenuContext`, `TableContext`, `CartContext`, `AuthContext`, etc.) still calls **legacy REST endpoints** (`/api/orders`, `/api/menu`, `/api/tables`) that write directly to Postgres tables — **bypassing the event store entirely**.

**Evidence (verified):**
- `context/OrderContext.tsx:317` → `fetch("/api/orders")` (GET), `:373` (POST) — REST
- `context/MenuContext.tsx:145` → `fetch("/api/menu")` (GET), `:235` (POST) — REST
- `context/TableContext.tsx:38` uses `useProjection("tables.board")` ✓ and `useCommand` ✓ — **this one is migrated**
- `context/CartContext.tsx:386` — purely localStorage + local reducer, **no kernel integration at all**
- `context/AuthContext.tsx` — JWT + localStorage, **no kernel commands for auth**
- `app/dashboard/orders/page.tsx:53-54` — already migrated (`useProjection("orders.board")` + `useCommand`)

**Impact:**
- **Data inconsistency**: Kernel projections (e.g., `orders.board`) diverge from REST-mutated tables
- **Guard bypass**: Menu 86'd policy (`noSoldItems86dPolicy`) only blocks kernel `order.addLine`; REST `/api/orders` POST ignores it
- **No audit trail** for REST mutations
- **Double maintenance**: Every domain has two write paths

**Highest-Value Fix:**
1. **Delete all legacy `/api/*` write endpoints** (POST/PATCH/DELETE for orders, menu, tables, reservations, waitlist, inventory, customers)
2. **Migrate every context to `useCommand`/`useProjection`** from `@/kernel/react/kernel-provider` — the provider is already mounted app-wide in `app/layout.tsx:59` and has two working reference consumers (`TableContext`, orders page)
3. **Expose kernel query handlers** for read paths that need richer shapes (e.g., `get.order` with full line details)
4. **Keep `/api/v1/commands|queries`** for external integrations only

---

### 1.2 Missing Kernel Modules (High)

**Problem:** Several domains exist in schema/UI but **lack kernel modules**. Verified contents of `kernel/modules/`: `customers`, `integrations`, `menu`, `platform`, `reservations`, `staff`, `waitlist` (+ registry, socket-bridge). Missing:

- **Inventory** — schema + UI + `inventoryBoardProjection` exist, but no `inventory.module.ts`, no aggregate, no commands
- **Payments/Payouts** — schema tables (`Payment` via `app/api/orders/[id]/payments/route.ts`), but no kernel domain
- **Accounting/Financial Close** — schema has `AuditLog`, but no double-entry ledger, no period close
- **Gift Cards** — types exist (`gift-card.types.ts`), no module
- **Marketing/Campaigns** — types exist, no module
- **Multi-location** — types exist, no module

**Impact:** These domains remain **CRUD apps on mutable tables**, losing all kernel guarantees.

---

### 1.3 Module Dependency Graph Undocumented (Medium)

**Problem:** Modules declare `dependencies?: string[]` but **no visual/graph documentation** exists. Circular dependency risk between `platform` → `order` (ingest creates orders) and `menu` → `order` (86 policy).

**Fix:** Generate a Mermaid graph from module registry at boot; emit as `/api/kernel?graph=modules`.

---

## 2. User Interface & Experience

### 2.1 Persona System is Rigid & Incomplete (High)

**Problem:** `lib/personas.ts` hardcodes **5 roles** (`admin | manager | staff | kitchen | waiter` — `types/auth.ts:1`) with fixed `visibleNav`. Real restaurants have **fluid roles** (a manager who also serves; a bartender who hosts). No **composite permissions**, no **custom personas**, no **per-venue overrides**.

**Evidence (verified):**
- `components/dashboard/dashboard-nav.tsx:32` — `visible = ORDER.filter(o => persona.visibleNav.includes(o.key))` — zero flexibility
- `types/auth.ts:115` — `ROLE_PERMISSIONS: Record<UserRole, PermissionName[]>` exists (permission names like `menu:view` are already defined) but **navigation doesn't use them**

**Impact:** Forces venues into ill-fitting roles; admins must share credentials to access "hidden" screens.

**Fix:** Replace with **RBAC-driven navigation**: each nav item declares `requiredPermission`; render if `actor.permissions.includes()`. The `PermissionName` vocabulary already exists in `types/auth.ts` — this is a wiring change, not a new system. Personas become **permission presets**, not hardcoded gates.

---

### 2.2 Offline Resilience — Partially Built, Not Wired Everywhere (High for POS)

> **CORRECTION (verified):** The original draft claimed "zero offline support" and
> proposed building a client command queue from scratch. That is inaccurate.
> `kernel/react/kernel-provider.tsx` **already implements** a durable offline
> command queue. The real gap is that most write paths don't go through it.

**What already exists (verified in `kernel/react/kernel-provider.tsx`, 346 lines):**
- **Durable queue**: `QUEUE_KEY = "pos.kernel.offlineQueue"` persisted to localStorage (`:43`, `:57-84`), defensively parsed (malformed entries dropped, storage failures degrade to empty queue)
- **Automatic replay**: flush every 5 s (`QUEUE_FLUSH_INTERVAL_MS`, `:44`, `:256-258`) with `requestId` idempotency keys (`crypto.randomUUID`, `:46-50`)
- **Safe retry semantics**: `isNetworkFailure()` replays only network-level failures (`TypeError`), never 4xx/5xx — so a rejected command can't be duplicated (`:86-91`)
- **Connection surfacing**: `type KernelConnection = "live" | "connecting" | "offline"` + `pendingCount` exposed to the UI (`:21`, `:38`, `:268`); `useProjection` returns `connection` so a board can show it's stale (`:345`)
- **Optimistic UI with rollback**: `useCommand().run(type, payload, { onOptimistic, onRollback, onSuccess })` (`:290-322`)

**What's actually missing:**
1. **Service worker / asset caching** — none (only commented-out registration code in a stale worktree's `layout.tsx`; nothing in `public/`, no Workbox)
2. **REST-context writes bypass the queue** — `OrderContext`, `MenuContext`, `CartContext` use raw `fetch`, so their writes are lost on network blips; only `TableContext` and the orders page (kernel-routed) get queued replay
3. **Cart has no server sync** — `CartContext.tsx:386` writes localStorage only; cart doesn't follow the device or survive storage clearing
4. **No conflict-resolution UI** for concurrent edits (table moves, order modifications)
5. Queue is localStorage, not IndexedDB — subject to ~5 MB quota and sync-storage eviction risk

**Revised fix:**
1. Add **service worker + Workbox** for asset caching (the genuinely missing piece)
2. **Route all writes through the existing queued kernel client** — migrate REST contexts to `useCommand` (this folds into Phase 1, not a new build)
3. Persist the queue to **IndexedDB** with localStorage fallback
4. Build **conflict-resolution UI** for concurrent edits
5. Surface `connection` + `pendingCount` in the header (data already available from `useKernel`)

---

### 2.3 Kitchen Display System (KDS) — Incomplete (High)

**Problem:** KDS exists (`/dashboard/kitchen/display`) but **lacks core expedition features**:
- No **course firing** (fire appetizers, then mains)
- No **hold/fire** workflow
- No **bump bar / hardware integration** (keyboard shortcuts only)
- No **ticket splitting/reprinting**
- No **allergic/special diet highlighting** (data exists in `OrderLine.modifiers` but not surfaced)
- No **prep time vs. actual tracking** with SLA alerts

**Evidence:** `components/kitchen/kitchen-order-queue.tsx` — basic list; `kitchen-performance-metrics.tsx` exists but no real-time SLA breach alerts.

---

### 2.4 Mobile/Handheld UX Missing (High)

**Problem:** No dedicated **handheld/server mode**. `components/layout/mobile-nav.tsx` exists but:
- No **order-at-table flow** (scan QR → open cart → add items → send)
- No **payment-at-table** (tip selection, split, receipt print)
- No **offline cart** for roaming servers
- Touch targets too small in many components (e.g., `table-card.tsx`)

**Fix:** Build a **separate handheld entry point** (`/handheld`) with:
- Large touch targets, bottom nav, gesture-friendly
- QR code table login (table ID embedded)
- Kernel-backed cart (draft order aggregate) with the existing offline queue
- Integrated payment (Stripe Terminal, Square, or cash)

---

### 2.5 Customer-Facing Experience Gaps (Medium)

**Problem:** `/customer/*` routes exist but feel like **afterthoughts**:
- **Menu** — no dietary filtering UI (data exists in `MenuItem.dietary`)
- **Loyalty** — points balance shown but no **reward redemption flow** (kernel has `customer.redeemReward` command; the REST loyalty routes at `app/api/customer/loyalty/*` use `prisma.loyaltyCustomer`, bypassing it)
- **Feedback** — submit works but no **follow-up loop** (manager response, resolution tracking)
- **Order tracking** — basic status only, no **live ETA**, no **kitchen progress visualization**

---

## 3. User Psychology & Behavior Patterns

### 3.1 Cognitive Load During Rush (Critical)

**Problem:** Dashboard and Orders screens **surface raw data**, not **actionable signals**:
- Dashboard shows "Pending Orders: 12" but not **"Table T4 waiting 71 min — anniversary, dessert held"**
- No **priority inbox** for manager: "3 tables > 20 min", "2 tickets over target", "Low stock: truffle"
- **Color coding inconsistent**: Red used for both "dirty table" and "cancelled order"

**Fix:**
- **Signal-first dashboard**: Each card = one decision (seat, fire, comp, reorder)
- **Time-aware indicators**: Tables auto-escalate color (green → amber → red) based on dwell time
- **Unified notification center** (exists: `NotificationCenter`) but **no priority tiers**, no **acknowledgment tracking**

---

### 3.2 Error Recovery UX Missing (High)

**Problem:** When kernel rejects a command (e.g., `MENU_ITEM_UNAVAILABLE`, `TABLE_NOT_AVAILABLE`), the **toast says "Table update rejected: Table is occupied"** — but **no guided recovery** (show available tables, suggest waitlist, offer split).

**Evidence:** `context/TableContext.tsx` — `notify("error", "Table update rejected", result.error?.message)` — generic.

**Fix:** Error payloads should include **recovery actions** (`{ code, message, suggestedActions: [{ label, commandType, payload }] }`); UI renders action buttons in toast. `useCommand` already returns the full `CommandResult`, so this is a payload-shape change plus a toast component change.

---

### 3.3 No Onboarding / Progressive Disclosure (Medium)

**Problem:** 11 modules, 50+ commands, complex permissions — **zero guided tour** for new staff. `TourProvider` exists (`app/layout.tsx:58`) but unused.

**Fix:** Implement **role-based onboarding flows** (waiter: "Take your first order"; kitchen: "Bump your first ticket"; manager: "Close the day").

---

## 4. Information Architecture

### 4.1 Dual Data Models: Kernel Events + Mutable Tables (Critical)

**Problem:** The schema (`db/schema.sql`) maintains **full mutable tables** (`Order`, `MenuItem`, `Table`, `Customer`, `Reservation`, `WaitlistEntry`, `Shift`, `Ingredient`, etc.) **alongside** the event store. This is **intentional for read performance** but creates **two sources of truth**.

**Impact:**
- **Drift risk**: A bug in projection rebuild = silent divergence
- **Migration complexity**: Schema changes need dual writes
- **No single "source of truth" for auditors**

**Fix:**
1. **Designate projections as canonical reads** — deprecate direct table reads
2. **Add projection health endpoint** (`/api/kernel?projection=orders.board&health=1`) comparing row counts
3. **Schedule nightly reconciliation job** that logs drift

### 4.2 Customer / Loyalty Split (High)

**Problem:** **Two customer tables**: `Customer` (operational, linked to orders) and `LoyaltyCustomer` (loyalty program). They **share email/phone but are not enforced** — seed shows `cust-01` ↔ `loy-01` but no FK, no sync.

**Evidence (verified):** `db/schema.sql:295-308` — two separate tables, indexes on each but **no FK between them**; loyalty routes (`app/api/customer/loyalty/*`) use `prisma.loyaltyCustomer` while customer routes (`app/api/customers/*`) use `prisma.customer`; `types/pos/customer.types.ts:170-172` even contains a commented-out note that `LoyaltyCustomer` "is largely covered by extending Customer."

**Impact:**
- Points can desync from visits
- Marketing can't segment by operational data (visit count, total spend)
- GDPR deletion requires touching two tables

**Fix:** Merge into **single `Customer` aggregate** with loyalty as embedded value object; project two views (operational board, loyalty board) from same events. The type layer already anticipates this.

---

### 4.3 No Versioned Menu / Time-Travel (Medium)

**Problem:** Menu changes (price, availability, 86) are **destructive updates** in mutable table. No history of "what was on the menu on 2025-12-24". Kernel events exist (`menu.priceChanged`, `menu.eightySixed`) but **no temporal query**.

**Fix:** Add `list.menu.atDate` query handler reading from `menu.board` projection at a past position (event store supports `fromGlobalPosition`).

---

## 5. Technical Design Decisions

### 5.1 Event Store: Well-Designed but PostgreSQL-Coupled (Medium)

**Strengths:**
- **Single-statement append** with optimistic concurrency (CTE guard + UNIQUE constraint)
- **Hot/cold archiving** via `ros_events_archive` (atomic MOVE)
- **Upcasters** for schema evolution (`versioned-store.ts`)
- **Snapshots** with configurable policy
- **Production-safe store selection** — `kernel/index.ts:29` forces `PostgresEventStore` whenever `NODE_ENV === "production"` (verified; see Appendix C)

**Gaps:**
- **No read replicas / follower support** — all reads hit primary
- **No subscription / catch-up subscription** for external consumers (only in-process listeners)
- **No event linking / correlation IDs** across aggregates (e.g., `order.created` + `reservation.seated` for same table)
- **Compaction scheduler** exists but **no monitoring/alerting** on lag

---

### 5.2 Command/Query Buses: Solid but Missing Observability (Medium)

**Strengths:**
- Policies as cross-module guards (`noSoldItems86dPolicy`)
- Hook bus for `command:before/after/failed`
- Structured `CommandResult` with `KernelError` codes

**Gaps:**
- **No distributed tracing** (no `traceId` propagation)
- **No command latency histograms** / p99 metrics
- **No dead letter queue** for failed commands (they just return error)
- **No idempotency key enforcement** at bus level (left to handlers; the client does supply `requestId`s)

---

### 5.3 Aggregate Design: Good but Inconsistent Validation (Medium)

**Strengths:**
- `OrderAggregate` — rich invariants (discount ≤ balance, tip ≤ balance, transfer idempotency)
- `MenuItemAggregate` — `sellable()` guard used by policy

**Gaps:**
- `CustomerAggregate` — **no validation on email/phone format**, no uniqueness enforcement (relies on DB unique index)
- `ReservationAggregate` — **no party size vs. table capacity check** (only double-booking guard)
- `WaitlistAggregate` — **no max party size**, no auto-no-show timeout

---

### 5.4 Projection Rebuild Performance (Medium)

**Problem:** `kernel.boot()` calls `projections.rebuildAll()` **sequentially** on every cold start. With 8 projections and growing event log, this adds **seconds to cold boot**.

**Fix:**
- **Parallel rebuild** with concurrency limit
- **Checkpoint positions** persisted; resume from last position
- **Lazy projection boot** — only rebuild projections actually queried

---

## 6. Performance

### 6.1 Frontend Bundle Size (High)

**Problem:** **All Radix UI primitives imported** — **27** `@radix-ui/react-*` packages in `package.json` (verified). No tree-shaking analysis. `components/ui/*` re-exports everything.

**Fix:**
- Audit actual usage; remove unused
- Use `lucide-react` tree-shaking (already good)
- Consider **Radix UI v2** (modular) or **Ark UI** (smaller)

---

### 6.2 No Query Optimization for Large Venues (Medium)

**Problem:** Projections return **full arrays** (`rows: OrderBoardRow[]`). No pagination, no cursor, no server-side filtering for `list.orders` queries. Same for `list.staffing.board` (all shifts).

**Fix:** Add `limit/offset` or **cursor-based pagination** to query handlers; projections maintain **indexed views** (e.g., `byStatus`, `byDate`).

---

### 6.3 Socket Bridge: No Backpressure / Batch Emit (Low)

**Problem:** `SocketBridge.handle(event)` emits **per-event**. Under load (100+ orders/min), this floods WebSocket.

**Fix:** Batch emits per tick (e.g., 50ms window); add `maxBatchSize`; client merges.

---

## 7. Security

### 7.1 Authentication: JWT in localStorage (Critical)

**Problem:** **JWT stored in localStorage** (`context/AuthContext.tsx:225` — verified) — **vulnerable to XSS**. No `HttpOnly` cookie for access token (only `posToken` cookie set on login, but **not used for API auth** — `Authorization: Bearer` header reads from localStorage, e.g., `context/OrderContext.tsx:319`).

**Fix:**
1. **Short-lived access tokens** (15 min) in memory only
2. **Refresh token in HttpOnly Secure SameSite=Strict cookie**
3. **Rotate refresh tokens** on use
4. **CSP headers** to mitigate XSS

---

### 7.2 Rate Limiting: In-Memory Only (High)

**Problem:** Login rate limiter (`app/api/auth/login/route.ts:35` — verified: `const attempts = new Map<...>()`, 8 attempts / 15 min fixed window keyed by IP + email) is **in-process** — **useless in multi-instance deployments** (Vercel, Kubernetes, etc.). The code comment acknowledges this: *"a multi-instance deployment should front this with a shared store."*

**Fix:** Use **Redis-backed rate limiter** (Upstash, Vercel KV, or self-hosted) with sliding window.

---

### 7.3 API Key Auth: No Scoping / Rotation (Medium)

**Problem:** `/api/v1/*` uses `ROS_PUBLIC_API_KEYS` env var — **single key, no scopes, no rotation, no expiry**.

**Fix:**
- Key store in DB with `scopes: string[]`, `expiresAt`, `lastUsedAt`
- Issue scoped keys per integration (webhook, mobile app, kiosk)
- Audit log on key usage

---

### 7.4 No Input Sanitization on Commands (Medium)

**Problem:** Command payloads (`AttributeBag = Record<string, unknown>`) **passed directly to aggregates** — relies on aggregate validation. No **schema validation at bus level** (Zod schemas exist for REST but not kernel commands).

**Fix:** Attach **Zod schema to each command handler**; validate at `CommandBus.dispatch` before policy checks.

---

### 7.5 PII in Projections (Medium)

**Problem:** `customers.board` projection **excludes email/phone** (good), but `reservations.board` includes `customerName`, `phone`, `email` — readable by `reservation:view` (host, manager). No **field-level ACL**.

**Fix:** Projection ACL should support **column masking** based on permission tier.

---

## 8. Accessibility

### 8.1 Partial but Inconsistent (Medium)

**Strengths:** Radix UI primitives provide **ARIA basics** (dialogs, menus, tooltips).

**Gaps:**
- **No focus management** on route transitions (Next.js App Router doesn't auto-focus)
- **No skip links** in layout
- **Color contrast** — custom CSS variables (`pos-` classes) not audited
- **Keyboard shortcuts** (`Ctrl+K` command palette) but **no help overlay** showing all shortcuts
- **Screen reader announcements** for live regions (kitchen ticket updates, table status changes) — missing

---

## 9. Product Positioning & Differentiation

### 9.1 Strongest Differentiators (Amplify These)

| Differentiator | Current State | Amplification Path |
|---|---|---|
| **Event-sourced kernel with cross-module policies** | Unique in POS space; `noSoldItems86dPolicy` is flagship | **Market as "POS that prevents mistakes"** — demo: try to order 86'd item, show rejection |
| **Platform/order injection** (`platform.ingestOrder`) | Marketplace orders (UberEats, DoorDash) flow through same kernel as POS orders | **Build certified connectors** for top 5 delivery platforms; sell as "unified order stream" |
| **Projection-based real-time boards** | Kitchen, tables, waitlist, staff all reactive | **Add "live dashboard" embed** for owner's phone/TV |
| **Modular module system** | Install/activate/deactivate at runtime | **Marketplace for modules** (loyalty, gift cards, accounting connectors) |
| **Idempotent platform ingest** | Deterministic `platformOrderId` = dedupe key | **SLA guarantee**: "Never double-charge a marketplace order" |

---

### 9.2 Weak/Redundant Elements (Remove or Rebuild)

| Element | Why Weak | Action |
|---|---|---|
| **Legacy REST API** (`/api/orders`, `/api/menu`, etc.) | Bypasses kernel; dual write path | **Delete** — migrate all callers to kernel |
| **`CartContext` (localStorage-only)** | No kernel integration; no server sync | **Rebuild** as kernel-backed cart (draft order aggregate) |
| **`AuthContext` (JWT + localStorage)** | XSS risk; no kernel auth commands | **Replace** with kernel `auth.*` commands + HttpOnly cookies |
| **`Persona` hardcoding** | Inflexible; doesn't match real orgs | **Replace** with RBAC-driven nav |
| ~~**`AnalyticsContext`, `InventoryContext`, `DragDropContext`**~~ | ~~Mounted but never implemented~~ — **CORRECTION**: all three **are fully implemented** (`AnalyticsContext.tsx:32`, `InventoryContext.tsx:102`, `DragDropContext.tsx:42`) and were mounted at `layout.tsx:69-71` precisely because their **absence** previously broke the production build (see comment at `layout.tsx:20-22`) | **Do NOT remove.** Removing them re-breaks consumers and the prerender build. They remain legacy-REST-backed (a Phase 1 migration target), but the mounts are correct |
| **`Customer` / `LoyaltyCustomer` split** | Data duplication; sync issues | **Merge** into single aggregate |

---

### 9.3 Missing High-Impact Features (Build These)

| Feature | Kernel Support | UI Effort | Business Value |
|---|---|---|---|
| **Handheld server app** | ✅ Commands exist | High | **Revenue**: Faster table turns, higher tips |
| **Kitchen course firing / hold-fire** | ✅ `order.fireCourse`, line status | Medium | **Operations**: Reduces ticket times, errors |
| **Automated waitlist SMS/Email** | ✅ `waitlist.notify` event | Low | **Guest experience**: Reduces walkaways |
| **Loyalty redemption at POS** | ✅ `customer.redeemReward` | Low | **Retention**: Increases repeat visits |
| **End-of-day closeout wizard** | ✅ `sales.board` projection | Medium | **Compliance**: Eliminates manual reconciliation |
| **Multi-venue dashboard** | ✅ `tenant.zoneId` | Medium | **Expansion**: Enables multi-location sales |
| **Gift card sell/redeem** | ❌ Types only | Medium | **Revenue**: High-margin product |
| **Inventory → Menu 86 auto-sync** | ❌ No inventory module (but `inventoryBoardProjection` exists) | High | **Operations**: Prevents selling out-of-stock |

---

## 10. Professional Documentation

### 10.1 Missing Documentation (Critical for Adoption)

| Missing Doc | Audience | Priority |
|---|---|---|
| **Architecture Decision Records (ADRs)** | Engineers | High |
| **Kernel API Reference** (commands, queries, projections, events) | Integrators | High |
| **Module Development Guide** | Plugin authors | Medium |
| **Deployment / Operations Runbook** | DevOps | High |
| **Security Hardening Guide** | Security team | High |
| **Accessibility Conformance Report** | Compliance | Medium |
| **Data Model Dictionary** (events, projections, tables) | All | High |
| **Persona/Permission Matrix** | Product/Ops | Medium |

**Current state:** `kernel/README.md` (detailed, with migration guidance and phase roadmap) plus excellent inline code comments and `db/schema.sql` header. No generated SDK docs published (`generate-sdk.ts` exists but output not shipped).

---

## 11. Prioritized Improvement Roadmap

### Phase 0: Stabilize (Week 1-2) — REVISED

1. **Add CSP headers** + move JWT to memory + HttpOnly refresh cookie (`context/AuthContext.tsx:225`)
2. **Redis-backed rate limiter** for auth endpoints (`app/api/auth/login/route.ts:35`)
3. **Add service worker + Workbox** for offline asset caching (the only genuinely missing offline primitive)
4. **Surface `connection`/`pendingCount` from `useKernel()` in the app header** so stale boards are visible to staff

**Removed from the original Phase 0:**
- ~~"Enforce Postgres event store in prod — fail boot if `ROS_USE_PG !== '1'`"~~ — unnecessary: `kernel/index.ts:29` already returns `PostgresEventStore` whenever `NODE_ENV === "production"`, independent of `ROS_USE_PG` (Appendix C)
- ~~"Remove unused context mounts — AnalyticsProvider, InventoryProvider, DragDropProvider"~~ — **actively harmful**: all three are implemented and mounted; their absence is what previously broke the production build (Appendix A)

---

### Phase 1: Unify Write Path (Week 3-6)
1. **Delete legacy write endpoints** (`/api/orders` POST/PATCH/DELETE, `/api/menu` POST/PATCH/DELETE, `/api/tables` POST/PATCH/DELETE, `/api/reservations` POST/PATCH/DELETE, `/api/waitlist` POST/PATCH/DELETE, `/api/inventory` POST/PATCH/DELETE, `/api/customers` POST/PATCH/DELETE)
2. **Migrate `OrderContext`, `MenuContext`, `AuthContext`** to `useCommand`/`useProjection` — reference implementations already exist (`TableContext`, `app/dashboard/orders/page.tsx`)
3. **Rebuild `CartContext`** as draft `OrderAggregate` (kernel command `order.create` + `order.addLine`) — this automatically brings the cart under the existing offline queue
4. **Add command validation schemas** (Zod) at bus level

### Phase 2: Resilient UX (Week 7-10) — REVISED
1. ~~"Client command queue (IndexedDB) with replay on reconnect"~~ → **Move the existing kernel offline queue from localStorage to IndexedDB** with a localStorage fallback (replay, idempotency, and network-failure-only retry semantics already work — see §2.2)
2. **Handheld entry point** (`/handheld`) with QR table login
3. **KDS course firing + hold/fire + bump bar shortcuts**
4. **Conflict-resolution UI** for concurrent edits
5. ~~"Service worker"~~ — moved to Phase 0 (it's a stabilization item, not a feature)

### Phase 3: Intelligence & Scale (Week 11-16)
1. **RBAC-driven navigation** (replace hardcoded personas; the `PermissionName` vocabulary already exists in `types/auth.ts:3-48`)
2. **Signal-first dashboard** (priority inbox, time-aware escalation)
3. **Multi-venue dashboard** (zone-aware projections)
4. **Gift card module** (sell, redeem, balance check)
5. **Inventory module** (stock events → auto-86 menu items; `inventoryBoardProjection` already exists)
6. **Accounting connector** (daily journal export, period close)

### Phase 4: Platform & Ecosystem (Week 17+)
1. **Publish generated SDK** (`npm publish @ros/kernel-sdk`)
2. **Module marketplace** (installable via UI)
3. **Certified delivery connectors** (UberEats, DoorDash, Grubhub)
4. **Public API docs** (OpenAPI from `generate-sdk.ts`)
5. **ADR repository** + architecture diagrams

---

## 12. Specific Code-Level Findings (verified)

| File | Line | Issue | Severity |
|---|---|---|---|
| `context/AuthContext.tsx` | 225 | JWT in **localStorage** (`posToken`) — XSS vulnerable | Critical |
| `context/OrderContext.tsx` | 317, 373 | **REST API calls** — bypass kernel | Critical |
| `context/MenuContext.tsx` | 145, 235 | **REST API calls** — bypass kernel | Critical |
| `app/api/auth/login/route.ts` | 35 | **In-process `Map` rate limiter** — fails in multi-instance | High |
| `context/CartContext.tsx` | 386 | **No server sync** — cart lost on device change | High |
| `components/dashboard/dashboard-nav.tsx` | 32 | **Hardcoded persona nav** — `PermissionName` RBAC exists but unused | High |
| `db/schema.sql` | 295-308 | **Duplicate customer tables** — `Customer` + `LoyaltyCustomer`, no FK | High |
| `lib/personas.ts` | 19-85 | **5 hardcoded roles**, no composite roles, no venue overrides | Medium |
| `kernel/event-store/postgres-event-store.ts` | 113 | **No query timeout** on `db.unsafe` — can hang | Medium |
| `kernel/index.ts` | 29-32 | ~~Falls back to InMemoryEventStore silently in prod~~ — **CORRECTED**: production **does** force Postgres (`NODE_ENV === "production"`); the in-memory fallback is dev-only when `ROS_USE_PG !== "1"` | ~~Critical~~ → Informational |

**Corrected / retracted rows:**
- ~~`app/layout.tsx:20-25` — "Three providers mounted but never implemented — Critical"~~ → **Retracted.** The comment at `layout.tsx:20-22` says they were *"fully implemented and consumed... but never mounted"*, and the missing mount is what *"broke the production build during prerender."* All three export real providers (`AnalyticsContext.tsx:32`, `InventoryContext.tsx:102`, `DragDropContext.tsx:42`) and are correctly mounted at `layout.tsx:69-71`.

---

## Conclusion

**This is a genuinely impressive kernel** — one of the cleanest event-sourced POS architectures. The domain modeling, cross-module policies, projection design, and module system are **production-grade**.

**The gap is the frontend integration layer.** The team built a Ferrari engine (kernel) but connected it to a bicycle drivetrain (React contexts + REST). **Migrating the last 30% of write paths to the kernel** will unlock the full value: consistent state, audit trails, cross-module guards, real-time projections, and a platform ready for marketplace integrations.

**Recommended first step:** Delete one legacy write endpoint (e.g., `/api/menu` POST) and migrate `MenuContext` to the `menu.createItem` command. Use that as the pattern for the rest.

**One caveat the original draft overstated:** offline resilience is not "zero" — the kernel client already ships a durable, idempotent, auto-replaying command queue with connection telemetry. The work is *routing every write through it*, not building one.

---

## Appendix: Verification & Corrections

All claims below were re-checked against source on 2026-09-30. Three material corrections were applied to the original draft; minor line-reference fixes are listed afterward.

### Appendix A — Correction 1: the three layout providers (retracted)

**Original claim (§12, §9.2, Phase 0 item 2):** *"`app/layout.tsx:20-25` — Three providers mounted but never implemented — breaks production build if they throw (Critical). Remove mounts until implemented."*

**Verified reality:** The claim inverted the code comment it cited.

```tsx
// app/layout.tsx:20-22
// These three were fully implemented and consumed across /dashboard, but never
// mounted, so every consumer threw at runtime. AnalyticsProvider's missing mount
// is what actually broke the production build during prerender.
```

- `context/AnalyticsContext.tsx:32` — `export function AnalyticsProvider(...)` ✅ implemented
- `context/InventoryContext.tsx:102` — `export function InventoryProvider(...)` ✅ implemented
- `context/DragDropContext.tsx:42` — `export function DragDropProvider(...)` ✅ implemented
- Mounted at `app/layout.tsx:69-71` ✅

**Why the original recommendation was dangerous:** the missing mounts were a historical *bug* that broke prerender; they were fixed by mounting. Following Phase 0 item 2 ("remove unused context mounts") would revert that fix and re-break the production build.

**Applied changes:** §9.2 row struck and replaced with "Do NOT remove"; §12 row retracted; Phase 0 item 2 removed. The three contexts are still correctly listed as legacy-REST-backed migration targets for Phase 1.

---

### Appendix B — Correction 2: event store fallback in production (retracted)

**Original claim (§12, Phase 0 item 1):** *"`kernel/index.ts:29-32` — Falls back to InMemoryEventStore silently in prod if env var missing (Critical). Enforce Postgres in prod — fail boot if `ROS_USE_PG !== '1'`."*

**Verified reality:**

```ts
// kernel/index.ts:28-33
export function createEventStore(): KernelConfig["store"] {
  if (process.env.NODE_ENV === "production" || process.env.ROS_USE_PG === "1") {
    return new PostgresEventStore(sql as never)
  }
  return new InMemoryEventStore()
}
```

`NODE_ENV === "production"` alone selects the Postgres store; `ROS_USE_PG` is only relevant in development. There is no production path to the in-memory store, so "fail boot if `ROS_USE_PG !== '1'` in production" would add a check that is redundant under a normal production deployment.

**Residual risk (narrower than the original claim):** a deployment that runs with a non-`production` `NODE_ENV` (misconfigured container, test harness pointed at prod data) would silently get the in-memory store. If you want a guard, gate on *intent* (e.g., fail when `ROS_REQUIRE_PG=1` and the store isn't Postgres) rather than the env var the original draft named.

**Applied changes:** §5.1 strengths now note the production-safe selection; §12 row downgraded from Critical to Informational with corrected wording; Phase 0 item 1 removed.

---

### Appendix C — Correction 3: offline support ("zero" → partially built)

**Original claim (§2.2, Phase 2 item 1):** *"Zero offline support... no sync queue, no background replay when connectivity returns... Implement client command queue (persist to IndexedDB, replay on reconnect with idempotency keys)."*

**Verified reality:** `kernel/react/kernel-provider.tsx` (the file the original draft failed to read due to a malformed path — correct path has no trailing backtick) already implements exactly that queue:

| Capability | Location | Status |
|---|---|---|
| Durable queue in localStorage (`pos.kernel.offlineQueue`) | `:43`, `:57-84` | ✅ exists |
| Background replay (5 s flush interval) | `:44`, `:256-258` | ✅ exists |
| Idempotency keys (`requestId`, `crypto.randomUUID`) | `:46-50` | ✅ exists |
| Retry only network failures, never 4xx/5xx | `:86-91` | ✅ exists |
| `connection` + `pendingCount` surfaced to UI | `:21`, `:38`, `:345` | ✅ exists |
| Optimistic update + rollback API | `:290-322` | ✅ exists |
| Mounted app-wide | `app/layout.tsx:59` | ✅ exists |

**What is genuinely missing:** a service worker for asset caching (nothing in `public/`; only commented-out code in a stale worktree), routing of REST-context writes through the queue (they use raw `fetch`), cart server sync, conflict-resolution UI, and IndexedDB storage (current queue is localStorage).

**Applied changes:** §2.2 rewritten as "Partially Built, Not Wired Everywhere" with an explicit exists/missing split; Phase 2 item 1 reframed as "move existing queue to IndexedDB"; service worker moved to Phase 0; §5.2 and Conclusion updated to acknowledge client-supplied `requestId`s.

---

### Minor line-reference fixes applied

| Original | Corrected | Note |
|---|---|---|
| "hardcodes 6 roles" (`lib/personas.ts`) | **5 roles** | `types/auth.ts:1` — `admin \| manager \| staff \| kitchen \| waiter` |
| `AuthContext.tsx:190, 224` | `AuthContext.tsx:225` | `localStorage.setItem("posToken", ...)` |
| `db/schema.sql:275-306` | `db/schema.sql:295-308` | `Customer` / `LoyaltyCustomer` tables |
| "@radix-ui/react-* × 26 packages" | **27** | Counted in `package.json` |
| `kernel/react/kernel-provider` (path failed) | `kernel/react/kernel-provider.tsx` | Original read failed due to stray backtick in path |
| `TableContext.tsx:64` error toast | Kept as verified pattern | Exact line not re-verified; claim (generic error toast) confirmed present in `TableContext` |








