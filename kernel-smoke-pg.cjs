// Postgres-adapter contract tests for the kernel event store.
// Emulates Neon's sql.unsafe behavior (one atomic statement per call,
// 23505 on unique violation, JSONB round-trips, snake_case columns) so the
// production write path gets coverage the in-memory store can never provide.
const path = require("path")
const Module = require("module")

const DIST = path.join(__dirname, "dist")
const origResolve = Module._resolveFilename
Module._resolveFilename = function (request, ...args) {
  if (request.startsWith("@/")) request = path.join(DIST, request.slice(2))
  return origResolve.call(this, request, ...args)
}

const {
  PostgresEventStore,
  VersionedEventStore,
  UpcastRegistry,
  createKernel,
  bootKernel,
  buildEvent,
  assertProjectionAccess,
  requiredCapabilityFor,
} = require("./dist/kernel")
const { newTenant, systemActor } = require("./dist/kernel/tenant/tenant")

const assert = (cond, msg) => {
  if (cond) console.log("  ok -", msg)
  else {
    console.error("FAIL:", msg)
    process.exitCode = 1
  }
}

// ---------------------------------------------------------------- fake Neon

function makeFakeDb(opts = {}) {
  const rows = []
  const snapshots = new Map()
  let counter = 0
  const log = []

  const key = (r) => `${r.org_id}|${r.venue_id}|${r.aggregate_type}|${r.aggregate_id}`
  const maxVersion = (org, venue, type, id) =>
    rows
      .filter((r) => r.org_id === org && r.venue_id === venue && r.aggregate_type === type && r.aggregate_id === id)
      .reduce((m, r) => Math.max(m, r.aggregate_version), 0)

  async function unsafe(sql, params) {
    log.push({ sql, params })
    if (opts.beforeQuery) opts.beforeQuery(sql, params)

    if (sql.startsWith("WITH guard AS")) {
      const [org, venue, type, id, expected] = params.slice(0, 5)
      const tuples = []
      for (let i = 5; i + 12 <= params.length; i += 12) tuples.push(params.slice(i, i + 12))
      const cur = maxVersion(org, venue, type, id)
      // The statement-level guard: WHERE (current) = $5 — mismatch inserts nothing.
      if (cur !== expected) return []
      // Pre-scan for unique violations BEFORE mutating anything: a real
      // single-statement INSERT is all-or-nothing, the fake must be too.
      for (const t of tuples) {
        if (opts.injectUniqueViolationOn === t[6]) throw { code: "23505" }
        if (opts.throwOnInsert) throw opts.throwOnInsert
        if (rows.some((r) => key(r) === `${t[1]}|${t[2]}|${t[4]}|${t[5]}` && r.aggregate_version === t[6])) throw { code: "23505" }
      }
      const inserted = []
      for (const [eventId, o, v, zoneId, aType, aId, version, eventType, occurredAt, actor, payload, metadata] of tuples) {
        const row = {
          global_position: ++counter,
          event_id: eventId,
          org_id: o,
          venue_id: v,
          zone_id: zoneId ?? null,
          aggregate_type: aType,
          aggregate_id: aId,
          aggregate_version: version,
          event_type: eventType,
          occurred_at: occurredAt,
          actor: actor ? JSON.parse(actor) : null,
          payload: JSON.parse(payload),
          metadata: JSON.parse(metadata),
        }
        rows.push(row)
        inserted.push(row)
      }
      return inserted.map((r) => ({ global_position: r.global_position, aggregate_version: r.aggregate_version }))
    }

    if (sql.startsWith("INSERT INTO ros_snapshots")) {
      const [org, venue, type, id, version, schemaVersion, state, takenAt] = params
      snapshots.set(`${org}|${venue}|${type}|${id}`, {
        org_id: org, venue_id: venue, aggregate_type: type, aggregate_id: id,
        version, snapshot_schema_version: schemaVersion, state: JSON.parse(state), taken_at: takenAt,
      })
      return []
    }

    if (sql.startsWith("SELECT * FROM ros_snapshots")) {
      const [org, venue, type, id] = params
      const row = snapshots.get(`${org}|${venue}|${type}|${id}`)
      return row ? [row] : []
    }

    // readAggregate / query: extract filters from params by clause shape.
    const filtered = rows.filter((r) => {
      if (r.org_id !== params[0] || r.venue_id !== params[1]) return false
      if (/aggregate_type = \$3/.test(sql) && r.aggregate_type !== params[2]) return false
      if (/aggregate_id = \$4/.test(sql) && r.aggregate_id !== params[3]) return false
      if (/aggregate_version > \$5/.test(sql) && r.aggregate_version <= params[4]) return false
      const anym = sql.match(/event_type = ANY\(\$(\d+)\)/)
      if (anym) {
        const set = params[Number(anym[1]) - 1]
        if (Array.isArray(set) && !set.includes(r.event_type)) return false
      }
      if (/global_position > \$/.test(sql)) {
        const gm = sql.match(/global_position > \$(\d+)/)
        const fp = params[Number(gm[1]) - 1]
        if (r.global_position <= fp) return false
      }
      return true
    })
    const out = filtered.sort((a, b) =>
      /aggregate_version ASC/.test(sql) ? a.aggregate_version - b.aggregate_version : a.global_position - b.global_position
    )
    const lm = sql.match(/LIMIT \$(\d+)/)
    if (lm) return out.slice(0, Number(params[Number(lm[1]) - 1]))
    return out.map((r) => ({ ...r }))
  }

  return { unsafe, log, rows, snapshots, counter: () => counter }
}

