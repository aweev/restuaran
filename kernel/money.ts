/**
 * Integer-cents money helpers: public API stays in dollars, math runs in cents.
 *
 * Rounding policy (do not change without a migration + test update):
 * - Every monetary input is rounded to cents on entry (half-up via Math.round).
 * - Percent discounts/tax: computed on integer cents, rounded once (half-up).
 * - Order total = subtotal − discountTotal + taxTotal + tipTotal, all in cents.
 * - `close()` tolerates +0.1¢ float dust only on the legacy NUMERIC path;
 *   kernel cents must balance exactly.
 */
export function toCents(n: number): number {
  return Math.round(n * 100)
}

export function fromCents(c: number): number {
  return Math.round(c) / 100
}

export function round2(n: number): number {
  return fromCents(toCents(n))
}

export function addCents(...cents: number[]): number {
  return cents.reduce((s, c) => s + Math.round(c), 0)
}

export function mulCents(cents: number, qty: number): number {
  return Math.round(cents) * qty
}

export function percentCents(subtotalCents: number, percent: number): number {
  return Math.round((subtotalCents * percent) / 100)
}
