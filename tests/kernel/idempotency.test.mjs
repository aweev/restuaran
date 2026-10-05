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

describe("command idempotency via requestId", () => {
  it("dispatching the same requestId twice returns the same commandId with a single payment", async () => {
    const tenant = newTenant({ orgId: "org-idem", venueId: "venue-idem" });
    const admin = systemActor({ userId: "u-admin" });
    const kernel = createKernel({ tenant });
    await bootKernel(kernel, { socket: null });

    await kernel.execute("order.create", { orderId: "o-idem", channel: "pos" }, admin);
    await kernel.execute("order.addLine", { orderId: "o-idem", menuItemId: "m1", name: "Pizza", unitPrice: 20, quantity: 1 }, admin);

    const requestId = "req-pay-1";
    const first = await kernel.execute("order.recordPayment", { orderId: "o-idem", method: "card", amount: 20 }, admin, requestId);
    const second = await kernel.execute("order.recordPayment", { orderId: "o-idem", method: "card", amount: 20 }, admin, requestId);

    assert.equal(first.success, true);
    assert.equal(second.success, true);
    assert.equal(first.commandId, second.commandId);

    const q = await kernel.ask("get.order", { orderId: "o-idem" }, admin);
    assert.equal(q.success, true);
    assert.equal(q.data.state.payments.length, 1);
    await kernel.shutdown();
  });
});
