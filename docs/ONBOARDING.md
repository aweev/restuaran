# Onboard a Restaurant in Under a Day

One manager, one laptop, no training manual. Half a day if the paper menu is ready.

## 1. Create accounts (15 min)

1. Register the manager at `/register`, then open **Staff** and confirm the
   roster loads from `/api/staff`.
2. For every teammate who shares a device: **Staff → PIN → Set PIN**
   (4–6 digits). They sign in at `/login` with **email + PIN**
   (fast path) or email + password.
3. Cooks land on the KDS wall, cashiers on the drawer, servers on the floor —
   no navigation lesson needed.

## 2. Venue in Settings (15 min)

**Settings → Store profile**: name, currency, **tax %** (stored server-side,
applied via `order.applyTax` — never a hardcoded rate), tables, kitchen SLA,
receipt footer, support contact (shown on the login screen for mid-service
help). **Devices tab**: LAN print-service endpoint (empty = tablet print
dialog).

## 3. Menu import (30 min)

**Menu → Import CSV**: one `name, price` per line, straight from the paper
menu (paste from a spreadsheet or upload `.csv`/`.txt`). Invalid lines are
skipped and reported. Then per item: **Price** edits inline (2 taps),
**Available** switch 86's it, **Remove** 86's it (reversible — history stays).

## 4. Tables + trial service (1–2 h)

Add tables on the floor page, run a trial: take an order on handheld
(`Fire to Kitchen`), bump it on the KDS, split the bill 2 ways, take cash,
**close the drawer** with a count, and print the **Day Close**.
Variance must be 0 with every step explained — that is the go-live gate.

## 5. Open for real

Day Close is the owner's receipt: settled sales by method, comps count,
drawer variances with reasons. If Day Close reconciles on trial day, open
tomorrow. Support contact is on the login screen; queued offline work shows
as a badge, never silent.
