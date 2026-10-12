# Kernel reference — commands, queries, projections

The kernel is the only write path. UI calls `run(commandType, payload)` with
a `requestId` (idempotent retry); reads are `ask(queryType, params)` or
`useProjection(name, intervalMs)` polls. Every command enforces its
`requiredPermission` before any validation. Money is minor-unit-safe
server-side (`round2` at projection boundaries; Postgres `NUMERIC`).

## Orders & tables (core)

| Command | Permission | Effect |
| --- | --- | --- |
| `order.create` | `order:create` | Draft check (`channel`: pos/handheld/kiosk/platform/phone/takeaway/delivery/dine-in) |
| `order.addLine` | `order:edit_own` (+section policy) | Ring a line; 86'd/unsellable vetoed by policy |
| `order.sendToKitchen` | `order:process` | Fire (all or selected lines) → KDS |
| `order.fireCourse` / `holdCourse` / `releaseCourse` | `order:process` | Course control |
| `order.recordPayment` | `order:pay` | Record payment (`method`, `amount`, optional `splitIndex`, `gateway`) |
| `order.close` | `order:pay` | Close when fully paid (separate audited step) |
| `order.void` / `order.voidLine` | `order:edit_own` | Void with reason (audited, in AuditLog) |
| `order.comp` / `order.compLine` | `order:comp` | Comp (revenue-affecting, elevated) |
| `order.applyDiscount` | `order:comp` | Amount/percent discount ledger (label + `appliedBy`) |
| `order.applyTax` | `order:comp` | Stamp server-side venue rate before firing |
| `order.addTip` | `order:pay` | Gratuity/tip (incl. venue-gratuity button, per-seat tips) |
| `order.split` | `order:pay` | Equal-ways split (`splitId` idempotent) |
| `order.transferLines` | `order:edit_own` | Move lines between checks (idempotent `transferId`) |
| `order.setNotes` / `order.setTable` | `order:edit_own` | Notes / re-table |
| `table.create` / `seat` / `clear` / `clean` / `reposition` / `outOfService` | `table:create` / `table:edit` | Floor lifecycle with seating guards |

Queries: `get.order` (full state incl. discount/tip ledgers), `get.table`,
`get.aggregateEvents` (`audit:view`).

## Money

| Command | Permission | Effect |
| --- | --- | --- |
| `payment.authorize` | `order:pay` | Authorize via provider (`POST /api/payments/intent` for cards) |
| `payment.capture` | `order:pay` | Capture an authorized intent |
| `payment.refund` / `payment.voidAuth` | `order:pay` | Refund / void authorization |
| `cash.open` / `payout` / `noteSale` / `close` | `order:pay` | Drawer sessions (float, payouts with reason, counted vs expected) |

Provider via `ROS_PAYMENT_PROVIDER`: `manual` (default, record-only) |
`simulated-stripe` (demos) | `stripe-terminal` (needs `STRIPE_SECRET_KEY`).
`get.paymentProvider` tells the UI which is live so it never implies capture
when there is none. Queries: `list.payments`, `get.payment`.

## Catalog, inventory, staff, guests

- **Menu** (`menu:view`/`menu:edit`): `menu.createItem/updateItem/changePrice/setPrepTime/setAvailability/eightySix/clearEightySix/addModifierGroup/setRecipe`. Queries `get.menuItem`, `list.menu`, `list.menu.sellable`.
- **Inventory** (`inventory:*`): `defineItem/updateItem/receive/consume/recordWastage/adjust`. Firing depletes recipes; zero stock auto-86's.
- **Staff**: `staff.scheduleShift/clockIn/clockOut/startBreak/endBreak`. Queries `get.shift`, `list.staffing.board`.
- **Customers/loyalty**: `customer.enrol/recordVisit/awardPoints/addReward/redeemReward/submitFeedback/update`. PII never on boards — `get.customer` only (`customer:view`, PII masked without `customer:view_pii`).
- **Reservations/waitlist**: `reservation.book/confirm/seat/complete/cancel` (double-book guard), `waitlist.join/notify/seat/seatAtTable/remove`.
- **Venue**: `venue.create/update/configureTax` (tax/gratuity/currency/SLA are auditable events). Query `list.venues`.
- **Platform**: `platform.ingestOrder` (idempotent `platformOrderId`, 86-veto, drives core bus), `platform.cancelOrder/completeOrder`.
- **Gift cards / promotions / webhooks**: `giftcard.issue/load/redeem/refund/void`, `promotion.define/setActive/recordRedemption` (+`promotion.evaluate`), `webhook.subscribe/update/unsubscribe`, `outbound.replay`.

## Projections (reads)

`orders.board` (cap 2000, closed/voided evicted first) · `kitchen.queue` ·
`tables.board` · `menu.board` · `inventory.board` · `reservations.board` (cap
2000) · `customers.board` (cap 10000, LRU) · `sales.board` (settled buckets by
day — the Z-report source; unpaid checks are never revenue) · `staff.board` ·
`cash.board` · `payments.board` · `waitlist.board` · `platform.orders` ·
`giftcards.board` · `promotions.board` · `webhooks.endpoints`.

Checkpoints persist in `ros_projections_state`; boot replays incrementally.
Health: `GET /api/kernel?health=1` (`audit:view`).

## Conventions

- Every mutating call carries `requestId` — safe to retry; replays dedupe.
- Rejections return `{ code, message, suggestedActions? }` — the UI renders
  recovery actions, not bare errors.
- `VERSION_CONFLICT` carries structured `details.{expectedVersion,
  currentVersion}` and opens the conflict dialog (retry vs reload with server
  summary), not a toast.
- Financial events (`paymentRecorded`, `voided`, `discountApplied`, `tipAdded`,
  `splitCreated`, cash moves, `payment.refunded`) land in `AuditLog` with
  actors — readable at Money → Audit log (`GET /api/audit`, `audit:view`).
