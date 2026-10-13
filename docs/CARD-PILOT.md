# Card Pilot Runbook (Stripe Terminal, one venue)

Cash and manual cards run the venue today. This is how the first live-card
venue goes live without risking Friday service.

## Modes (`ROS_PAYMENT_PROVIDER`)

| Value | Behaviour |
|---|---|
| `manual` (default) | Authorize/capture always succeed locally; the cashier records the slip/reference. No gateway touched. |
| `simulated-stripe` | Same flow, returns `pi_sim_*` refs. Rehearse the pilot here. |
| `stripe-terminal` | Requires `STRIPE_SECRET_KEY`. Real money moves. |

The checkout screen shows which mode is live (`get.paymentProvider`), so a
cashier can never mistake simulated for real.

## Rehearsal (simulated, 1 day)

1. Set `ROS_PAYMENT_PROVIDER=simulated-stripe`, restart, confirm the banner
   reads SIMULATED on the payment form.
2. Run 20 mixed orders (cash / credit / split / refund) and close the day.
   Day Close must reconcile; refunds must show as drawer payouts with reasons.
3. Kill the network mid-order twice: queue badge appears, reconnect syncs
   with zero dupes (stable `requestId`s).

## Pilot (terminal, 1 terminal, off-peak)

1. Set `ROS_PAYMENT_PROVIDER=stripe-terminal` + `STRIPE_SECRET_KEY`,
   restart, confirm the banner reads terminal-connected.
2. Off-peak only, manager present, cash fallback ready. First 10 card
   payments are watched: authorize → capture → `order.recordPayment` →
   auto-close.
3. Declines: `PAYMENT_DECLINED` surfaces on the form; the order stays open
   and payable by cash. Never void-and-re-ring to "fix" a decline.
4. End of pilot day: compare Stripe dashboard payouts vs Day Close card
   totals. They must match to the cent before week two.

## Rollback

Unset `ROS_PAYMENT_PROVIDER` (or set `manual`), restart — 30 seconds, no
data migration. Card intents already captured stay valid in Stripe.
