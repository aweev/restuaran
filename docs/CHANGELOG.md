# Changelog

## Unreleased (main)

- **Audit log screen** — `GET /api/audit` + Money → Audit log: every void,
  comp, discount, payment, refund, split and cash move with actor and time.
- **Cash rounding** — venue increment (exact/nickel/dime/quarter/whole);
  change-due and receipts round cash while ledger and cards stay exact.
- **Parked checks** — Parked/Served/Voided tabs, Park button on New Order.
- **Venue gratuity** — `Add gratuity` at the configured rate (`order.addTip`).
- **Adjustments trail** — per-order discount ledger (who/why), tips, void/comp
  counts from `get.order`.
- **Fire again** — closed checks clone into a new draft.
- **Itemized splits** — by-seat line assignment with proportional tax/discount,
  persisted seat state, remaining-balance guards.
- **Fail-closed cards** — slip reference required without a live terminal.
- Touch targets ≥44px on order flows, KDS, handheld; AlertDialog voids/refunds
  with reasons; cash close confirm with UUID idempotency; KDS menu-picker 86
  with undo; `handheld` channel typed.

## Prior

- Kernel-first migration (contexts via `useCommand`/`useProjection`), offline
  queue with Needs-Attention rejections, server-side tax stamping, RBAC nav,
  signal dashboard, setup wizard with menu CSV import, Z-report from settled
  buckets, Stripe Terminal provider behind `ROS_PAYMENT_PROVIDER`.
- See `GAP-ANALYSIS.md` / `CRITICAL-REVIEW.md` for the historical audits that
  drove this work (context, not current state).
