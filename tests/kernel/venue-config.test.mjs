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

async function boot(orgId, venueId) {
  const tenant = newTenant({ orgId, venueId });
  const kernel = createKernel({ tenant });
  await bootKernel(kernel, { socket: null });
  return { kernel, admin: systemActor({ userId: "adm" }) };
}

function boardRow(board, id) {
  const rows = board.data.rows ?? board.data;
  return rows.find((v) => v.id === id);
}

describe("venue progressive-disclosure config", () => {
  it("create carries soloMode + enabledModules and the board reflects them", async () => {
    const { kernel, admin } = await boot("org-vc", "venue-vc");
    const created = await kernel.execute(
      "venue.create",
      { venueId: "v-solo", name: "Solo Truck", soloMode: true, enabledModules: ["pos", "tables", "kitchen"] },
      admin,
    );
    assert.equal(created.success, true);

    const board = await kernel.ask("list.venues", {}, admin);
    assert.equal(board.success, true);
    const row = boardRow(board, "v-solo");
    assert.ok(row, "venue row present");
    assert.equal(row.soloMode, true);
    assert.deepEqual(row.enabledModules, ["pos", "tables", "kitchen"]);
    await kernel.shutdown();
  });

  it("defaults preserve full-restaurant behavior", async () => {
    const { kernel, admin } = await boot("org-vc2", "venue-vc2");
    await kernel.execute("venue.create", { venueId: "v-full", name: "Full House" }, admin);
    const board = await kernel.ask("list.venues", {}, admin);
    const row = boardRow(board, "v-full");
    assert.equal(row.soloMode, false);
    assert.equal(row.enabledModules, null);
    await kernel.shutdown();
  });

  it("update toggles disclosure state", async () => {
    const { kernel, admin } = await boot("org-vc3", "venue-vc3");
    await kernel.execute("venue.create", { venueId: "v-toggle", name: "Toggle" }, admin);
    const updated = await kernel.execute(
      "venue.update",
      { venueId: "v-toggle", soloMode: true, enabledModules: ["pos"] },
      admin,
    );
    assert.equal(updated.success, true);
    const board = await kernel.ask("list.venues", {}, admin);
    const row = boardRow(board, "v-toggle");
    assert.equal(row.soloMode, true);
    assert.deepEqual(row.enabledModules, ["pos"]);

    const cleared = await kernel.execute(
      "venue.update",
      { venueId: "v-toggle", soloMode: false, enabledModules: null },
      admin,
    );
    assert.equal(cleared.success, true);
    const board2 = await kernel.ask("list.venues", {}, admin);
    const row2 = boardRow(board2, "v-toggle");
    assert.equal(row2.soloMode, false);
    assert.equal(row2.enabledModules, null);
    await kernel.shutdown();
  });

  it("validation rejects malformed disclosure config", async () => {
    const { kernel, admin } = await boot("org-vc4", "venue-vc4");
    await kernel.execute("venue.create", { venueId: "v-bad", name: "Bad" }, admin);
    const badSolo = await kernel.execute("venue.update", { venueId: "v-bad", soloMode: "yes" }, admin);
    assert.equal(badSolo.success, false);
    const badMods = await kernel.execute("venue.update", { venueId: "v-bad", enabledModules: "pos" }, admin);
    assert.equal(badMods.success, false);
    const badEntry = await kernel.execute("venue.update", { venueId: "v-bad", enabledModules: [""] }, admin);
    assert.equal(badEntry.success, false);
    const tooMany = await kernel.execute(
      "venue.update",
      { venueId: "v-bad", enabledModules: Array.from({ length: 21 }, (_, i) => `m${i}`) },
      admin,
    );
    assert.equal(tooMany.success, false);
    await kernel.shutdown();
  });
});
