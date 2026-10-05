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

describe("venue fiscal configuration", () => {
  it("tax rate persists as kernel events and validates bounds", async () => {
    const tenant = newTenant({ orgId: "org-tax", venueId: "venue-tax" });
    const kernel = createKernel({ tenant });
    await bootKernel(kernel, { socket: null });
    const admin = systemActor({ userId: "adm" });

    const created = await kernel.execute(
      "venue.create", { venueId: "v-tax", name: "Test Venue", currency: "USD", taxRate: 0.085 }, admin,
    );
    assert.equal(created.success, true);

    const bad = await kernel.execute("venue.configureTax", { venueId: "v-tax", taxRate: 2 }, admin);
    assert.equal(bad.success, false);

    const ok = await kernel.execute("venue.configureTax", { venueId: "v-tax", taxRate: 0.09 }, admin);
    assert.equal(ok.success, true);

    const board = await kernel.ask("list.venues", {}, admin);
    assert.equal(board.success, true);
    const row = board.data.rows?.find?.((v) => v.id === "v-tax") ?? board.data.find?.((v) => v.id === "v-tax");
    assert.ok(row, "venue row present on the board");
    assert.equal(row.taxRate, 0.09);
    await kernel.shutdown();
  });

  it("server-side order tax uses the configured rate", async () => {
    const tenant = newTenant({ orgId: "org-tax2", venueId: "venue-tax2" });
    const kernel = createKernel({ tenant });
    await bootKernel(kernel, { socket: null });
    const admin = systemActor({ userId: "adm" });
    // Create venue with tax rate first
    await kernel.execute("venue.create", { venueId: "venue-tax2", name: "Test", currency: "USD", taxRate: 0.085 }, admin);
    await kernel.execute("order.create", { orderId: "o-tax", channel: "pos", serverId: "s1" }, admin);
    await kernel.execute(
      "order.addLine", { orderId: "o-tax", menuItemId: "m1", name: "Burger", unitPrice: 10, quantity: 1 },
      admin,
    );
    const taxed = await kernel.execute("order.applyTax", { orderId: "o-tax" }, admin);
    assert.equal(taxed.success, true);
    const order = await kernel.ask("get.order", { orderId: "o-tax" }, admin);
    assert.equal(order.success, true);
    assert.equal(order.data.state.taxTotal, 0.85);
    await kernel.shutdown();
  });
});
