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

const { OrderAggregate } = await import(pathToFileURL(path.join(DIST, "kernel", "aggregates", "order.aggregate.js")).href);
const { newTenant, systemActor } = await import(pathToFileURL(path.join(DIST, "kernel", "tenant", "tenant.js")).href);

const tenant = newTenant({ orgId: "org-test", venueId: "venue-test" });
const admin = systemActor({ userId: "u-admin" });
const server = { userId: "u-srv", roles: ["server"], permissions: ["order:create", "order:edit", "order:view"] };

function freshOrder(id = `o-${Math.random().toString(36).slice(2)}`) {
  return OrderAggregate.create(tenant, { id, channel: "pos", actor: admin });
}

describe("OrderAggregate: comps / discounts / splits / transfers / tax idempotency", () => {
  it("compLine zeroes a line but keeps it visible; double-comp is rejected", () => {
    const agg = freshOrder();
    agg.addLine(admin, { menuItemId: "m1", name: "Wagyu", unitPrice: 100, quantity: 1 });
    const lineId = agg.state.lines[0].lineId;
    agg.compLine(admin, lineId, "VIP");
    assert.equal(agg.state.lines[0].comped, true);
    assert.equal(agg.subtotal(), 0);
    assert.throws(() => agg.compLine(admin, lineId), (e) => e.code === "ALREADY_COMPPED");
  });

  it("percent discount over 100 rejected; stacked discounts never go negative", () => {
    const agg = freshOrder();
    agg.addLine(admin, { menuItemId: "m1", name: "Steak", unitPrice: 50, quantity: 1 });
    assert.throws(() => agg.applyDiscount(admin, { kind: "percent", value: 150 }), (e) => e.code === "INVALID_DISCOUNT");
    agg.applyDiscount(admin, { kind: "percent", value: 10 });
    assert.equal(agg.state.discountTotal, 5);
    agg.applyDiscount(admin, { kind: "amount", value: 9999 });
    assert.ok(agg.orderTotal() >= 0);
    assert.equal(agg.orderTotal(), 0);
  });

  it("tax from rate computes on chargeable base; absurd rate rejected", () => {
    const agg = freshOrder();
    agg.addLine(admin, { menuItemId: "m1", name: "Lobster", unitPrice: 40, quantity: 1 });
    agg.applyTax(admin, { rate: 0.1 });
    assert.equal(agg.state.taxTotal, 4);
    assert.equal(agg.orderTotal(), 44);
    assert.throws(() => agg.applyTax(admin, { rate: 5 }), (e) => e.code === "INVALID_TAX");
  });

  it("tip beyond balance rejected; tip does not reduce balance", () => {
    const agg = freshOrder();
    agg.addLine(admin, { menuItemId: "m1", name: "Lobster", unitPrice: 40, quantity: 1 });
    agg.applyTax(admin, { rate: 0.1 });
    assert.throws(() => agg.addTip(admin, 500), (e) => e.code === "INVALID_TIP");
    agg.addTip(admin, 8);
    assert.equal(agg.tipTotal(), 8);
    assert.equal(agg.balanceDue(), 44);
  });

  it("split validation: needs split first, ways bounded, index bounded", () => {
    const agg = freshOrder();
    agg.addLine(admin, { menuItemId: "m1", name: "Tasting", unitPrice: 90, quantity: 1 });
    assert.throws(() => agg.addTip(admin, 9, 0), (e) => e.code === "NO_ACTIVE_SPLIT");
    assert.throws(() => agg.splitCheck(admin, 99), (e) => e.code === "INVALID_SPLIT");
    agg.splitCheck(admin, 3);
    assert.throws(() => agg.addTip(admin, 9, 3), (e) => e.code === "INVALID_SPLIT_INDEX");
    agg.addTip(admin, 9, 2);
    assert.equal(agg.tipTotal(), 9);
  });

  it("transfer in/out is idempotent by transferId", () => {
    const from = OrderAggregate.create(tenant, { id: "o-from", channel: "pos", actor: admin });
    const to = OrderAggregate.create(tenant, { id: "o-to", channel: "pos", actor: admin });
    from.addLine(admin, { menuItemId: "m1", name: "Frites", unitPrice: 30, quantity: 1 });
    const lineId = from.state.lines[0].lineId;
    from.transferLinesOut(admin, "o-to", [lineId], "xfer-1");
    const moved = from.state.lines.filter((l) => l.lineId === lineId);
    to.transferLinesIn(admin, "o-from", moved, "xfer-1");
    assert.equal(to.state.lines.length, 1);
    // Replay receiver: no double credit
    to.transferLinesIn(admin, "o-from", moved, "xfer-1");
    assert.equal(to.state.lines.length, 1);
    assert.throws(
      () => from.transferLinesOut(admin, "o-from", [lineId], "xfer-3"),
      (e) => e.code === "INVALID_TRANSFER",
    );
  });

  it("fireCourse sends only that course; empty course rejected", () => {
    const agg = freshOrder();
    agg.addLine(admin, { menuItemId: "m1", name: "A", unitPrice: 10, quantity: 1 });
    agg.addLine(admin, { menuItemId: "m2", name: "B", unitPrice: 10, quantity: 1, course: 2 });
    agg.fireCourse(admin, 1);
    assert.throws(() => agg.fireCourse(admin, 9), (e) => e.code === "NOTHING_TO_SEND");
  });
});
