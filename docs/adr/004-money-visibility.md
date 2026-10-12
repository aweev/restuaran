# ADR-004: Money visibility without ledger risk

Date: 2026-10-12 · Status: Accepted

## Context
The kernel recorded every financial event (with actors) but no screen showed
it; gratuity was configured but never charged; cash rounding didn't exist;
drafts were invisible. Staff answered money questions from memory.

## Decision
1. **AuditLog reader** (`GET /api/audit`, `audit:view`): the kernel hook stays
   the writer; the screen is a filterable reader. Fails closed (503), never an
   empty list implying innocence.
2. **Cash rounding is device-local** (`VenueSettings.roundingIncrement`): tender
   and change round; ledger and cards stay exact. Encoding rounding in events
   would corrupt settled reports — hence not a `venue.*` command.
3. **Gratuity is an explicit `order.addTip`** per check, not silent math: the
   rate is venue policy, the charge is an audited event.
4. **Parked = draft, labeled**: no new state machine; the Orders tabs and Park
   button name what already existed.

## Consequences
- Money questions resolve in one screen (audit log) or one card (trail).
- Rounding changes never touch settled buckets; Z-report stays exact.
- A future per-line seat-transfer model can reuse the itemized split UI.
