import { describe, it } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import Module from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(__dirname, "..", "..", "dist");
const origResolve = Module._resolveFilename;
Module._resolveFilename = function (request, ...args) {
  if (request.startsWith("@/")) request = path.join(DIST, request.slice(2));
  return origResolve.call(this, request, ...args);
};

const { createKernel, bootKernel } = await import(pathToFileURL(path.join(DIST, "kernel", "index.js")).href);
const { newTenant, systemActor } = await import(pathToFileURL(path.join(DIST, "kernel", "tenant", "tenant.js")).href);

describe("cash drawer sessions", () => {
  it("open → noteSale (idempotent) → payout → close computes server-side expected/variance", async () => {
    const tenant = newTenant({ orgId: "org-cash", venueId: "venue-cash" });
    const admin = systemActor({ userId: "u-cashier" });
    const kernel = createKernel({ tenant });
    await bootKernel(kernel, { socket: null });

    const opened = await kernel.execute("cash.open", { sessionId: "s1", startingFloat: 100 }, admin, "cash-open-1");
    assert.equal(opened.success, true);

    const dup = await kernel.execute("cash.open", { sessionId: "s2", startingFloat: 50 }, admin, "cash-open-2");
    assert.equal(dup.success, false);
    assert.equal(dup.error.code, "SESSION_ALREADY_OPEN");

    const sale1 = await kernel.execute("cash.noteSale", { sessionId: "s1", paymentId: "p1", amount: 20 }, admin, "cash-sale:p1");
    assert.equal(sale1.success, true);
    // Idempotent replay: same paymentId records once.
    const sale1b = await kernel.execute("cash.noteSale", { sessionId: "s1", paymentId: "p1", amount: 20 }, admin, "cash-sale:p1b");
    assert.equal(sale1b.success, true);

    const payout = await kernel.execute("cash.payout", { sessionId: "s1", amount: 5, reason: "mint" }, admin);
    assert.equal(payout.success, true);

    const noReason = await kernel.execute("cash.payout", { sessionId: "s1", amount: 1, reason: "" }, admin);
    assert.equal(noReason.success, false);

    // expected = 100 + 20 − 5 = 115. Count 115 → variance 0, no reason needed.
    const closed = await kernel.execute("cash.close", { sessionId: "s1", countedCash: 115 }, admin, "cash-close-s1");
    assert.equal(closed.success, true);

    const board = kernel.projections.get("cash.board");
    const session = board.state.sessions.find((s) => s.sessionId === "s1");
    assert.equal(session.cashSales, 20);
    assert.equal(session.expected, 115);
    assert.equal(session.variance, 0);
    assert.equal(board.state.currentId, null);

    // Closed sessions are immutable.
    const late = await kernel.execute("cash.payout", { sessionId: "s1", amount: 1, reason: "late" }, admin);
    assert.equal(late.success, false);
    await kernel.shutdown();
  });

  it("nonzero variance requires a reason", async () => {
    const tenant = newTenant({ orgId: "org-cash2", venueId: "venue-cash2" });
    const admin = systemActor({ userId: "u-cashier" });
    const kernel = createKernel({ tenant });
    await bootKernel(kernel, { socket: null });

    await kernel.execute("cash.open", { sessionId: "s9", startingFloat: 0 }, admin);
    const short = await kernel.execute("cash.close", { sessionId: "s9", countedCash: 5 }, admin);
    assert.equal(short.success, false);
    assert.equal(short.error.code, "VARIANCE_REASON_REQUIRED");

    const ok = await kernel.execute("cash.close", { sessionId: "s9", countedCash: 5, varianceReason: "walkout" }, admin);
    assert.equal(ok.success, true);
    await kernel.shutdown();
  });

  it("sales.board tracks payments by method and comps", async () => {
    const tenant = newTenant({ orgId: "org-cash3", venueId: "venue-cash3" });
    const admin = systemActor({ userId: "u-admin" });
    const kernel = createKernel({ tenant });
    await bootKernel(kernel, { socket: null });

    await kernel.execute("order.create", { orderId: "o-cash", channel: "pos" }, admin);
    await kernel.execute("order.addLine", { orderId: "o-cash", menuItemId: "m1", name: "Soup", unitPrice: 10, quantity: 1 }, admin);
    await kernel.execute("order.recordPayment", { orderId: "o-cash", method: "cash", amount: 10 }, admin);
    await kernel.execute("order.close", { orderId: "o-cash" }, admin);

    const sales = kernel.projections.get("sales.board");
    const day = new Date().toISOString().slice(0, 10);
    const bucket = sales.state.buckets.find((b) => b.date === day);
    assert.ok(bucket);
    assert.equal(bucket.byMethod.cash, 10);
    await kernel.shutdown();
  });

  it("get.paymentProvider reports the live card mode honestly", async () => {
    const tenant = newTenant({ orgId: "org-cash4", venueId: "venue-cash4" });
    const admin = systemActor({ userId: "u-admin" });
    const kernel = createKernel({ tenant });
    await bootKernel(kernel, { socket: null });

    const q = await kernel.ask("get.paymentProvider", {}, admin);
    assert.equal(q.success, true);
    assert.equal(q.data.provider, "manual");
    assert.equal(q.data.liveCards, false);
    assert.match(q.data.hint, /Manual/);
    await kernel.shutdown();
  });
});
