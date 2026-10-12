# User guide — daily operations by role

Everyone signs in at `/login` (email + password, or email + PIN on shared
devices). You land where your job lives: servers on Tables, cashiers on Cash,
cooks on the KDS wall, managers on the Dashboard.

## Server

**Take an order** — New Order (`/dashboard/orders/new`) or Handheld
(`/handheld?table=T4`, or scan the table QR). Tap an item to ring it (one tap,
it lands in the draft). No customization popup blocks you; notes and options
are edited from the cart.

**Park a check** — New Order → `Park (n)`. The draft is saved automatically;
resume from Orders → ⏸ Parked. Use this when a table isn't ready to fire.

**Fire to kitchen** — Send from the order (or `Fire to Kitchen` on handheld).
86'd items never appear as orderable; if one sells out mid-order the kitchen
rejects the line and tells you what to offer instead.

**Split the bill** — Order → Split check. `Split n ways` for equal shares, or
`By seat (items)` to assign each line to a seat and collect per-seat totals
(tax and discounts split proportionally). Seat payments are idempotent: a
double-tap or a reload can never charge a seat twice, and you can't collect
more than the remaining balance.

**Cash** — Change due card: enter tendered, read the change. If the venue uses
cash rounding, the rounded cash total is shown; cards always stay exact.

**Voids** — Voiding needs a written reason (it lands in the event log with
your name) and a confirm. Voids live in the Audit log, not in gossip.

## Cashier

**Drawer ritual** — Cash (`/dashboard/cash`): Open (starting float) → sell →
Payout (reason required) → Close (count cash, explain any variance). Closing
needs a confirm and shows expected vs counted up front. A close with nonzero
variance and no reason is blocked — write the reason.

**Take payment** — Order → Payment. Cash, card via terminal reference, mobile,
gift. Card payments with no live terminal *require* the terminal slip/auth
code — a reference-less card record is how money goes missing, and the form
refuses it. Amounts can't exceed the remaining balance; clearing the field
never breaks the form.

**Refunds** — Refund button (reason required, partial amounts allowed).
Refunds pay out of the open drawer — verify it's open first.

**Day close** — Z-report (`/dashboard/reports/z-report`): settled sales by
method, comps, drawer variances. Print it. If it reconciles, the day worked.

## Kitchen

**KDS wall** (`/dashboard/kitchen/display`): tickets arrive live (2s poll +
socket push). `Bump [n]` advances a ticket (keys 1–9 work as a bump bar).
Fire / Hold / Release control courses. SLA breaches banner at the top —
overdue tickets get a red border and age badge.

**86 in one tap** — Pick the item (not an ID you type from memory), confirm,
done. Servers stop seeing it immediately. `Undo 86` restores it if stock
recovers. Allergens detected in line text show as red badges on the ticket.

**Station filter** scrolls — no station is ever silently dropped.

## Manager / owner

**Morning** — Dashboard: signals first (SLA breaches, long tables,
low stock), then the floor. Staff: clock-in, breaks, PINs.

**Money questions** — Adjustments card on any order (who discounted, what
gratuity, voided/comped lines). Audit log (`Money → Audit log`): every void,
comp, discount, payment, refund, split and cash move with actor and time —
filter by event or search an order/user/reason. Z-report for the day.

**Venue settings** — Settings → Store profile: tax % (server-side, applied
via `order.applyTax` — the number on the guest check is stamped by the
server, never by the tablet), gratuity %, cash rounding, kitchen SLA, receipt
footer. Gratuity is applied per check with `Add gratuity` — it is a recorded
tip, not silent math. Modules tab toggles capabilities; solo mode collapses
nav for one-person shifts.

**Shortcuts** — Press `?` anywhere for the overlay. `Ctrl+K` searches
everything. `G O / G T / G K / G M / G R / G I / G D / G S` jump screens.

**Offline** — The header shows connection + queued changes. Keep selling; the
queue replays in order. Rejected replays land in Needs Attention — never
assume a queued change landed until the badge clears.
