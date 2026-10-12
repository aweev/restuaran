# Troubleshooting — mid-service first aid

## Can't sign in

- Wrong password and unknown address fail identically (on purpose). Check the
  address spelling first.
- Repeated failures rate-limit for 15 min — wait, don't keep guessing.
- Fresh database with no seed fails every login: run `db/schema.sql`,
  `kernel/event-store/schema.sql`, then `db/seed.sql`. Seed accounts use
  `pos1234`.
- PIN login needs a PIN set by a manager (Staff → PIN) first.

## Screen shows stale / wrong data

- Look at the header: `Live` vs `Offline demo` / queued-count badge. Offline
  boards are marked — trust the badge, not your memory.
- Queued changes replay in order on reconnect. If a replay is rejected (double
  seat, 86'd line), it lands in **Needs Attention** — open it, don't re-tap
  blindly or you'll double-order.
- `VERSION_CONFLICT` opens a dialog showing the latest server state: Retry
  (your change on top of latest) or Reload (take theirs).

## Payments

- "Terminal reference required": no card gateway is connected
  (`ROS_PAYMENT_PROVIDER=manual`). Enter the slip/auth code, or set up the
  terminal per `CARD-PILOT.md`.
- Amount can't exceed remaining balance — split seats show per-seat dues;
  reload never loses paid seats.
- Refund needs an open drawer and a reason; partial refunds allowed up to paid.

## Kitchen

- Ticket not on KDS: tickets poll every 2s — wait one beat, then Refresh
  (it re-mounts the grid; it never fakes data). Check the station filter —
  it scrolls, the ticket may be under another station.
- Wrong item 86'd: `Undo 86` on the KDS restores it instantly.

## Cash / close

- Close blocked: counted cash missing, or nonzero variance without a reason.
  Both are deliberate — write the reason.
- Z-report shows $0 with orders on the floor: it counts *settled* (closed)
  orders only. Unpaid checks are not revenue.

## Printing

- "Print blocked / queued": the browser blocked the popup — allow popups for
  the POS host, then retry. For LAN printers set Settings → Devices →
  print-service endpoint.

## PWA / tablets

- After a deploy, relaunch the app on each tablet (service worker updates on
  launch). Login shows the build tag — every tablet must match. Fleet list in
  Settings → Devices flags stale/silent devices.

## Data & backups

- Never `DELETE` event rows. Restore from `pg_dump` (`OPERATING.md`), the
  kernel rebuilds projections on boot. AuditLog is append-only evidence.
