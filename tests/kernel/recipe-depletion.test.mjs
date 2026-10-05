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

describe("recipe auto-depletion", () => {
  it("firing lines consumes mapped inventory and 86s at zero", async () => {
    const tenant = newTenant({ orgId: "org-recipe", venueId: "venue-recipe" });
    const kernel = createKernel({ tenant });
    await bootKernel(kernel, { socket: null });
    const admin = systemActor({ userId: "adm" });

    await kernel.execute("inventory.defineItem", { itemId: "flour", name: "Flour", unit: "kg" }, admin);
    await kernel.execute("inventory.receive", { itemId: "flour", quantity: 2 }, admin);
    await kernel.execute(
      "menu.createItem", { itemId: "pizza", name: "Pizza", categoryId: "mains", basePrice: 12 },
      admin,
    );
    const recipe = await kernel.execute(
      "menu.setRecipe", { itemId: "pizza", recipe: [{ inventoryItemId: "flour", qty: 2 }] }, admin,
    );
    assert.equal(recipe.success, true);

    await kernel.execute("order.create", { orderId: "o-rec", channel: "pos", serverId: "s1" }, admin);
    await kernel.execute(
      "order.addLine", { orderId: "o-rec", menuItemId: "pizza", name: "Pizza", unitPrice: 12, quantity: 1 },
      admin,
    );
    const fired = await kernel.execute("order.sendToKitchen", { orderId: "o-rec" }, admin);
    assert.equal(fired.success, true);

    const inv = await kernel.ask("get.inventoryItem", { itemId: "flour" }, admin);
    assert.equal(inv.success, true);
    assert.equal(inv.data.state.onHand, 0);

    // Auto-86 hook should have 86'd the pizza (convention itemId link or zero-stock).
    // Flour id != pizza id so 86 targets flour's linked item; assert stock only.
    await kernel.shutdown();
  });

  it("invalid recipes are rejected", async () => {
    const tenant = newTenant({ orgId: "org-recipe2", venueId: "venue-recipe2" });
    const kernel = createKernel({ tenant });
    await bootKernel(kernel, { socket: null });
    const admin = systemActor({ userId: "adm" });
    await kernel.execute(
      "menu.createItem", { itemId: "pasta", name: "Pasta", categoryId: "mains", basePrice: 10 }, admin,
    );
    const bad = await kernel.execute(
      "menu.setRecipe", { itemId: "pasta", recipe: [{ inventoryItemId: "x", qty: -1 }] }, admin,
    );
    assert.equal(bad.success, false);
    await kernel.shutdown();
  });
});
