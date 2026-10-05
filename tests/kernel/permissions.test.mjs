import { describe, it } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(__dirname, "..", "..", "dist");

const { deriveCapabilities, actorFromAuthPayload } = await import(
  pathToFileURL(path.join(DIST, "kernel", "tenant", "permission-map.js")).href
);

describe("role/capability derivation", () => {
  it("bartender and delivery roles derive working capabilities", () => {
    const bar = deriveCapabilities({ sub: "u-bar", role: "bartender" });
    for (const c of ["order:create", "order:view", "order:pay", "table:view", "menu:view"]) {
      assert.ok(bar.includes(c), `bartender missing ${c}`);
    }
    assert.ok(!bar.includes("order:comp"), "bartender must not comp");

    const del = deriveCapabilities({ sub: "u-del", role: "delivery" });
    for (const c of ["order:view", "order:process", "table:view"]) {
      assert.ok(del.includes(c), `delivery missing ${c}`);
    }
    assert.ok(!del.includes("order:pay"), "delivery must not take payment");
    assert.ok(!del.includes("order:comp"), "delivery must not comp");
  });

  it("report permissions map to the sales-board capability", () => {
    const caps = deriveCapabilities({ sub: "u-rep", role: "staff", permissions: ["report:view", "report:export"] });
    assert.ok(caps.includes("order:view"));
  });

  it("unknown roles derive nothing (fail closed)", () => {
    assert.deepEqual(deriveCapabilities({ sub: "u-x", role: "nope" }), []);
  });

  it("actorFromAuthPayload carries derived permissions", () => {
    const actor = actorFromAuthPayload({ sub: "u-bar", role: "bartender" });
    assert.ok(actor.permissions.includes("order:pay"));
    assert.deepEqual(actor.roles, ["bartender"]);
  });
});
