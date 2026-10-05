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

const ownOnly = (id) => ({ userId: id, roles: ["server"], permissions: ["order:create", "order:edit_own", "order:view"] });

describe("server-section scoping", () => {
  it("edit_own actor can edit their own ticket but not another server's", async () => {
    const tenant = newTenant({ orgId: "org-sec", venueId: "venue-sec" });
    const kernel = createKernel({ tenant });
    await bootKernel(kernel, { socket: null });
    const alice = ownOnly("alice");
    const bob = ownOnly("bob");

    await kernel.execute("order.create", { orderId: "o-alice", channel: "pos", serverId: "alice" }, alice);
    const mine = await kernel.execute(
      "order.addLine", { orderId: "o-alice", menuItemId: "m1", name: "Soup", unitPrice: 9, quantity: 1 }, alice,
    );
    assert.equal(mine.success, true);

    const theirs = await kernel.execute(
      "order.addLine", { orderId: "o-alice", menuItemId: "m1", name: "Soup", unitPrice: 9, quantity: 1 }, bob,
    );
    assert.equal(theirs.success, false);
    assert.equal(theirs.error.code, "FORBIDDEN");

    // Manager (order:edit) passes on any ticket.
    const mgr = systemActor({ userId: "mgr" });
    const mgrRes = await kernel.execute(
      "order.addLine", { orderId: "o-alice", menuItemId: "m1", name: "Soup", unitPrice: 9, quantity: 1 }, mgr,
    );
    assert.equal(mgrRes.success, true);
    await kernel.shutdown();
  });

  it("actor without any edit capability is rejected by the handler", async () => {
    const tenant = newTenant({ orgId: "org-sec2", venueId: "venue-sec2" });
    const kernel = createKernel({ tenant });
    await bootKernel(kernel, { socket: null });
    const admin = systemActor({ userId: "adm" });
    await kernel.execute("order.create", { orderId: "o-x", channel: "pos" }, admin);
    const kds = { userId: "kds", roles: ["kitchen"], permissions: ["order:view", "order:process"] };
    const res = await kernel.execute(
      "order.addLine", { orderId: "o-x", menuItemId: "m1", name: "Soup", unitPrice: 9, quantity: 1 }, kds,
    );
    assert.equal(res.success, false);
    assert.equal(res.error.code, "FORBIDDEN");
    await kernel.shutdown();
  });
});
