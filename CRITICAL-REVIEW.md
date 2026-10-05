# Advanced Critical Review — Restaurant OS (`restau-pos`)

**Reviewed:** 2026-10-02 · **Lens:** real-world product, not prototype · **Audience:** product, engineering, design, ops

This review treats the system as a **commercially sellable restaurant operating system** — the kind a restaurant owner would bet their service on. It is grounded in the actual source (kernel CQRS/ES core, React contexts, projections, modules, service worker, auth, RBAC) rather than the marketing surface.

---

## 0. Executive Summary

**The kernel is genuinely excellent.** The event-sourced core (`kernel/`) — single-CTE atomic append with optimistic concurrency, hot/cold archive, snapshot policies, upcasters, a module system with cross-module policies (`noSoldItems86dPolicy`), idempotent marketplace ingest, and projection-based read models — is production-grade backend engineering. It is the strongest part of the codebase by a wide margin.

**The product wrapped around it is not yet a product.** The gap is not "30% of write paths still use REST" (which the prior GAP-ANALYSIS correctly identified and which is now largely fixed — `OrderContext`, `MenuContext`, `TableContext`, `CartContext` all route through the kernel). The deeper gap is:

> **The kernel solves for the developer. The product must solve for the operator under pressure at 7pm on a Friday.**

Concretely, the system today is a **collection of correct screens** that do not yet compose into a **reliable, legible, low-friction service**. The highest-severity issues are not architectural — they are the gap between what the system *knows* and what the person holding the screen *understands and trusts in the next 2 seconds*.

