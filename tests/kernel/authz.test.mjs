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

describe("server authorization boundary", () => {
  it("a server without order:comp cannot comp a line", async () => {
    const tenant = newTenant({ orgId: "org-authz", venueId: "venue-authz" });
    const admin = systemActor({ userId: "u-admin" });
    const server = { userId: "u-srv", roles: ["server"], permissions: ["order:create", "order:edit", "order:view"] };
    const kernel = createKernel({ tenant });
    await bootKernel(kernel, { socket: null });

    await kernel.execute("order.create", { orderId: "o-authz", channel: "pos" }, admin);
    const lr = await kernel.execute("order.addLine", { orderId: "o-authz", menuItemId: "m1", name: "Steak", unitPrice: 30, quantity: 1 }, admin);
    const lineId = lr.events[0].payload.line.lineId;

    const denied = await kernel.execute("order.compLine", { orderId: "o-authz", lineId }, server);
    assert.equal(denied.success, false);
    assert.equal(denied.error.code, "FORBIDDEN");

    const allowed = await kernel.execute("order.compLine", { orderId: "o-authz", lineId, reason: "VIP" }, admin);
    assert.equal(allowed.success, true);
    await kernel.shutdown();
  });
});
