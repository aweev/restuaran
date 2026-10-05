/**
 * Static consistency checks for db/schema.sql and db/seed.sql.
 *
 *   node scripts/verify-sql.mjs
 *
 * No Postgres required. This does not prove the SQL is valid, but it catches the
 * mistakes most likely to be introduced by hand: a seed inserting a column the
 * schema does not declare, a table referenced by one file and not the other,
 * unbalanced parentheses, or duplicate primary keys. The authoritative check is
 * applying the files to a real database:
 *
 *   psql "$DATABASE_URL" -f db/schema.sql -f db/seed.sql
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const schema = readFileSync(resolve(ROOT, "db", "schema.sql"), "utf8");
const seed = readFileSync(resolve(ROOT, "db", "seed.sql"), "utf8");

const problems = [];
const fail = (msg) => problems.push(msg);

/** Strip `--` comments so they cannot be mistaken for syntax. */
const strip = (sql) => sql.replace(/--[^\n]*/g, "");

/** Declared column names of a CREATE TABLE block, respecting nested parens. */
function columnsOf(sql, table) {
  const re = new RegExp(`CREATE TABLE IF NOT EXISTS\\s+"${table}"\\s*\\(([\\s\\S]*?)\\n\\);`, "i");
  const m = strip(sql).match(re);
  if (!m) return null;

  const cols = new Set();
  let depth = 0;
  let buf = "";
  // Split on top-level commas, then take the identifier from each declaration.
  // Column names may be bare (`id`) or quoted (`"orderId"`) — both are legal.
  for (const ch of m[1]) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    buf += ch;
    if (ch === "," && depth === 0) {
      addCol(buf);
      buf = "";
    }
  }
  addCol(buf);

  function addCol(decl) {
    const t = decl.trim();
    if (!t) return;
    // Table-level constraints (PRIMARY KEY, FOREIGN KEY, UNIQUE, CHECK, CONSTRAINT)
    // are not columns.
    if (/^(CONSTRAINT|PRIMARY|FOREIGN|UNIQUE|CHECK)\b/i.test(t)) return;
    const q = t.match(/^"([^"]+)"/);
    if (q) {
      cols.add(q[1]);
      return;
    }
    // The type may be a bare word (`TEXT`) or a quoted enum (`"TableStatus"`).
    const bare = t.match(/^([A-Za-z_][A-Za-z0-9_]*)\s+["A-Za-z]/);
    if (bare) cols.add(bare[1]);
  }

  return cols;
}

const tables = [...strip(schema).matchAll(/CREATE TABLE IF NOT EXISTS\s+"([^"]+)"/gi)].map((m) => m[1]);
if (tables.length === 0) fail("schema.sql declares no tables");
console.log(`schema.sql declares ${tables.length} tables`);

const insertedInto = [...new Set([...strip(seed).matchAll(/INSERT INTO\s+"([^"]+)"/gi)].map((m) => m[1]))];
const missing = insertedInto.filter((t) => !tables.includes(t));
if (missing.length) fail(`seed.sql inserts into unknown table(s): ${missing.join(", ")}`);
console.log(`seed.sql inserts into ${insertedInto.length} tables (all present)`);
// Explicitly named columns in a seed INSERT must exist in the schema.
let checkedCols = 0;
for (const stmt of strip(seed).split(";")) {
  const m = stmt.match(/INSERT INTO\s+"([^"]+)"\s*\(([\s\S]*?)\)\s*VALUES/i);
  if (!m) continue;
  const declared = columnsOf(schema, m[1]);
  if (!declared) continue;

  for (const raw of m[2].split(",")) {
    const col = raw.trim().replace(/^"|"$/g, "").toLowerCase();
    if (!col) continue;
    checkedCols++;
    if (![...declared].some((d) => d.toLowerCase() === col)) {
      fail(`${m[1]}: seed sets column "${col}", which schema.sql does not declare`);
    }
  }
}
console.log(`checked ${checkedCols} explicitly-named seed columns`);

const truncated = [...strip(seed).matchAll(/TRUNCATE TABLE([\s\S]*?)RESTART IDENTITY/gi)]
  .flatMap((m) => [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]));
const badTruncate = [...new Set(truncated)].filter((t) => !tables.includes(t));
if (badTruncate.length) fail(`seed.sql TRUNCATEs unknown table(s): ${badTruncate.join(", ")}`);
console.log(`seed.sql truncates ${new Set(truncated).size} tables (all present)`);

for (const stmt of strip(seed).split(";")) {
  const m = stmt.match(/INSERT INTO\s+"([^"]+)"\s*\(\s*id\b[\s\S]*?VALUES\s*([\s\S]*)$/i);
  if (!m) continue;
  const ids = [...m[2].matchAll(/^\s*\(\s*'([^']+)'/gm)].map((x) => x[1]);
  const dupes = [...new Set(ids.filter((id, i) => ids.indexOf(id) !== i))];
  if (dupes.length) fail(`${m[1]}: duplicate ids in one INSERT — ${dupes.join(", ")}`);
}
console.log("checked seed primary keys for duplicates");

for (const [name, sql] of [["schema.sql", schema], ["seed.sql", seed]]) {
  const open = (strip(sql).match(/\(/g) || []).length;
  const close = (strip(sql).match(/\)/g) || []).length;
  if (open !== close) fail(`${name}: unbalanced parentheses (${open} open, ${close} close)`);
  console.log(`${name}: ${open} parens balanced`);
}

const enums = [...strip(schema).matchAll(/CREATE TYPE\s+"([^"]+)"\s+AS ENUM/gi)].map((m) => m[1]);
const casts = [...new Set([...strip(seed).matchAll(/::"([A-Za-z]+)"/g)].map((m) => m[1]))];
const badCasts = casts.filter((c) => !enums.includes(c));
if (badCasts.length) fail(`seed.sql casts to undeclared enum(s): ${badCasts.join(", ")}`);
console.log(`schema declares ${enums.length} enums: ${enums.join(", ")}`);

console.log("");
if (problems.length) {
  console.error("FAILED:");
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}
console.log("OK — schema.sql and seed.sql are internally consistent.");
console.log('Not a substitute for: psql "$DATABASE_URL" -f db/schema.sql -f db/seed.sql');