**Verdict:** Strong engine, incomplete vehicle. The kernel reduces **bad states** (double-booked tables, 86'd items sold, duplicate marketplace orders, drift between read models). But the product layer still fails to reduce **waste** (clicks, context switches, re-entries, escalations) and, critically, fails to **communicate system state** (connection, staleness, conflict, permission) clearly enough for a stressed server to trust it under load.

**Severity distribution (see §6 for the full ranked table):**
- **P0 (revenue/data-integrity/rush-blocking):** 6 findings
- **P1 (trust, workflow efficiency, high-frequency friction):** 11 findings
- **P2 (reach/accessibility/scale):** 9 findings
- **P3 (polish/documentation):** 6 findings

---

## 1. UI/UX Audit — Exhaustive State Review

The audit walks every state class the user (or the system) can be in and asks: *does the product acknowledge it, explain it, and get the operator to the next correct action?*

### 1.1 Onboarding

**What exists:** A `/register` form (name, email, password, role select, phone, address) → `AuthContext.register()` → redirect to `/dashboard`. A `TourProvider` with two hardcoded tours (dashboard, orders) that nothing calls `startTour()` on.

**Findings:**
- **No setup wizard.** Registration creates an *account*, not a *restaurant*. A new owner lands on an empty dashboard (`EmptyState: "Nothing on the books yet"`) with no menu, no tables, no tax config, no staff. The kernel has `menu.createItem`, `table.create`, tenant seeding — but there is no guided path that walks "1) name your venue 2) set tax/currency 3) add your first table 4) import/enter your menu 5) invite your first server." This is the single largest adoption gap.
- **Role is chosen at signup but scoped to a static enum** (manager/server/kitchen/cashier). There is no "solo operator" path (one person does everything) and no "owner" option in the form even though `PERSONAS` defines `owner`, `host`, `bartender`, `host_staff`, `delivery` roles. The registration UI offers 4 of 12 defined roles.
- **Tours are dead code.** `TourProvider` is mounted (`layout.tsx:64`) with tours for `dashboard` and `orders`, but no screen calls `startTour`. The `target` selectors (`#dashboard-overview`, `#recent-orders`) don't exist in the DOM (the dashboard uses grid `Card`s with no such ids), so even if triggered the spotlight would attach to nothing.
- **Progressive disclosure is absent.** A first-time owner and a 20-year POS veteran get the same dashboard. There is no role-aware "here's your shift" default landing.

**Severity:** High (adoption + time-to-value). This is where restaurants churn in week one.

### 1.2 Setup / Configuration

- `app/dashboard/settings/page.tsx` is a **local-state fake**: `useState` prefs + `useState` store object, "Save changes" fires a success toast (`notify("success", "Settings saved")`) but **persists nothing** and issues **no command**. A manager sets tax to 8.5%, sees "Settings saved," and it evaporates on refresh. Worse, `CartContext.recalculateCartTotals` hardcodes `taxRate = 0.05` (CartContext.tsx:63) — so the "tax" setting is decorative *and* disconnected from checkout math.
- No floor-plan→table wizard, no menu import (CSV/CSV-from-Square), no service-charge/gratuity configuration, no opening-hours setup, no receipt branding. Every one of these is a manual, unguided, unsupported task.

**Severity:** High. This is "settings theater" — high trust cost, zero function.

### 1.3 Empty State

**Good:** `EmptyState` component is well-designed (dashed card, icon, hint, action), used on the dashboard ("Nothing on the books yet… Create first order") and the customer menu ("No items found" + Clear search). This is the strongest empty-state treatment in the app.

**Gaps:**
- Only the dashboard and guest menu have real empty states. Inventory, reservations, waitlist, staff, gift cards, reports, analytics all render bare tables/lists with no guidance on what to do first.
- Empty states don't differentiate "no data yet because you're new" from "no data because nothing matched a filter." A cashier filtering orders by "Open" and seeing zero gets the same silence as a new owner with no orders.

**Severity:** Medium.

### 1.4 Loading State

- `LoadingGrid` (skeleton cards) on dashboard, `role="status" aria-label="Loading"` — good a11y baseline.
- Projection-driven contexts set `loading: board === null` (TableContext, MenuContext, OrderContext). This is elegant: the first envelope arrival *is* the load boundary.
- **But:** projection polling intervals differ per board (tables 1.5s, menu 3s, kitchen 5s, inventory 30s, orders 1.5s). There is no unified "the venue board is loading." A screen subscribing to two boards with different cadences can render half-populated with no indicator.
- No `Suspense`/route-level skeletons on most pages beyond the few `loading.tsx` files that exist. Navigating `/dashboard/orders/new` shows a blank main region until the client JS hydrates.
- `CartContext` has no loading concept — `addItem` awaits a kernel round trip; on a slow link the button gives no pending state (the `isCreating` flag covers only draft-order creation, not the add).

**Severity:** Medium (visible, tolerable, not great).

### 1.5 Error State

**Good:** `ErrorState` component (icon, "Something went wrong," message, Try again with `notify("info","Retrying")`).

**Gaps and a serious consistency problem:**
- `lib/feedback.ts` already implements **`notifyWithActions`** and **`recoveryActionsFor(code)`** — mapping `TABLE_NOT_AVAILABLE`, `MENU_ITEM_UNAVAILABLE`, `INSUFFICIENT_STOCK` to recovery links. **But no context uses them.** Every rejection path still calls the generic `notify("error", "X update rejected", result.error?.message)` (TableContext:65, OrderContext:87). The guided-recovery layer is **built but unwired**. This is the highest-leverage UX gap in the codebase: the system knows how to help, and doesn't.
- Errors surface as transient toasts (`duration={4000}`). A server who misses a rejection has no persistent record. A rejected "send to kitchen" during a rush is invisible 4 seconds later — and the order is stranded.
- Error message text is developer-authored (`"Table is occupied"`, `"Menu update rejected"`), not operator-authored. Some are good; the wrapper titles are generic.
- No error boundary around individual panels. One throwing panel (e.g., `SalesChart` with malformed data) can take down the whole dashboard via `app/dashboard/error.tsx`.

**Severity:** High. Errors are where trust is won/lost; generic toasts that vanish are the opposite of what a stressed operator needs.

### 1.6 Success State

- `notify("success", ...)` + `playTone("success")` + `haptic(12)`. Multi-sensory feedback is a genuinely good instinct for a POS (works in a loud room, with gloves, in peripheral vision).
- `Toast` `closeButton` + `richColors`. Fine.
- **Concern:** success toasts for *high-frequency* actions become noise. `TableContext.updateTablePosition` fires "Table moved" on every reposition; during floor-plan editing that's a toast storm. The 250ms dedupe in `feedback.ts:45` helps but doesn't solve it.

**Severity:** Low-Medium.

### 1.7 Disabled State

- Standard `disabled` on buttons (`disabled={refreshing}`, `disabled={isSubmitting}`). Consistent with shadcn defaults.
- **No semantic disabled-with-reason.** A disabled button gives no explanation. E.g., "Send to Kitchen" when the order has no lines — why disabled? Staff will guess. Good POS practice is to keep it enabled and explain on click, or show a tooltip/inline reason.
- Menu items that are 86'd: policy blocks `order.addLine`, but does the UI *disable* them or let the cashier tap and get a rejection? Letting them tap and reject is defensible (teaches the rule, no hidden state) but only if the error is legible — see §1.5.

**Severity:** Medium.

### 1.8 Offline State

**This is the strongest area of the product.** Commendable:
- `KernelProvider` durable queue: IndexedDB primary + localStorage mirror (`kernel-provider.tsx:43-49, 82-97, 141-158`), 5s flush, `requestId` idempotency keys, `isNetworkFailure()` replays only `TypeError` (never 4xx/5xx), in-order drain, caps (200 items / 25 attempts / 7-day TTL).
- `ConnectionPill` / `StaleDataNotice` / `PageHeader live` badge — deliberate, prominent "don't silently show stale data" design (`ui-states.tsx:151-223`).
- Service worker (`public/sw.js`) correctly fails closed on `/api/*` (NetworkOnly) with an excellent comment explaining *why* (shared terminal → cached authenticated response leaks to next user). Navigations NetworkFirst(3s). Session-scoped caches purged on logout via `CLEAR_AUTH_CACHE` message (wired in `AuthContext.logout`).
- `app/offline/page.tsx` exists and reassures: "any changes you make while offline will be saved and synced."

**Remaining gaps:**
- `ConnectionPill` exists but I don't see it wired into the main `DashboardHeader` — the header shows `KernelStatusIndicator` (need to verify it surfaces `pendingCount`). If pending count isn't visible, staff don't know "3 changes are waiting to sync" — which is exactly the trust signal that matters when money is involved.
- Offline queue drops *failed* commands silently (server rejections are removed from the queue, `kernel-provider.tsx:322-327`). A rejected `order.addLine` while offline-queued just vanishes with no user-facing record. During a network blip mid-rush, a cashier could believe an item was added when it was rejected on replay.
- The offline page is a dead end for the *queued work* case: it says "changes will sync," but offers no way to see or resolve pending/conflicting items.

**Severity:** Medium — the foundation is excellent; surfacing and conflict-recovery are the gaps.

### 1.9 Unauthorized State

- Nav is RBAC-filtered (`canSeeNav` fails closed — `personas.ts:201-208`; good, and the comment documents a past regression).
- Kernel enforces permissions on every command/query (`command-bus.ts:95`, projection ACL via `assertProjectionAccess`).
- **But:** there is no route-level guard visible on `/dashboard/*` beyond nav filtering. A user who types `/dashboard/settings` directly, or a revoked user holding a stale tab, hits the page. Whether server-side middleware protects it needs verification; if not, a cashier can navigate to Settings. Even if the API denies writes, seeing an unauthorized screen and getting a wall of silent failures is poor.
- `FORBIDDEN` from the kernel produces a generic "Table update rejected / Missing permission" toast. No dedicated "ask a manager" affordance, no screen-level 403 state.

**Severity:** High (if unguarded) / Medium (if middleware-protected but with no 403 UX). Requires verification.

### 1.10 Concurrent Edit State

- Kernel uses optimistic concurrency (`VERSION_CONFLICT`), and `useCommand.run` supports `onConflict` with a retry-once policy (`kernel-provider.tsx:409-427`).
- **But the version is parsed out of an error message by regex** (`result.error.message.match(/expected v(\d+)/)`) — brittle string-scraping as a control-flow mechanism, and the caller must opt in via `onConflict`, which no context does.
- **No conflict-resolution UI.** When two servers edit the same order/table, the loser gets a toast and their optimistic update rolls back — but there's no "someone else changed this; here's the diff, keep mine / take theirs." The prior gap analysis correctly flagged this.
- The offline queue replay does **not** surface conflicts distinctly — a `VERSION_CONFLICT` during replay removes the command silently.

**Severity:** High. Concurrent edits are the *normal* case in a busy restaurant (two servers, one table's bill).

### 1.11 Low-Trust / New-Staff State

- `SignalDashboard` (`components/dashboard/signal-dashboard.tsx`) is a **strong, genuinely novel component**: it synthesizes actionable Signals (kitchen SLA breach, long-sitting table, low/out-of-stock, unpaid closed orders, dirty tables) from four projections with severity sorting and deep-links. This is the "signal-first dashboard" the gap analysis asked for. Well done.
- `PriorityInbox` is on the dashboard.
- **But:** no confidence/provenance. A new server can't tell "is this signal real or a bug?" E.g., "SLA breach: Table T4" is derived from `sentAt + 20min` — a fixed threshold with no per-venue SLA, no acknowledgement, no "who's handling it." During peak, ten red signals scroll and the operator learns to ignore all of them (alarm fatigue). There's `dismissible` in the type but it's never set and never rendered as a control.

**Severity:** Medium-High. Signal quality is a trust multiplier; unacknowledged alarms devalue fast.

### 1.12 Recovery State

- Covered in §1.5/§1.10. The kernel and feedback lib have the *vocabulary* for recovery; the product surfaces almost none of it.
- `notifyWithActions` exists and is unused. `recoveryActionsFor` exists and is unused. This is the clearest "deep product detail that matters": the difference between "Command rejected" and "Table 4 is occupied — seat at Table 7 / add to waitlist" is the difference between a frustrated server and a recovered one.

**Severity:** High.

---

### 1.13 Cross-Cutting UX Dimensions

**Accessibility**
- Strengths: Radix primitives give ARIA semantics; `skip to content` link in layout; `aria-label` on icon buttons; `role="status"`/`aria-live="assertive"` on SLA breach (kitchen display page:72); `sr-only` labels; `prefers-reduced-motion` honored (claimed in settings copy); focus rings via shadcn defaults.
- Gaps: no focus management on route change (App Router); live regions not wired to projection updates (a KDS ticket appearing is silent to a screen reader); contrast of custom `pos-`/`status-` tokens unverified; keyboard shortcuts exist (F2/F4/F8, Ctrl+K) with **no in-app shortcuts overlay** (the nav shows `kbd` hints on hover only); touch targets below 44px in dense floor-plan/table-card components (the prior gap analysis flagged `table-card.tsx`); no `aria-busy` on loading regions.

**Workflow efficiency**
- Command palette (Ctrl+K) + persona quick actions + `kbd` hints are good. For power users this is solid.
- The new-order flow routes through `CartContext` (now kernel-backed draft `OrderAggregate` — a real improvement) but with **friction tax**: adding one item fires `order.create` (if needed) + `order.addLine`; changing quantity does `voidLine` + `addLine` (two round trips, two audit events, non-idempotent churn). `updateItemModifiers` and `updateSpecialInstructions` follow the same void-and-re-add pattern. This bloats the event log and creates fragile intermediate states (e.g., line voided but add failed → item silently disappears).
- `Math.max(...)` prep-time heuristic in `KitchenOrderQueue.calculatePrepTime` (`kitchen-order-queue.tsx:32-41`) uses `state.preparationTimes[menuItemId] || 5` and multiplies by quantity — a crude guess, not the kernel's `prepMinutes`.

**Role-based screens**
- Personas are now RBAC-filtered for nav, which is the right direction and a genuine improvement over the hardcoded `visibleNav` the gap analysis flagged. Personas also shape quick actions and `homeHref`. Good.
- But personas still carry **static `goals`/`alerts`** strings that are decorative (`BASE_ALERTS.manager: ["3 tables waiting > 10 min"]` — hardcoded, not computed). A persona's "alerts" showing hardcoded text is actively misleading.
- Kitchen login routes to `/dashboard/kitchen/display` (`AuthContext.login:338-339`), cashier/server to `/dashboard`. Good role-aware landing. But there's no role-aware *default within* multi-role users (a manager who also serves).

**Information hierarchy**
- Dashboard leads with `PriorityInbox` then quick actions then KPI cards then tabs — reasonable. `SignalDashboard` is strong but not on the main dashboard (it's a component; need to confirm where mounted). The 4 KPI cards (Total sales / Completed / Active / Tables free) with sublabels are clear.
- The 16-item sidebar (`dashboard-nav.tsx:10-27`) is flat. No grouping (Service / Back-of-house / Money / Admin). A manager scanning for "Settings" scrolls past inventory. **Progressive disclosure (grouping/collapsing) is missing.**

**Consistency**
- Brand inconsistency is glaring: login says **"Maison Chili POS"**, register says **"CHILI POS"**, metadata title says **"Restaurant POS"**, settings store name defaults to **"Maison Chili"**. Placeholder/test data is shipping as product identity.
- `type="text/html"` garbling: `ui-states.tsx:25` and `:50` contain mojibake (`â€”`, `Loadingâ€¦`) — encoding bugs in user-visible strings.
- Two competing table status vocabularies: `types/index.ts` `TableStatus = "available"|"occupied"|"reserved"|"dirty"`, but `TableBoardRow.status` in `builtins.ts:124` is `string` and the projection also emits `"out_of_service"`. `lib/status.ts` `tableBadgeVariant` must handle a union the projection can violate. Fragile.

---

## 2. Architectural Audit

### 2.1 Domain Model

**Strengths:** The aggregate set (`Order`, `Table`, `MenuItem`, `InventoryItem`, `KitchenStation`, `Reservation`, `Waitlist`, `Customer`, `StaffShift`, `PlatformOrder`, `WebhookEndpoint`, `GiftCard`) is comprehensive and correctly bounded. `OrderAggregate` in particular is rich: discounts as a *ledger* (not a running number), comps distinct from voids, transfer idempotency via `appliedTransfers`, split-aware tips, course holds. This is real domain modeling, not CRUD modeling.

**Concerns:**
- `OrderState.channel` is `"pos" | "kiosk" | "platform" | "phone"` — but `OrderContext.createOrder` maps `diningMode` to `channel` as `"pos"|"takeaway"|"delivery"` (`OrderContext.tsx:164`). `takeaway`/`delivery` are **not in the aggregate's channel union**. Either the type is stale or the events carry invalid channel values. `CartContext.ensureDraftOrder` does the same. **This is a real type/domain inconsistency** that will surface in reports/analytics that group by channel.
- Money is `number` (floating point) throughout (`unitPrice`, `subtotal`, `total`). `round2` in projections papers over it, but the aggregate itself does arithmetic in float. For a financial system this is a latent correctness bug (classic 0.1+0.2). Integer minor-units (cents) or a decimal type is the correct choice for money.
- `types/index.ts` is 1534 lines with **duplicate interface names** (`User` twice — once with permissions/shifts, once without; `AuthState` twice; `KitchenOrderEvent`/`KitchenItemEvent` twice) and deprecated duplicates (`LoyaltyCustomer`, `LoyaltyReward`). This is a type-layer mess that will cause subtle bugs and is a maintenance tax.

### 2.2 Service Boundaries

- The **kernel boundary is clean**: commands/queries/projections/events are well-separated; modules declare capabilities; cross-module communication is via policies and the command bus (e.g., `platform.ingestOrder` drives core `order.create` so guards apply — `platform.module.ts:147`). This is textbook modular-monolith CQRS.
- **The frontend boundary is not clean.** `context/*` are thin adapters over the kernel, but the *public interfaces* (`fetchMenu`, `fetchOrders`, `fetchTables`, `state.loading`, `state.error`) are **legacy-shaped no-ops retained for compatibility** (`MenuContext.fetchMenu = async () => {}`). This is deliberate (documented), but it leaves dead API surface that new developers will misuse.
- `AuthContext` is the outlier: it's a 633-line reducer + imperative-fetch blob that *does* use kernel commands (`staff.scheduleShift`, `staff.clockIn`/`clockOut` via a local `kernelPost`) but *also* does REST for profile/refresh/password. Mixed concerns.

### 2.3 Data Flow

- **Write path:** UI → context → `useCommand.run` → `POST /api/kernel` → `CommandBus.dispatch` (permission → Zod schema → policies → handler) → aggregate → `ctx.commit` → `appendMany` (CTE, optimistic lock) → hooks → projections. Solid.
- **Read path:** UI → `useProjection(name, interval)` → `GET /api/kernel?projection=` (poll) → projection state. Polling-based, not push/subscribe. `SocketBridge` exists for outbound event fanout (kitchen↔server cross-device), but the *primary* read path is HTTP polling at per-board intervals. For a POS this is acceptable (sub-2s freshness on the boards that matter) but it's not real-time; the KDS relies on it for ticket appearance.
- **Duplicated logic risk:** `CartContext` recalculates totals client-side (`recalculateCartTotals`, tax 0.05) while the `orders.board` projection computes `subtotal/tax/total` from events. Two sources of truth for money on the client. If they diverge (e.g., a comp applied on the server), the cart shows a different number than the check.

### 2.4 Multi-Tenancy

- `TenantContext { orgId, venueId, zoneId? }` threaded through every event, projection filter, and store query. `assertTenant` guards cross-tenant access. Postgres store scopes every SQL by `org_id`/`venue_id`. This is **solid row-level tenant isolation**.
- `tenantFromEnv()` reads `ROS_ORG_ID`/`ROS_VENUE_ID` from env. **But:** the kernel is a **module-level singleton per server process** with a fixed tenant (`getKernel()` in `kernel-singleton.ts`). This means **one process = one venue**. True multi-venue serving (one process, many `venueId`s from a request's auth) would require a kernel *per tenant*, not a singleton. `VenuesModule` gives a switcher's read model, but the isolation strategy for actually *operating* multiple venues in one deployment is unresolved. This is a **scalability/multi-tenancy boundary question** — flag for architecture review.

### 2.5 Authentication

- **Improved:** `AuthContext` now uses HttpOnly cookies (`posAccessToken`/`posRefreshToken` confirmed by smoke test) + a refresh flow, NOT localStorage (contrary to the older gap analysis). Access token kept in memory; refresh via `/api/auth/refresh` with `credentials: include`. This is the correct pattern.
- `/api/kernel` authenticates via `getTokenFromRequest` + `verifyJWT`, derives actor via `actorFromAuthPayload`. Good.
- **Concerns:** refresh token rotation? revocation on logout is server-side. No visible MFA. Login rate limiting was in-process (gap analysis); need to confirm if still a `Map` or moved to Redis. The `SECURITY.md` exists — worth cross-checking claims.

### 2.6 Authorization

- **The capability model is well-designed.** `permission-map.ts` decouples kernel capabilities from granular app permissions via `GRANULAR_TO_CAPABILITY` + `ROLE_TO_CAPABILITIES`. Notably it correctly isolates **revenue-affecting** capabilities: `order:comp` (comp/discount/waive-tax) is distinct from `order:edit`, so "a server can ring items but not comp them" (`permission-map.ts:26-31`). This is mature authorization thinking.
- **Concerns:** no row-level/scope authorization (a server can edit *any* order, not just their section — `order:edit` is global). Real POSes scope servers to sections. `order:edit_own` / `order:edit_any` exist in the granular map but collapse to the same `order:edit` capability (`permission-map.ts:18-20`) — so the distinction is **currently inert**. Similarly `audit:view` exists but there's no audit UI.
- Field-level PII masking: `customers.board` omits email/phone; `get.customer` is the PII-gated read. Good pattern. But `reservations.board` **includes** phone/email/specialRequests on the list (`reservations.module.ts:20-22`), readable by anyone with `reservation:view` — inconsistent with the customer module's care.

### 2.7 Offline Sync

Covered in §1.8 — architecture is strong (durable queue, idempotency, in-order replay, IndexedDB+LS). Gaps: conflict surfacing, dropped-failure visibility, no per-item queue inspection UI.

### 2.8 Billing

- **Payment is thin.** `order.recordPayment` records a method+amount; `PaymentMethod = "cash"|"credit"|"debit"|"mobile"|"gift"`, `PaymentGateway = "stripe"|"square"|"manual"` (types). But there is **no payment processor integration** — no Stripe/Square/Terminal SDK in the kernel, no capture/refund/void flows, no tip-capture at auth time, no PCI-scoped integration. `app/api/orders/[id]/payments` exists (smoke test hits it). For a "real-world" POS, card processing is table stakes; its absence (or stub status) is a **P0 for actual sales**.
- Tax is a single `taxRate` on the order with no jurisdictional/multi-rate/itemized-tax support. No service charge. Gratuity is a `tip` post-hoc. Restaurant money math (tax on discounted amount, service charge, tip pre-tax, rounding) is nontrivial and largely unmodeled.
- **No double-entry ledger / period close.** Gap analysis flagged this. The `AuditLog` exists in schema but there's no financial-close domain. "Restaurant OS" implies books-closeable; this isn't yet.

### 2.9 Inventory

- **No `inventory.module.ts`** — confirmed (only `inventory.aggregate` + `inventoryBoardProjection` in `builtins.ts`). So inventory has a read model and an aggregate but **no command module** in the kernel registry. The auto-86 hook (`kernel/index.ts:139-155`) listens for `inventory.*` events and calls `menu.eightySix` — but who emits `inventory.consumed`/`inventory.received` if there's no module? The auto-86 "best-effort" hook is therefore likely **dead** unless another path emits those events. This is an **incomplete domain**: the auto-86 anti-overselling claim in the gap analysis is currently not actually wired to a write path.
- `types/inventory.ts`, `vendor-management.ts` model ingredients/vendors/POs richly, but none is a kernel module. Vendors/PurchaseOrders are pure CRUD aspirations.
- `InventoryRow.available = onHand` always (`builtins.ts:287`) — no reserved/allocated quantity. Doesn't account for open orders holding stock.

### 2.10 POS Core

- Order lifecycle modeled well (draft→open→closed/voided + line statuses + course holds + splits). Cart is now a real draft order. Good.
- **Missing real-POS features:** no cash-drawer session (open/close/count/overage), no check-splitting UI (kernel has `order.splitCreated` / `ways` but no screen surfaced), no pre-authorization/tips-on-auth, no receipt printing (jsPDF is a dep — is it wired?), no cash rounding/change-due computation surfaced, no reorder-as-new ("fire again"), no held/parked checks, no table-turn alerts tied to revenue.

### 2.11 Kitchen Display (KDS)

- `kitchen.queue` projection, three-column board, SLA-breach banner, sound toggle, staff assignment, performance metrics.
- **Gaps (as gap analysis noted):** no course firing UI despite `order.fireCourse`/course-hold events existing; no bump-bar hardware (keyboard-only); no allergen/dietary highlighting on tickets (data exists in modifiers, not surfaced); no ticket recall/reprint; no per-station routing (`KitchenStationAggregate` exists); prep-time estimate is the crude client-side heuristic, not the kernel `prepMinutes`. The KDS is functional but not expedition-grade.

### 2.12 Reservations & Waitlist

- Reservations: solid double-booking guard via projection (`reservation.module.ts:96-111` + `overlaps()`), full lifecycle, reschedule, no-show. Good.
- **Missing:** no deposit/prepayment, no waitlist-quota vs capacity, no auto-assign best table, no turn-time analytics per booking, no SMS/email confirmation automation (the kernel has `waitlist.notify` event but no Twilio wiring surfaced — Twilio is a dep though).
- Waitlist: `seatAtTable` is a nice atomic two-aggregate command. But no "no-show timeout" and no guest-notification delivery guarantee (event is emitted; who sends the SMS?).

### 2.13 Delivery Integrations

- `platform.module.ts` is the standout: deterministic `platformOrderId(platform, externalOrderId)` as an idempotency key, ingest drives the core bus so guards apply, atomic abort (voids the created order before failing), 86'd-item veto during ingest, cancel/complete. This is production-grade marketplace ingestion.
- `delivery.connector` exists as a connector (outbound). But **inbound** is only via the generic `platform.ingestOrder` command — there are **no certified connectors** (DoorDash/UberEats/Grubhub webhook signature verification per platform, menu sync, status push-back). `webhooks.ts` provides generic HMAC signing/verification — a real platform requires per-platform auth and idempotency nuances.
- **No dispatcher**: delivery orders don't get their own board/queue distinct from dine-in, and no driver tracking/ETA despite `DeliveryInfo` type.

### 2.14 Reporting & Analytics

- `sales-board`, `staff-board`, `orders-board` projections exist. `AnalyticsContext` (legacy REST) + `SignalDashboard` (projection) both feed dashboard.
- **Gaps:** no general ledger / P&L / COGS (needs inventory cost integration — absent, §2.9); no labor-vs-revenue; no tax reporting; no Z-report / end-of-day close (gap analysis flagged a "closeout wizard" as high-value, unimplemented); reports/analytics pages exist but I have not verified they render real event-sourced data vs. legacy REST — a correctness risk given the migration.

### 2.15 Observability

- `console.info/error` for compaction and integration drain. A `/api/kernel?health=1` endpoint exposing projection positions + command/query counts (gated by `audit:view`). `bootstrap` returns module list + integration queue stats.
- **Missing:** no metrics (latency histograms, queue depth as a metric, error rates), no tracing (`traceId`/`correlationId` — events have `commandId`/`requestId` in metadata but not propagated as a trace), no structured logging, no alerting on projection lag or compaction failures, no dead-letter alerting for rejected webhook deliveries. The gap analysis's §5.2 point stands: the kernel is observable only to a developer with curl, not to an operator with a dashboard.

### 2.16 Reliability

- Event store durability is strong (single-statement atomic append, UNIQUE constraint race closure, archive MOVE atomicity, snapshots).
- **Concerns:** no `db.unsafe` query **timeout** (gap analysis: `postgres-event-store.ts:113` — a hung query can hang a request; no `AbortSignal`/statement_timeout). Idempotency cache is an **in-process LRU (5000)** — in a multi-instance deploy, a retried `requestId` hitting a different instance re-executes. For a POS where duplicate `order.recordPayment` is catastrophic, this needs a DB/Redis-backed idempotency store. `Projection.catchUp()` = full `rebuild()` — no incremental catch-up from a persisted cursor, so every process restart replays the whole log.

### 2.17 Scalability

- **Projection memory:** every projection holds its **full state in memory** (`rows: []`). `orders.board`, `customers.board`, `reservations.board` grow unbounded with venue history. `orders.board` never evicts closed/old orders; `platform.orders` sorts all rows on every event. For a high-volume venue (thousands of orders/day, retained for years), these are memory leaks and O(n) reducers.
- **Rebuild cost:** `boot()` → `rebuildAll(concurrency=4)` replays the *entire* event log for every projection on every cold start. Even parallel, this is O(events × projections) per boot — seconds to minutes at scale. No persisted checkpoints (ADR-001 acknowledges "boot pays O(events × projections) once," but "once" per cold start is still brutal).
- **Query pagination:** projections return full arrays; `list.*` queries have no cursor pagination (`list.staffing.board` returns everything). The gap analysis flagged this; still true.
- **Socket fanout:** per-event emit, no batching (gap analysis §6.3).

### 2.18 Security

- JWT in HttpOnly cookie (good). Capability-based authz with revenue separation (good). PII-gated customer reads (good). Service worker fails closed on API cache (excellent).
- **Remaining:** in-memory login rate limiter (if still a `Map`); no CSP headers (gap analysis); `/api/v1` API keys unscoped/unrotatable (single env key — `api-key.ts`); command payloads unvalidated at the bus unless a handler opts into Zod (`schema?` is optional — **most commands don't set it**, so negative prices etc. reach aggregates relying on ad-hoc guards); no rate limiting on the *kernel command* endpoint itself (a compromised token could flood commands); no field-level masking on reservations; no audit-log UI despite `audit:view`.

### 2.19 Testability

- Kernel is very testable (pure aggregates, in-memory store, `RecordingSocketTransport`, `RecordingOutboundTransport`). Good seams.
- **But:** the only test is a single Playwright **smoke test** (`tests/smoke.spec.ts`) covering login→order→kitchen→payment. There are **no unit tests for aggregates, no tests for projections (rebuild determinism), no policy tests, no concurrency/conflict tests, no offline-queue tests, no authorization tests**. `npm run kernel:smoke` exists but is a manual script. For a financial system, the test suite is far below the bar — especially: *no test that a replayed/offline-queued command is idempotent*, *no test that concurrent order edits don't double-charge*.

### 2.20 Extensibility & Migration

- **Module system is genuinely good:** `RosModule` with lifecycle, capabilities, dependencies, install/activate/deactivate; `ModuleRegistry`; runtime injection. This supports the "modular monolith" and a future marketplace.
- **Migration strategy (the REST→kernel split):** ADR-001 is the right call — kernel is canonical, REST is legacy with `Sunset` + `X-Migrate-To` headers. **The migration is now largely complete** on the contexts (all route through the kernel). The remaining legacy is `AuthContext` profile/refresh, `CartContext` localStorage mirror, `InventoryContext`/`AnalyticsContext` (need to verify if still REST), and `/api/customer/*`. This is a much better position than the earlier gap analysis described.
- **Risks in migration:** mutable Postgres tables (`db/schema.sql` Order/MenuItem/Table/Customer/Reservation/etc.) still exist alongside projections — two sources of truth. Need a documented decommission plan + drift monitoring (`/api/kernel?health=1` exists but row-count reconciliation is "to add").

---

## 3. Psychological & Behavioral Audit

This section asks: *how does the system feel to the humans under pressure, and does it shape good behavior or exploit shortcuts?*

### 3.1 User Mental Models

- **Server mental model:** "I have *my section*. I take orders, fire them, watch for ready, turn the table." The app models "all tables/orders" globally — a server must *self-filter* to their section. There is no "my tables" default despite personas suggesting it (`personaFor('server').homeHref = /dashboard/tables` but no section scoping). **Mental model mismatch**: the tool is manager-shaped; the user is server-shaped.
- **Kitchen mental model:** "fire, bump, done." The KDS gives pending/preparing/ready columns — good. But it's driven by `fetchOrders()` polling every 60s as a "fallback" to sockets (`kitchen/display/page.tsx:35-39`), so a fired ticket can take up to a minute to appear on the KDS if sockets are down. **For a kitchen, a 60s ticket latency is a service failure.** The kernel pushes via `SocketBridge`, but the board's primary refresh is the 5s projection poll via `useProjection`, and the page's own 60s `fetchOrders` (a no-op now that `fetchOrders` is a projection no-op!) is vestigial. Actually — since `OrderContext.fetchOrders` is now a no-op, that 60s interval does nothing; real freshness is the 5s `kitchen.queue` poll in `SignalDashboard`/`useProjection`. So KDS freshness ≈5s, acceptable but not instant; the code is confusing (a no-op `fetchOrders` called in a loop).
- **Owner mental model:** "show me my business." The dashboard gives revenue/tables/popular items, but **"Total sales" is all-time, not today** (`dashboard/page.tsx:145` `sub: "${stats.orderCount} orders all time"`). An owner opening the POS wants *today's* numbers. Showing all-time totals as the headline KPI is a mental-model failure and a trust risk ("why is my revenue $3M?").

### 3.2 Decision Friction

- **High-frequency path (add item to order):** now kernel-backed, but each add is a round trip with optimistic update. For a server ringing 8 items, that's 8 sequential awaits. Feels sluggish on a weak network and generates 8 events. Should batch lines or make the draft purely client-side until "fire."
- **Table turn (clear/clean/seat):** `updateTableStatus` maps status→distinct kernel commands with sensible guards. Good. But the `reserved` case just shows an info toast ("Reserve this table from a reservation…") — a dead end during service when a host wants to hold a table.
- **Error recovery friction:** the killer. Every rejection is a generic toast (no `notifyWithActions`). A failed table-seat during peak → "Table update rejected: Table is occupied" → server has to *mentally* figure out next steps under pressure. High friction, high stress.

### 3.3 Staff Workload Under Pressure

- **Alarm fatigue:** `SignalDashboard` + KDS SLA banner + `PriorityInbox` all fire simultaneously during peak. With no acknowledgement/dismissal, staff learn to ignore all red. A 20-min fixed SLA that's wrong for a 12-min pasta dish generates constant false positives.
- **Notification overload:** `NotificationCenter` + toasts + signal dashboard + badge indicators. Four feedback channels for one system state.
- **Positive:** haptic + tone feedback is excellent for eyes-off operation. `pos-press` classes suggest a considered tactile design language.

### 3.4 Trust in System State

- **Good foundations:** the codebase is *self-aware* about trust — `sw.js` comment on cache leaks, `StaleDataNotice`, `ConnectionPill`, `live` badges, "a POS that silently shows stale data is worse than one that admits it." This is mature product thinking.
- **Trust gaps that erode it:** (1) Settings "saved" but not saved (§1.2) — if a manager catches this, *nothing* else on the settings screen can be trusted. (2) Hardcoded persona alerts (`"3 tables waiting"` as literal text) — obviously fake if you look. (3) All-time "Total sales" as today's KPI. (4) Offline-queued commands that later get silently rejected. Each of these is a small lie the system tells; a few of them destroy trust faster than the honest offline design earns it.

### 3.5 Error Prevention

- **Excellent:** the kernel's *preventive* guards are the best feature — 86'd items can't be sold, double-booked tables can't be booked, double-seating is blocked, comps require elevated permission, platform ingest is idempotent. These prevent errors *at the source* rather than apologizing after.
- **Preventive gap:** tax is client-computed at a fixed 5% in the cart and server-config is disconnected — so the *invoice the customer sees may not match the venue's real tax*. That's a compliance/legal risk, not just a bug.

### 3.6 Motivation for Setup & Habit Formation

- **Setup motivation is weak.** There's no "aha moment" — no import, no sample data, no first-value template. A new owner must hand-enter a menu and a floor plan before seeing anything. The guided tour is dead. Habit formation never starts.
- **Positive hooks if they worked:** quick actions one tap away (`QuickActions`), `pos-press` tactile feedback, keyboard shortcuts, persona defaults. The skeleton for habit is there; the trigger (a first successful order) is hard to reach.
- **Daily habit:** no end-of-day close ritual (Z-report), no shift clock-in prompt surfaced prominently, no "yesterday vs today" rhythm. The daily loop is un-narrated.

### 3.7 How the Interface Communicates Risk, Urgency, Permission

- **Risk:** 86'd items, sold-out, insufficient stock are *prevented* (good). Financial risk (comp/discount/tax waiver) is *permission-gated* (good). But there's no **preview of consequence** — applying a discount doesn't show the margin impact or who approved it.
- **Urgency:** SLA thresholds are fixed and unconfigurable; "red" means "20 min," not "this dish is overdue by 2 min." Coarse urgency is easy to ignore.
- **Permission:** capabilities are enforced but **not communicated**. A server who can't comp sees a `FORBIDDEN` toast with no explanation of *why* or *who to ask*. The system enforces but doesn't teach the boundary.

---

## 4. Customization, Scaling & Progressive Disclosure

**Can the system be configured for solo operators, small teams, and full restaurants, and expand later?** This is where the product-level gaps bite hardest.

**Current state:** 
- **No setup wizard / venue configuration flow.** You register an account and land in an empty, unconfigured system. There's no "I run a food truck" vs "I run a 200-seat restaurant" fork.
- **No feature toggles.** Every module installs by default (`bootKernel` installs phase2/3/4/customer/venue modules unless explicitly disabled). A solo operator gets gift cards, promotions, webhooks, platform orders, multi-venue — an overwhelming, mostly-irrelevant surface. Conversely, a full restaurant may need modules that don't exist (inventory, accounting ledger, payroll).
- **Role model is static.** Roles are fixed enums with fixed capability sets (`ROLE_TO_CAPABILITIES`). No custom roles, no composite roles ("bar manager who also serves"), no per-venue role overrides. The gap analysis's §2.1 point is **still the core issue** — `PermissionName` granularity exists in the permission *map* but there's no UI to assign custom permission sets, and nav is filtered by coarse capability.
- **Multi-venue exists as a switcher (`VenuesModule`, `/dashboard/multi-venue`) but tenant isolation is process-scoped singleton (§2.4)** — so "multi-venue" is a read model, not a proven multi-tenant operating mode.
- **Progressive disclosure:** the sidebar is flat (16 items, no grouping), settings is a 3-tab stub, and there's no "simple mode" for a solo operator.

**Verdict:** The **architecture can** support this (modules install/deactivate; capabilities are granular; personas are permission presets), but the **product surface cannot** — there's no wizard, no toggles, no custom roles, no venue-type fork. This is the gap between architectural capability and product delivery, and it's the single biggest constraint on serving the SMB long tail.

**What a real product needs (concrete):**
1. A **venue-profile wizard** at first login: venue name, cuisine, covers, service model (counter/dine-in/delivery-only), tax jurisdiction, currency, tipping policy. This single flow unlocks everything downstream.
2. **Module marketplace / toggles:** let the owner enable only POS+Tables first, add Kitchen/Inventory/Reservations/GiftCards later. Surface `ModuleRegistry` capabilities in a settings UI.
3. **Custom roles:** a UI over the existing `GRANULAR_TO_CAPABILITY` map to compose roles ("Bar Manager" = bar section + comps). Personas become *templates*.
4. **Solo-operator mode:** collapse the sidebar to the 4 things one person does; hide multi-user management noise.
5. **Progressive nav grouping + a real keyboard-shortcut overlay.**

---

## 5. Deep Product Details That Actually Matter

Things that look cosmetic but are load-bearing in a real restaurant:

1. **Tax correctness on the check** — currently client-computed at a fixed rate, disconnected from settings and server. The number the guest pays must be authoritative server-side and jurisdiction-correct. *Currently broken.*
2. **Cash-drawer session (open/close/count/overage)** — the daily ritual that turns POS revenue into cash reconciliation. Absent. High ritual value.
3. **Z-report / end-of-day close** — the owner's "did today work?" moment. Absent.
4. **Comp/discount approval trail** — who comped what, when, why, margin impact. Capability exists; the *ritual and visibility* don't.
5. **Table-turn / server-section visibility** — "my section" is the server's whole world; absent.
6. **Change due (cash) & receipt** — the last 5 seconds of a transaction; the moment the guest leaves. Needs rounding + printable receipt + tip prompt.
7. **Split-the-check UX** — kernel supports splits; the screen doesn't. Groups of 6 at close are a real scenario.
8. **86 an item in one tap from the KDS** — the kitchen's most frequent corrective action. `menu.eightySix` exists; is it one tap on the ticket? Should be.
9. **Allergen prominence on the KDS ticket** — safety-critical. Data exists, not surfaced.
10. **Order number vs. table number as the human handle** — staff say "table 4" / "order 1042"; the system must present those, not UUIDs. (Smoke test does `orderId.substring(0,8)` — the UI may be leaking UUIDs.)
11. **Offline queue inspection** — "3 changes pending, 1 rejected" must be visible. Trust hinges on it.
12. **Brand consistency / no mojibake** — "Maison Chili" vs "CHILI POS" vs "Restaurant POS," plus `â€”` artifacts. Cheap to fix, embarrassingly visible.

---

## 6. Ranked Findings (Severity × Business Impact)

Severity: **P0** blocks/costs money or data integrity; **P1** high trust/workflow cost; **P2** reach/accessibility/scale; **P3** polish. Impact = business consequence.

| # | Sev | Finding | Where | Business Impact |
|---|-----|---------|-------|-----------------|
| 1 | **P0** | No card payment integration (Stripe/Terminal/Square) — payments are recorded but not captured | kernel order payments; `types/payment.ts` | **Cannot actually take card payments.** Blocks the core revenue flow for any modern venue. |
| 2 | **P0** | Settings are fake (local state, no persist) and tax is hardcoded 5% in cart, disconnected from server | `settings/page.tsx`; `CartContext.tsx:63` | **Check totals wrong / illegal.** Guest billed incorrect tax; manager loses trust instantly. |
| 3 | **P0** | No setup wizard — new owner lands in an empty unconfigured system | `register` → dashboard | **Adoption collapse.** No time-to-value; churns before first order. |
| 4 | **P0** | Guided tour is dead code (targets don't exist, never triggered); tours point at missing DOM ids | `tour-provider.tsx`; `dashboard/page.tsx` | **New staff unaided.** Compounds #3. |
| 5 | **P0** | In-process idempotency LRU (5000) — retries across instances can double-execute | `command-bus.ts:156-162` | **Double-charge / double-order** in multi-instance deploys. Financial. |
| 6 | **P0** | Inventory has no command module; auto-86 hook likely unwired (no writer for inventory events) | no `inventory.module.ts`; `kernel/index.ts:139` | **Overselling** — the anti-oversell claim isn't actually enforced. Inventory module is a gap. |
| 7 | **P1** | Guided recovery built but unwired — `notifyWithActions`/`recoveryActionsFor` unused; all errors are generic vanishing toasts | `feedback.ts:52-79` vs all contexts | **Rush-hour friction + stress.** Rejections aren't actionable; high error-recovery cost. |
| 8 | **P1** | No conflict-resolution UI for concurrent edits; conflicts silent; version parsed by regex | `kernel-provider.tsx:409`; no caller | **Two servers editing one bill** → lost work / double-charge; trust loss. |
| 9 | **P1** | No server-section scoping ("my section"); RBAC collapses `edit_own`/`edit_any` to global `order:edit` | `permission-map.ts:18-20` | **Poor UX + over-broad access.** Server sees/is responsible for all orders. |
| 10 | **P1** | Offline queue silently drops server-rejected commands (no per-item visibility) | `kernel-provider.tsx:322` | **Staff believe changes landed that didn't.** Trust + data loss during blips. |
| 11 | **P1** | Dashboard KPI "Total sales" is all-time, not today | `dashboard/page.tsx:145` | **Owner mental-model break**; undermines credibility of the headline number. |
| 12 | **P1** | Hardcoded persona "alerts" (`"3 tables waiting"`) render as fake signals | `personas.ts:18-24` | **Obvious falseness** erodes trust in real signals. |
| 13 | **P1** | Brand inconsistency (Maison Chili / CHILI POS / Restaurant POS) + mojibake (`â€”`) in UI strings | login/register/metadata; `ui-states.tsx:25,50` | **Professionalism loss**; looks unfinished to prospects. |
| 14 | **P1** | Static role enums; no custom roles, no composite, no venue-type wizard, no feature toggles | `permission-map.ts`; no setup flow | **Unfit for SMB;** forces role/credential sharing; can't scale with the business. |
| 15 | **P2** | Unbounded projection memory (orders/customers/reservations grow forever; O(n) reducers) | `orders-board.ts`, `customers.module.ts` | **Memory/perf degradation** over venue lifetime; eventually OOM. |
| 16 | **P2** | Full event-log replay on every cold start (no persisted cursor) | `kernel.boot()` / `projection.rebuild` | **Slow boot, scales with history.** |
| 17 | **P2** | No query pagination; `list.*` returns full arrays | query handlers | **Doesn't scale** for large venues. |
| 18 | **P2** | No route-level authz guard on `/dashboard/*` (nav filtering only) — needs verification | `dashboard/layout.tsx`, `middleware?` | **If unguarded:** unauthorized staff reach screens, see silent failures. |
| 19 | **P2** | Accessibility gaps: no route-change focus, no live regions for projections, sub-44px touch targets, no shortcut overlay | various | **Excludes users;** WCAG liability; handheld usability. |
| 20 | **P2** | Money as float `number` throughout | `order.aggregate.ts`, projections | **Latent rounding bugs** in a financial system. |
| 21 | **P2** | `OrderState.channel` union vs. actual `"takeaway"/"delivery"` values mismatch | `order.aggregate.ts:49` vs `OrderContext.tsx:164` | **Channel reporting/analytics wrong** or type-unsafe. |
| 22 | **P2** | No observability (metrics/tracing/alerting); health endpoint is dev-tooling only | `app/api/kernel?route` | **Can't operate in production** — blind to lag, errors, queue depth. |
| 23 | **P2** | Test coverage near-zero beyond one smoke test (no aggregate/projection/concurrency/offline/authz tests) | `tests/smoke.spec.ts` only | **High regression risk**, esp. financial/concurrency paths. |
| 24 | **P2** | No cash-drawer session, no Z-report/closeout, no split-check UI, no receipt flow | absent | **Missing the daily financial ritual** that makes a POS sticky and valuable. |
| 25 | **P2** | KDS: no course-firing UI, no allergen highlighting, no bump-bar, no station routing; vestigial 60s no-op `fetchOrders` loop | KDS page; `OrderContext.fetchOrders` | **Sub-expedition KDS**; allergen risk; confusing code. |
| 26 | **P2** | `types/index.ts` 1534 lines with duplicate/deprecated interfaces (`User`, `AuthState` ×2) | `types/index.ts` | **Type-safety/维护 tax**; confusing imports. |
| 27 | **P3** | No CSP headers; unscoped API key; no kernel-endpoint rate limit; reservations board exposes PII on the list | `security`; `api-key.ts`; `reservations.module.ts:20` | Hardening debt. |
| 28 | **P3** | 27 Radix deps, flat 16-item sidebar, no nav grouping, `types/platform/*` empty files | various | Polish/performance. |
| 29 | **P3** | `notify("success","Table moved")` toast storm on floor-plan drag | `TableContext.updateTablePosition` | Noise. |
| 30 | **P3** | Duplicate `alerts`/`goals` decorative strings; `types/platform` empty | `personas.ts`, `types/platform` | Dead surface. |

*(Business-impact column favors "cannot sell / illegal / loses trust / cannot operate" over polish.)*

---

## 7. Concrete Improvements (Prioritized & Concrete)

**Phase A — Unblock revenue & trust (P0). Weeks 1–3.**
1. **Integrate a real payment processor** (Stripe Terminal or Square). Add `PaymentGateway` capture/refund flows; server-authoritative payment intents; tip-on-auth. *Without this, no card sale happens.*
2. **Make settings real.** Persist via kernel commands (`venue.configure`, `tax.setRate`, etc.) or a `SettingsAggregate`. Move tax computation **server-side** in `OrderAggregate` (the guest check must be authoritative). Delete the client `taxRate = 0.05`.
3. **Build the venue-setup wizard.** Post-register → 5-step wizard (venue profile → service model → tax/currency → first tables → first menu via CSV paste). Gate `/dashboard` behind "venue configured" and offer a "skip, do it later" that keeps a persistent checklist.
4. **Wire guided onboarding.** Make `TourProvider` real: give dashboard/orders the ids its tours target, call `startTour` on first visit per role, and add a persistent "Set up your venue" checklist card on the dashboard that doubles as onboarding progress.
5. **DB/Redis-backed idempotency** for `requestId` in `CommandBus` (persist the result with the request; check on dispatch). Closes the double-charge window across instances.
6. **Add `inventory.module.ts`** (commands + aggregate wired into `ModuleRegistry`) so `inventory.received/consumed/wasted` have a real writer and the auto-86 hook actually fires. *Or* explicitly defer inventory and remove the auto-86 claim.

**Phase B — Wire recovery, fix concurrency & offline trust (P1). Weeks 3–5.**
7. **Wire `notifyWithActions`/`recoveryActionsFor` into every rejection path** (TableContext, OrderContext, MenuContext, CartContext, WaitList). Pass `result.error.code` → recovery buttons in the toast. *Cheapest high-impact fix in the repo.*
8. **Persistent, dismissible error surface.** Add a "Needs attention" drawer listing rejected/failed actions (esp. offline-replay rejections) with resolve/retry — don't rely on 4s toasts for revenue-affecting failures.
9. **Conflict-resolution UI.** On `VERSION_CONFLICT`, show current-vs-yours and let the user choose; stop parsing version from the message string — add `details.currentVersion` to the `KernelError`.
10. **Fix the four "small lies":** persist-or-hide settings (#2), all-time → **today's** sales, remove hardcoded persona `alerts` (or compute them), fix brand strings + mojibake. *Cheap, high trust-return.*
11. **Server-section scoping.** Honor `order:edit_own` vs `edit_any`; add "My tables"/"My orders" default views for server/waiter personas.

**Phase C — Configure-for-SMB & daily ritual (P1→P2). Weeks 5–8.**
12. **Feature toggles / module manager** in Settings driven by `ModuleRegistry` — enable POS+Tables first; add Kitchen/Inventory/Reservations/GiftCards later. Introduce a **solo-operator mode** (collapsed sidebar).
13. **Custom roles UI** over the existing granular permission map; personas as templates.
14. **Cash-drawer session + Z-report closeout.** Open drawer (starting float) → transactions → close (counted cash, expected, variance). This is the daily financial ritual that makes the product indispensable.
15. **Split-check UI + receipt/change-due.** Surface `order.splitCreated`/ways; cash rounding + change due; wire jsPDF receipt.
16. **KDS v2:** course-fire UI (wire `order.fireCourse`/holds), one-tap 86 from ticket, allergen highlight on lines, bump-bar shortcut, station routing; delete the vestigial 60s `fetchOrders` loop.

**Phase D — Operability & scale (P2). Weeks 8–12.**
17. **Projection persistence + incremental catch-up:** persist per-projection `globalPosition` cursor; `catchUp()` replays from cursor, not full rebuild; evict old closed orders from `orders.board`; index/paginate `list.*` queries.
18. **Observability:** OpenTelemetry `traceId` on events/commands, latency + error + queue-depth + projection-lag metrics, structured logging, alerting on lag/dead-letters.
19. **Money as integer minor units** (or decimal); fix `OrderState.channel` union to include takeaway/delivery.
20. **Accessibility pass:** route-change focus, live regions for projection updates, ≥44px touch targets on floor-plan/table-card, shortcut overlay, contrast audit.
21. **Test the financial core:** unit tests for `OrderAggregate` (comps, splits, transfers, tax), projection determinism/rebuild, idempotency-replay, concurrency conflict, offline queue, and a permission matrix test.

**Phase E — Polish & ecosystem (P3+).**
22. Collapse/remove duplicate types; delete empty `types/platform/*`; prune Radix deps; group sidebar nav; quiet high-frequency toasts.
23. Certified delivery connectors (DoorDash/UberEats) on top of `platform.ingestOrder`; add a dispatcher board for delivery orders.
24. Publish generated SDK/OpenAPI; module marketplace narrative.

---

## 8. Assumptions, Gaps & Missing Requirements

**Assumptions I made (state if wrong):**
- `POS` targets real commercial restaurants (not a demo/portfolio), so payment capture, Z-report, and tax compliance are *requirements*, not nice-to-haves.
- "Restaurant OS" implies multi-venue is a genuine requirement, not a switcher over one venue.
- The DB is Postgres via Neon (`@neondatabase/serverless`); serverless/multi-instance is the likely deployment (affects idempotency and rate-limiting severity).
- The earlier `GAP-ANALYSIS.md` reflected an older tree; much of its "split-brain REST" concern is now resolved on the contexts. I've re-verified against current source.

**Known gaps in my review (need verification / I could not fully confirm):**
- **Route-level authorization middleware:** I did not find `middleware.ts`; need to confirm whether `/dashboard/*` is server-guarded or only nav-filtered. If unguarded → P0/P1 (#18).
- **Whether `InventoryContext`/`AnalyticsContext` still hit REST** or have been migrated (I read `Order/Menu/Table/Cart` fully; not `Inventory`/`Analytics`).
- **Login rate limiter implementation** — the gap analysis said in-process `Map`; current state unconfirmed.
- **Kernel-command rate limiting / CSP** — presence unconfirmed.
- **Cash payment / change-due / receipt printing** — jsPDF is a dep; whether wired unknown.
- **The `/handheld` entry point** exists as a route; quality/scope not audited (gap analysis calls it missing; a file now exists).
- **Menu CSV import** — no evidence found; assumed absent.
- **Payment processor SDK** — assumed absent from `package.json` (no stripe/square deps visible); if a server-side integration exists elsewhere, finding #1's severity drops.

**Missing requirements (not in the product or docs):**
- **NFR/SLOs:** no stated availability, latency, or RPO/RTO targets. A POS needs "99.9% during service hours," "p99 command < 300ms."
- **PCI-DSS scope** for card handling; **GDPR/CCPA** retention & deletion policy for guest PII.
- **Tax/jurisdiction compliance model** (US state/local, VAT/GST, tip taxation rules).
- **Offline reconciliation policy:** what a manager does when a queued command is rejected on reconnect (the product has no answer).
- **Multi-tenant isolation strategy** (process-singleton vs per-tenant kernel) — unresolved.
- **Hardware support matrix:** receipt printers, cash drawers, card terminals, bump bars, scales — undefined.
- **Migration/decommission plan** for the legacy mutable tables + legacy REST endpoints.
- **Acceptance criteria / definition of done** for the "kernel-first" migration.
- **Data retention & archival policy** for events/projections (unbounded growth, §2.17).

---

## 9. Closing Assessment

This is a **strong architectural spine with an unfinished product layer**. The event-sourced kernel — atomic appends, cross-module policies, idempotent marketplace ingest, projection read models, a real module system — is the kind of foundation most POS products never build. Whoever wrote the `sw.js` cache-leak comment and the `loadExisting` guard understood production failure modes.

But a POS is won at the counter, not in the architecture doc. The product currently **under-communicates state** (silent offline rejections, generic vanishing errors, hardcoded alerts, fake saved settings), **over-presupposes one venue shape** (no wizard, no toggles, no custom roles), and is **missing the money and ritual layer** (card capture, tax correctness, cash sessions, Z-report, split checks). Those are the gaps between "impressive codebase" and "restaurant the owner trusts with their livelihood."

The highest-leverage single change is almost embarrassingly small: **wire the guided-recovery layer that already exists** (`notifyWithActions` + `recoveryActionsFor`) into the rejection paths, and **make settings and tax server-authoritative**. Those two changes, plus a real payment integration and a venue-setup wizard, would move this from "impressive engine" to "sellable product" faster than any architectural refactor.

---

*Review based on source inspection of kernel/, context/, components/, app/, lib/, types/, public/sw.js, docs/adr/, and GAP-ANALYSIS.md. Line references current as of 2026-10-02. Items marked "verify" in §8 need a follow-up pass against middleware, Inventory/Analytics contexts, the rate limiter, CSP, and payment/receipt wiring.*
