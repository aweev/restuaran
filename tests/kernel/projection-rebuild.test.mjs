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

describe("projection rebuild determinism", () => {
  it("applying the same events twice yields the same state", async () => {
    const tenant = newTenant({ orgId: "org-det", venueId: "venue-det" });
    const admin = systemActor({ userId: "u-admin" });
    const kernel = createKernel({ tenant });
    await bootKernel(kernel, { socket: null });

    await kernel.execute("order.create", { orderId: "o-det", channel: "pos" }, admin);
    await kernel.execute("order.addLine", { orderId: "o-det", menuItemId: "m1", name: "Burger", unitPrice: 12, quantity: 2 }, admin);
    await kernel.execute("order.applyDiscount", { orderId: "o-det", kind: "amount", value: 4 }, admin);
    await kernel.execute("order.applyTax", { orderId: "o-det", rate: 0.1 }, admin);

    await kernel.projections.rebuildAll();
    const first = JSON.stringify(kernel.projections.get("orders.board").state);

    // Rebuild again over the same event log: must converge to identical state.
    await kernel.projections.rebuildAll();
    const second = JSON.stringify(kernel.projections.get("orders.board").state);

    assert.equal(first, second);
    const row = kernel.projections.get("orders.board").state.rows.find((r) => r.orderId === "o-det");
    assert.ok(row);
    assert.equal(row.subtotal, 24);
    await kernel.shutdown();
  });
});
