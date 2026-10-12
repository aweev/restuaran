# Testing

## Fast gates (run these before every commit)

```bash
npm run typecheck        # tsc --noEmit — must be clean
npm run kernel:typecheck # kernel in isolation
npm run test:kernel      # 33 tests, 12 suites — aggregates, projections,
                         # idempotency, authz, section scope, tax, cash drawer…
npm run verify:sql       # schema/seed consistency, no DB needed
npm run build            # production build must succeed
```

## Manual QA — the Friday-service checklist

Do this on a tablet, with greasy-hand honesty, before any release:

1. Register → Settings (tax 8.5%, gratuity, rounding) → save, refresh, confirm
   it persisted (server-side, not a toast lie).
2. Menu CSV import → 86 one item → confirm it vanishes from order-taking.
3. New Order → tap-add 3 items → Park → resume from Orders → ⏸ Parked.
4. Fire → Bump on KDS (`Bump [1]`, keys 1–9) → 86 from KDS → Undo 86.
5. Split 2 ways (equal + by-seat) → pay seat 1 → reload → confirm seat 1 is
   still paid and the balance can't be over-collected.
6. Cash payment with tendered > total → change due correct (rounded if the
   venue rounds) → receipt prints (PDF + thermal).
7. Card payment with no terminal → form demands the slip reference.
8. Void with reason → reason in Audit log; refund partial → drawer math holds.
9. Cash: open → payout with reason → close with count → variance 0; close with
   nonzero variance and no reason must block.
10. Z-report prints; settled-by-method matches the drawer.
11. Offline: kill network mid-order → queue badge counts → reconnect → badge
    clears; any rejection lands in Needs Attention, nothing vanishes silently.
12. `Fire again` on the closed check → new draft with the same lines.

## Smoke scripts

- `npm run kernel:smoke` — end-to-end kernel exercise (orders, splits,
  transfers, tax, 86, payments).
- `scripts/verify-supabase.cjs` — live-DB verification (needs `DATABASE_URL`).
- Playwright: `tests/smoke.spec.ts` (login → order → kitchen → payment).
