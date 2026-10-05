import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";

const db = await PGlite.create();
const schema = readFileSync("db/schema.sql", "utf8");
const stripMeta = (s) => s.replace(/^\\.*$/gm, "");

// Apply statement by statement so the first failure names itself.
const stmts = stripMeta(schema)
  .split(/;\s*\r?\n/)
  .map((s) => s.trim())
  .filter((s) => s && !/^--/.test(s));

let applied = 0;
for (const [i, s] of stmts.entries()) {
  try {
    await db.exec(s.endsWith(";") ? s : s + ";");
    applied++;
  } catch (e) {
    console.log("FAILED at statement", i, ":", e.message);
    console.log("---- statement ----");
    console.log(s.slice(0, 400));
    break;
  }
}
console.log("applied", applied, "of", stmts.length);

const t = await db.query(`SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name`);
console.log("tables:", t.rows.map((r) => r.table_name).join(", "));
await db.close();

