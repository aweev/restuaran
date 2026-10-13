/**
 * Live verification against the real Postgres (Supabase).
 *
 *   $env:DATABASE_URL="<supabase pooler or direct URL>"; node scripts/verify-supabase.cjs
 *
 * Reads DATABASE_URL from the environment only — never commit it, never put it
 * in this file. Applies kernel/event-store/schema.sql idempotently, checks the
 * kernel tables exist, then boots the REAL kernel on a live PostgresEventStore
 * and round-trips a write → read → checkpoint → idempotency cycle under a
 * throwaway tenant (cleaned up afterwards).
 */
const fs = require("fs");
const path = require("path");
const Module = require("module");

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL is not set");
  process.exit(2);
}

const DIST = path.join(__dirname, "..", "dist");
const origResolve = Module._resolveFilename;
Module._resolveFilename = function (request, ...args) {
  if (request.startsWith("@/")) request = path.join(DIST, request.slice(2));
  return origResolve.call(this, request, ...args);
};

const postgres = require("postgres");

const ok = (cond, msg) => {
  console.log((cond ? "  ok - " : "FAIL: ") + msg);
  if (!cond) process.exitCode = 1;
};

(async () => {
  const host = (() => { try { return new URL(DATABASE_URL).hostname; } catch { return "?"; } })();
  console.log("target host: " + host);
  const sql = postgres(DATABASE_URL, { prepare: false, ssl: "require", max: 3 });

  // 1. Apply kernel schema idempotently (strip line comments first so the
  // leading file header cannot swallow the first CREATE TABLE).
  const schema = fs.readFileSync(path.join(__dirname, "..", "kernel", "event-store", "schema.sql"), "utf8");
  const noComments = schema.replace(/--[^\n]*/g, "");
  const stmts = noComments.split(";").map((s) => s.trim()).filter(Boolean);
  for (const s of stmts) {
    await sql.unsafe(s);
  }
  console.log(`applied ${stmts.length} schema statements`);

  // 2. Tables exist.
  const tables = await sql.unsafe(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename IN ('ros_events','ros_snapshots','ros_projections_state','ros_events_archive','kernel_idempotency')`
  );
  const names = tables.map((r) => r.tablename);
  for (const t of ["ros_events", "ros_snapshots", "ros_projections_state", "ros_events_archive", "kernel_idempotency"]) {
    ok(names.includes(t), `table ${t} exists`);
  }

  // 3. Real kernel round-trip on the live store.
  const { PostgresEventStore } = require(path.join(DIST, "kernel", "event-store", "postgres-event-store.js"));
  const k = require(path.join(DIST, "kernel", "index.js"));
  const t = require(path.join(DIST, "kernel", "tenant", "tenant.js"));
  const tenant = t.newTenant({ orgId: "org-verify", venueId: "venue-verify" });
  const admin = t.systemActor({ userId: "verify-bot" });
  const kernel = k.createKernel({ tenant, store: new PostgresEventStore({ unsafe: (q, p) => sql.unsafe(q, p) }) });
  await k.bootKernel(kernel, { socket: null });

  const created = await kernel.execute("venue.create", { venueId: "v-live", name: "Live Check", currency: "USD", taxRate: 0.085 }, admin);
  if (!created.success) console.log("   error:", JSON.stringify(created.error));
  ok(created.success, "venue.create on live Supabase");
  const taxed = await kernel.execute("venue.configureTax", { venueId: "v-live", taxRate: 0.09 }, admin);
  ok(taxed.success, "venue.configureTax on live Supabase");
  const o = await kernel.execute("order.create", { orderId: "o-live", channel: "pos", serverId: "s1" }, admin);
  ok(o.success, "order.create on live Supabase");
  const line = await kernel.execute("order.addLine", { orderId: "o-live", menuItemId: "m1", name: "Soup", unitPrice: 9, quantity: 2 }, admin);
  ok(line.success, "order.addLine on live Supabase");
  const view = await kernel.ask("get.order", { orderId: "o-live" }, admin);
  if (!view.success) {
    console.log("   error:", JSON.stringify(view.error));
    // Direct store read to isolate mapping vs handler.
    const rawEvts = await kernel.store.readAggregate(tenant, "Order", "o-live").catch((e) => "STORE_FAIL:" + (e.message ?? e));
    console.log("   raw:", JSON.stringify(rawEvts).slice(0, 400));
  }
  else if (!view.data.state || view.data.state.lines.length !== 1) {
    console.log("   data:", JSON.stringify(view.data).slice(0, 300));
  }
  ok(view.success && view.data.state.lines.length === 1, "order reads back with 1 line");

  // 4. Checkpoint + idempotency persistence.
  const { PostgresCheckpointStore } = require(path.join(DIST, "kernel", "projections", "checkpoint-store.js"));
  const cps = new PostgresCheckpointStore({ unsafe: (q, p) => sql.unsafe(q, p) });
  await cps.save(tenant, kernel.projections.positions());
  const loaded = await cps.load(tenant);
  ok(Object.keys(loaded).length > 0, `checkpoints persist (${Object.keys(loaded).length} projections)`);
  const { PostgresIdempotencyStore } = require(path.join(DIST, "kernel", "commands", "command-bus.js"));
  const idem = new PostgresIdempotencyStore({ unsafe: (q, p) => sql.unsafe(q, p) });
  let idemErr = null;
  try {
    await idem.set("verify-req-1", { success: true, commandId: "c1", events: [] });
    const back = await idem.get("verify-req-1");
    if (!(back && back.commandId === "c1")) idemErr = "get returned " + JSON.stringify(back);
  } catch (e) {
    idemErr = e.message ?? String(e);
  }
  if (idemErr) console.log("   error:", idemErr);
  ok(!idemErr, "idempotency set/get round-trips");
  await sql.unsafe(`DELETE FROM kernel_idempotency WHERE request_id = 'verify-req-1'`);

  // 5. Cleanup probe rows.
  await sql.unsafe(`DELETE FROM ros_events WHERE org_id = 'org-verify'`);
  await sql.unsafe(`DELETE FROM ros_projections_state WHERE org_id = 'org-verify'`);
  const left = await sql.unsafe(`SELECT count(*)::int AS n FROM ros_events WHERE org_id = 'org-verify'`);
  ok(Number(left[0].n) === 0, "probe rows cleaned up");

  await kernel.shutdown();
  await sql.end();
  console.log("\nDONE. exitCode=" + (process.exitCode || 0));
})().catch((e) => {
  console.error("VERIFY CRASH:", e.message ?? e);
  process.exit(1);
});