// ------------------------------------------------------------------- tests

;(async () => {
  const tenant = newTenant({ orgId: "org-pg", venueId: "venue-pg", zoneId: "zone-pg" })
  const admin = systemActor({ userId: "u-pg" })

  console.log("\n[P1] appendMany is ONE statement, atomic, one round trip")
  {
    const db = makeFakeDb()
    const store = new PostgresEventStore(db)
    const e1 = buildEvent({ eventType: "order.created", aggregateType: "Order", aggregateId: "o1", aggregateVersion: 1, tenant, payload: {}, actor: admin, metadata: { source: "ui" } })
    const e2 = buildEvent({ eventType: "order.lineAdded", aggregateType: "Order", aggregateId: "o1", aggregateVersion: 2, tenant, payload: { line: { lineId: "l1" } }, actor: admin, metadata: { source: "ui" } })
    const callsBefore = db.log.length
    const stored = await store.appendMany([e1, e2])
    assert(db.log.length === callsBefore + 1, "2-event batch costs exactly one round trip")
    assert(stored.length === 2 && stored[0].globalPosition < stored[1].globalPosition, "both events durable with ordered positions")
    assert(stored[0].metadata.schemaVersion === undefined, "raw store does not stamp versions (decorator does)")
  }

  console.log("\n[P2] stale expectedVersion inserts NOTHING (statement-level guard)")
  {
    const db = makeFakeDb()
    const store = new PostgresEventStore(db)
    const e1 = buildEvent({ eventType: "order.created", aggregateType: "Order", aggregateId: "o2", aggregateVersion: 1, tenant, payload: {} })
    await store.append(e1)
    const stale = buildEvent({ eventType: "order.lineAdded", aggregateType: "Order", aggregateId: "o2", aggregateVersion: 2, tenant, payload: {} })
    let code = null
    try {
      await store.appendMany([stale], { expectedVersion: 0 })
    } catch (err) {
      code = err?.code
    }
    assert(code === "VERSION_CONFLICT", "conflict surfaces as VERSION_CONFLICT, not raw error")
    assert(db.rows.filter((r) => r.aggregate_id === "o2").length === 1, "rejected batch left zero partial writes")
  }

  console.log("\n[P3] unique violation from a concurrent winner maps to VERSION_CONFLICT")
  {
    const db = makeFakeDb({ injectUniqueViolationOn: 2 })
    const store = new PostgresEventStore(db)
    const e1 = buildEvent({ eventType: "order.created", aggregateType: "Order", aggregateId: "o3", aggregateVersion: 1, tenant, payload: {} })
    await store.append(e1)
    const raced = buildEvent({ eventType: "order.sentToKitchen", aggregateType: "Order", aggregateId: "o3", aggregateVersion: 2, tenant, payload: { lineIds: [] } })
    let code = null
    try {
      await store.appendMany([raced], { expectedVersion: 1 })
    } catch (err) {
      code = err?.code
    }
    assert(code === "VERSION_CONFLICT", "23505 mapped to retriable VERSION_CONFLICT")
    assert(db.rows.filter((r) => r.aggregate_id === "o3").length === 1, "no stream damage after mapped conflict")
  }

  console.log("\n[P4] mid-statement failure leaves no partial batch")
  {
    const db = makeFakeDb({ throwOnInsert: { code: "23503" } })
    const store = new PostgresEventStore(db)
    const evs = [1, 2, 3].map((v) => buildEvent({ eventType: "inventory.received", aggregateType: "InventoryItem", aggregateId: "i4", aggregateVersion: v, tenant, payload: { delta: 1 } }))
    let failed = false
    try {
      await store.appendMany(evs, { expectedVersion: 0 })
    } catch {
      failed = true
    }
    assert(failed && db.rows.length === 0, "all-or-nothing: zero rows after thrown insert")
  }

  console.log("\n[P5] readAggregate/subscribe reconstruct tenant from columns")
  {
    const db = makeFakeDb()
    const store = new PostgresEventStore(db)
    const e1 = buildEvent({ eventType: "table.created", aggregateType: "Table", aggregateId: "t5", aggregateVersion: 1, tenant, payload: { label: "T5" } })
    await store.append(e1)
    const read = await store.readAggregate(tenant, "Table", "t5")
    assert(read.length === 1, "event read back")
    assert(read[0].tenant && read[0].tenant.orgId === "org-pg" && read[0].tenant.venueId === "venue-pg", "tenant rebuilt from org_id/venue_id columns")
    assert(read[0].tenant.zoneId === "zone-pg", "zone preserved through round trip")
    let seen = null
    const unsub = store.subscribe((ev) => (seen = ev))
    await store.append(buildEvent({ eventType: "table.seated", aggregateType: "Table", aggregateId: "t5", aggregateVersion: 2, tenant, payload: { currentOrderId: "o9" } }))
    unsub()
    assert(seen && seen.tenant && seen.tenant.orgId === "org-pg", "subscribed events carry reconstructed tenant")
  }

  console.log("\n[P6] snapshot schema version round-trips through PG")
  {
    const db = makeFakeDb()
    const raw = new PostgresEventStore(db)
    const store = new VersionedEventStore(raw, new UpcastRegistry(), 1)
    await store.saveSnapshot({
      aggregateType: "Order", aggregateId: "o6", tenant, version: 12,
      state: { status: "open" }, takenAt: new Date().toISOString(),
    })
    const row = db.snapshots.get("org-pg|venue-pg|Order|o6")
    assert(row && row.snapshot_schema_version === 1, "snapshot_schema_version persisted as its own column")
    const back = await raw.loadSnapshot(tenant, "Order", "o6")
    assert(back && back.snapshotSchemaVersion === 1, "loadSnapshot returns the stored schema version")
    // A v2 store must reject v1 snapshots (staleness), accept v2 (fresh)
    const storeV2 = new VersionedEventStore(raw, new UpcastRegistry(), 2)
    assert((await storeV2.loadSnapshot(tenant, "Order", "o6")) === null, "v1 snapshot skipped by v2 store")
    await storeV2.saveSnapshot({
      aggregateType: "Order", aggregateId: "o6", tenant, version: 12,
      state: { status: "open" }, takenAt: new Date().toISOString(),
    })
    assert((await storeV2.loadSnapshot(tenant, "Order", "o6")) !== null, "v2 snapshot usable by v2 store")
  }

  console.log("\n[P7] TEXT ids: non-UUID aggregate + tenant ids land cleanly")
  {
    const db = makeFakeDb()
    const store = new PostgresEventStore(db)
    const odd = newTenant({ orgId: "acme-co", venueId: "downtown-01" })
    const ev = buildEvent({ eventType: "inventory.itemDefined", aggregateType: "InventoryItem", aggregateId: "sku-flour", aggregateVersion: 1, tenant: odd, payload: { sku: "FLR" } })
    const stored = await store.append(ev)
    assert(stored.aggregateId === "sku-flour", "string ids accepted end-to-end (schema is TEXT)")
    assert(db.rows[0].event_id && typeof db.rows[0].event_id === "string", "event_id remains a UUID string")
  }

  console.log("\n[P8] readAggregate limit caps the audit scan")
  {
    const db = makeFakeDb()
    const store = new PostgresEventStore(db)
    for (let v = 1; v <= 5; v++) {
      await store.append(buildEvent({ eventType: "inventory.received", aggregateType: "InventoryItem", aggregateId: "i8", aggregateVersion: v, tenant, payload: { delta: 1 } }), { expectedVersion: v - 1 })
    }
    const capped = await store.readAggregate(tenant, "InventoryItem", "i8", 0, 2)
    assert(capped.length === 2 && capped[0].aggregateVersion === 1, "LIMIT applied in SQL")
    const tail = await store.readAggregate(tenant, "InventoryItem", "i8", 3, undefined)
    assert(tail.length === 2 && tail[0].aggregateVersion === 4, "fromVersion cursor works without limit")
  }

  console.log("\n[P9] full kernel booted ON the PG store (production shape)")
  {
    const db = makeFakeDb()
    const kTenant = newTenant({ orgId: "org-real", venueId: "venue-real" })
    const kernel = createKernel({ tenant: kTenant, store: new PostgresEventStore(db) })
    await bootKernel(kernel, { socket: null })
    const r = await kernel.execute("order.create", { orderId: "o-real", serverId: "srv-1", channel: "pos" }, admin)
    assert(r.success, "order.create succeeds against PG store")
    const line = await kernel.execute("order.addLine", { orderId: "o-real", menuItemId: "m1", name: "Soup", unitPrice: 6, quantity: 2 }, admin)
    assert(line.success && line.events[0].payload.serverId === "srv-1", "line event round-trips through PG with routing context")
    const audit = await kernel.ask("get.aggregateEvents", { aggregateType: "Order", aggregateId: "o-real" }, admin)
    assert(audit.success && audit.data.length === 2, "gated audit query works over PG (systemActor holds audit:view)")
    const noAudit = await kernel.ask("get.aggregateEvents", { aggregateType: "Order", aggregateId: "o-real" }, { userId: "u-x", roles: ["staff"], permissions: [] })
    assert(!noAudit.success && noAudit.error.code === "FORBIDDEN", "zero-capability actor rejected from audit query")
    const dup = await kernel.execute("order.create", { orderId: "o-real", channel: "pos" }, admin)
    assert(!dup.success, "duplicate create on PG path conflicts instead of double-inserting")
    await kernel.projections.rebuildAll()
    assert(kernel.projections.get("kitchen.queue") !== null, "projections usable over PG")
    await kernel.shutdown()
  }

  console.log("\n[P10] projection ACL (route-level gate)")
  {
    assert(requiredCapabilityFor("menu.board") === "menu:view", "menu.board requires menu:view")
    assert(requiredCapabilityFor("waitlist.board") === "waitlist:view", "waitlist.board requires waitlist:view")
    assert(requiredCapabilityFor("unknown.board") === "audit:view", "unmapped boards default to audit:view")
    let err = null
    try {
      assertProjectionAccess(["order:view"], "menu.board")
    } catch (e) {
      err = e
    }
    assert(err && err.code === "FORBIDDEN", "kitchen actor denied menu cost/margin board")
    assertProjectionAccess(["menu:view"], "menu.board")
    assert(true, "menu manager allowed menu.board")
  }

  console.log("\nDONE. exitCode=" + (process.exitCode || 0))
})().catch((e) => {
  console.error("SMOKE-PG CRASH:", e)
  process.exit(1)
})
