import { describe, it } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(__dirname, "..", "..", "dist");

const { suggestedActionsFor } = await import(pathToFileURL(path.join(DIST, "kernel", "recovery.js")).href);

describe("server recovery suggestions", () => {
  it("unknown codes yield no actions (never mislead)", () => {
    assert.deepEqual(suggestedActionsFor(undefined), []);
    assert.deepEqual(suggestedActionsFor("SOME_NEW_CODE"), []);
  });

  it("occupied tables fall back to the tables board", () => {
    const actions = suggestedActionsFor("TABLE_OCCUPIED", { tableId: "t-4" });
    assert.ok(actions.some((a) => a.href === "/dashboard/tables"));
  });

  it("uneditable orders offer a fresh draft when a table is known", () => {
    const withTable = suggestedActionsFor("ORDER_NOT_EDITABLE", { tableId: "t-2" });
    const create = withTable.find((a) => a.commandType === "order.create");
    assert.ok(create, "expected an order.create suggestion");
    assert.equal(create.payload.tableId, "t-2");

    const bare = suggestedActionsFor("ORDER_NOT_EDITABLE", {});
    assert.ok(bare.every((a) => a.commandType !== "order.create"));
    assert.ok(bare.some((a) => a.href === "/dashboard/orders"));
  });

  it("version conflicts suggest reload, never a blind command", () => {
    const actions = suggestedActionsFor("VERSION_CONFLICT");
    assert.ok(actions.length > 0);
    assert.ok(actions.every((a) => !a.commandType));
  });
});
