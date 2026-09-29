const path = require("path")
const fs = require("fs")
const Module = require("module")

const DIST = path.join(__dirname, "dist")
const origResolve = Module._resolveFilename
Module._resolveFilename = function (request, ...args) {
  if (request.startsWith("@/")) request = path.join(DIST, request.slice(2))
  return origResolve.call(this, request, ...args)
}

const {
  createKernel,
  bootKernel,
  RecordingSocketTransport,
  RecordingOutboundTransport,
  InMemoryEventStore,
  VersionedEventStore,
  UpcastRegistry,
  CURRENT_SCHEMA_VERSION,
  OutboundQueue,
  EventCompactor,
  collectSurface,
  buildSdkSource,
  verifyWebhookSignature,
  TIMESTAMP_HEADER,
  SIGNATURE_HEADER,
} = require("./dist/kernel")
const { newTenant, systemActor } = require("./dist/kernel/tenant/tenant")

const assert = (cond, msg) => {
  if (cond) console.log("  ok -", msg)
  else {
    console.error("FAIL:", msg)
    process.exitCode = 1
  }
}

;(async () => {
  const tenant = newTenant({ orgId: "org-1", venueId: "venue-1" })
  const admin = systemActor({ userId: "u-admin" })
  const transport = new RecordingSocketTransport()
  const webhookTransport = new RecordingOutboundTransport()
  const connectorTransport = new RecordingOutboundTransport()
  const kernel = createKernel({ tenant })
  await bootKernel(kernel, {
    socket: { transport },
    integrations: {
      webhookTransport,
      connectorTransport,
      autoProcess: false,
      retry: { maxAttempts: 3, baseDelayMs: 1000, factor: 2, maxDelayMs: 60000 },
    },
  })

  console.log("\n[1] Phase 2 + Phase 3 module installation")
  const surface = kernel.modules.list()
  assert(surface.length === 6, "6 modules installed (4 domain + platform + integrations)")
  assert(surface.every((m) => m.status === "active"), "all modules active")
  assert(surface.some((m) => m.id === "ros.reservations") && surface.some((m) => m.id === "ros.menu"), "capability registry lists domain modules")
  assert(surface.some((m) => m.id === "ros.platform") && surface.some((m) => m.id === "ros.integrations"), "Phase 3 modules registered")
  assert(kernel.commands.registeredCommands().length === 48, `48 commands registered across core + modules (${kernel.commands.registeredCommands().length})`)
  for (const p of ["reservations.board", "waitlist.board", "menu.board", "platform.orders", "webhooks.endpoints"]) {
    assert(kernel.projections.names().includes(p), `projection ${p} registered by module`)
  }

  console.log("\n[2] KDS loop closes (line lifecycle on Order stream)")
  const tableId = "t-kds"
  const orderId = "o-kds"
  await kernel.execute("table.create", { tableId, label: "T12", capacity: 4 }, admin)
  await kernel.execute("order.create", { orderId, tableId, serverId: "srv-1", channel: "pos" }, admin)
  let r = await kernel.execute("order.addLine", { orderId, menuItemId: "m1", name: "Steak", unitPrice: 30, quantity: 1 }, admin)
  assert(r.success && r.events[0].payload.serverId === "srv-1", "line event carries routing context (serverId)")
  const lineId = r.events[0].payload.line.lineId
  r = await kernel.execute("order.sendToKitchen", { orderId }, admin)
  assert(r.success && r.events[0].payload.lines.length === 1, "sentToKitchen embeds self-contained line details")

  await kernel.projections.rebuildAll()
  let kt = kernel.projections.get("kitchen.queue").state.tickets
  assert(kt.length === 1 && kt[0].lines[0].name === "Steak" && kt[0].status === "queued", "kitchen ticket built from event alone")

  r = await kernel.execute("kitchen.readyLine", { orderId, lineId }, admin)
  assert(!r.success && r.error.code === "BAD_LINE_STATE", "cannot skip sent -> ready (must begin first)")
  await kernel.execute("kitchen.beginLine", { orderId, lineId }, admin)
  await kernel.execute("kitchen.readyLine", { orderId, lineId }, admin)
  await kernel.projections.rebuildAll()
  assert(kernel.projections.get("kitchen.queue").state.tickets[0].status === "ready", "ticket marked ready after line lifecycle")
  await kernel.execute("kitchen.serveLine", { orderId, lineId }, admin)
  await kernel.projections.rebuildAll()
  assert(kernel.projections.get("kitchen.queue").state.tickets.length === 0, "served line drops ticket")

  console.log("\n[3] socket bridge (event:published -> legacy aliases + canonical)")
  const preparing = transport.emitted.filter((e) => e.event === "order_preparing")
  assert(preparing.length === 1, "order_preparing legacy emit from sendToKitchen")
  assert(transport.emitted.filter((e) => e.event === "ros.event").length >= 5, "canonical ros.event emits present")
  assert(preparing[0].room.includes("kitchen") && preparing[0].room.includes("server:srv-1"), "kitchen + server rooms resolved from semantic map")
  assert(preparing[0].data.orderId === orderId, "legacy payload shape preserved for existing UI")

  console.log("\n[4] reservations + double-booking guard (cross-aggregate via projection)")
  const res = "r-1"
  r = await kernel.execute("reservation.book", { reservationId: res, customerName: "Ada", partySize: 4, date: "2026-10-01", time: "19:00", tableId: "t-res" }, admin)
  assert(r.success, "reservation booked with table")
  r = await kernel.execute("reservation.book", { reservationId: "r-2", customerName: "Bob", partySize: 2, date: "2026-10-01", time: "19:30", tableId: "t-res" }, admin)
  assert(!r.success && r.error.code === "TABLE_DOUBLE_BOOKED", "overlapping booking on same table rejected")
  r = await kernel.execute("reservation.book", { reservationId: "r-3", customerName: "Cy", partySize: 2, date: "2026-10-01", time: "21:00", tableId: "t-res" }, admin)
  assert(r.success, "non-overlapping booking accepted")
  await kernel.projections.rebuildAll()
  assert(kernel.projections.get("reservations.board").state.rows.length === 2, "board shows 2 active reservations")
  r = await kernel.execute("reservation.cancel", { reservationId: "nope" }, admin)
  assert(!r.success && r.error.code === "AGGREGATE_NOT_FOUND", "cancelling unknown reservation rejected by load guard")

  console.log("\n[5] waitlist + tables.board integration")
  const w1 = "w-1"
  r = await kernel.execute("waitlist.join", { entryId: w1, customerName: "Dee", partySize: 2, phone: "555" }, admin)
  assert(r.success, "waitlist join accepted")
  await kernel.execute("waitlist.join", { entryId: "w-2", customerName: "Eve", partySize: 6 }, admin)
  await kernel.projections.rebuildAll()
  const queue = kernel.projections.get("waitlist.board").state.queue
  assert(queue.length === 2 && queue[0].position === 1 && queue[1].position === 2, "queue positions dense and ordered")
  await kernel.execute("waitlist.notify", { entryId: w1 }, admin)
  r = await kernel.execute("waitlist.notify", { entryId: w1 }, admin)
  assert(!r.success && r.error.code === "BAD_WAITLIST_STATE", "double-notify rejected")
  const occupied = "t-busy"
  const ord2 = "o-seat"
  await kernel.execute("table.create", { tableId: occupied, label: "T99", capacity: 2 }, admin)
  await kernel.execute("order.create", { orderId: ord2, channel: "pos" }, admin)
  await kernel.execute("table.seat", { tableId: occupied, orderId: ord2, serverId: "srv-2" }, admin)
  await kernel.projections.rebuildAll()
  r = await kernel.execute("waitlist.seat", { entryId: w1, tableId: occupied }, admin)
  assert(!r.success && r.error.code === "TABLE_NOT_AVAILABLE", "seating onto occupied table blocked by tables.board guard")
  const free = "t-free"
  await kernel.execute("table.create", { tableId: free, label: "T50", capacity: 2 }, admin)
  await kernel.projections.rebuildAll()
  r = await kernel.execute("waitlist.seat", { entryId: w1, tableId: free }, admin)
  assert(r.success, "seating onto available table allowed")
  await kernel.projections.rebuildAll()
  assert(kernel.projections.get("waitlist.board").state.queue.length === 1, "seated party leaves queue")

  console.log("\n[6] menu + cross-module 86 policy")
  const item = "mi-1"
  r = await kernel.execute("menu.createItem", { itemId: item, name: "Risotto", categoryId: "c1", basePrice: 22, cost: 8 }, admin)
  assert(r.success, "menu item created")
  r = await kernel.execute("order.addLine", { orderId: ord2, menuItemId: item, name: "Risotto", unitPrice: 22, quantity: 1 }, admin)
  assert(r.success, "sellable item adds fine")
  await kernel.execute("menu.eightySix", { itemId: item, reason: "no arborio" }, admin)
  r = await kernel.execute("order.addLine", { orderId: ord2, menuItemId: item, name: "Risotto", unitPrice: 22, quantity: 1 }, admin)
  assert(!r.success && r.error.code === "MENU_ITEM_UNAVAILABLE", "menu module vets another module's command (86'd item)")
  r = await kernel.execute("order.addLine", { orderId: ord2, menuItemId: "ghost-item", name: "x", unitPrice: 1, quantity: 1 }, admin)
  assert(r.success, "unknown item id not this module's concern")
  await kernel.execute("menu.clearEightySix", { itemId: item }, admin)
  r = await kernel.execute("menu.changePrice", { itemId: item, price: -5 }, admin)
  assert(!r.success && r.error.code === "INVALID_PRICE", "negative price rejected by aggregate")

  console.log("\n[7] staff scheduling + time clock")
  const shift = "sh-1"
  r = await kernel.execute("staff.scheduleShift", { shiftId: shift, staffId: "emp-9", position: "server", scheduledStart: "2026-10-01T17:00:00Z", scheduledEnd: "2026-10-01T22:00:00Z" }, admin)
  assert(r.success, "shift scheduled")
  r = await kernel.execute("staff.scheduleShift", { shiftId: "sh-bad", staffId: "emp-9", position: "server", scheduledStart: "2026-10-01T22:00:00Z", scheduledEnd: "2026-10-01T17:00:00Z" }, admin)
  assert(!r.success && r.error.code === "INVALID_SHIFT", "end before start rejected")
  r = await kernel.execute("staff.clockIn", { shiftId: shift, staffId: "emp-other" }, { userId: "emp-other", roles: ["staff"], permissions: ["staff:clock"] })
  assert(!r.success && r.error.code === "SHIFT_OWNERSHIP", "clocking into someone else's shift blocked")
  const emp = { userId: "emp-9", roles: ["staff"], permissions: ["staff:clock"] }
  await kernel.execute("staff.clockIn", { shiftId: shift }, emp)
  await kernel.execute("staff.startBreak", { shiftId: shift }, emp)
  r = await kernel.execute("staff.startBreak", { shiftId: shift }, emp)
  assert(!r.success && r.error.code === "BAD_SHIFT_STATE", "double break rejected")
  await kernel.execute("staff.endBreak", { shiftId: shift }, emp)
  await kernel.execute("staff.clockOut", { shiftId: shift }, emp)
  r = await kernel.execute("staff.clockOut", { shiftId: shift }, emp)
  assert(!r.success && r.error.code === "BAD_SHIFT_STATE", "double clock-out rejected")
  r = await kernel.ask("list.staffing.board", {}, admin)
  assert(r.success && r.data.history.length === 1 && r.data.history[0].staffId === "emp-9", "staffing board computed from events")

  console.log("\n[8] event schema versioning + upcasters")
  assert(CURRENT_SCHEMA_VERSION === 1, "baseline schema version is 1")
  const registry = new UpcastRegistry()
  registry.register({
    eventType: "order.created",
    fromVersion: 1,
    toVersion: 2,
    upcast: (payload, meta) => ({ payload: { ...payload, legacyV1: true }, meta: { ...meta, schemaVersion: 2 } }),
  })
  const rawStore = new InMemoryEventStore()
  const v1 = new VersionedEventStore(rawStore, new UpcastRegistry(), 1)
  await v1.append({
    eventId: "e-legacy",
    eventType: "order.created",
    aggregateType: "Order",
    aggregateId: "legacy-order",
    aggregateVersion: 1,
    tenant,
    occurredAt: new Date().toISOString(),
    payload: { channel: "pos" },
    metadata: { source: "migration", schemaVersion: 1 },
  })
  const v2 = new VersionedEventStore(rawStore, registry, 2)
  const read = await v2.readAggregate(tenant, "Order", "legacy-order")
  assert(read.length === 1 && read[0].payload.legacyV1 === true, "v1 payload upcast to v2 shape on read")
  assert(read[0].metadata.schemaVersion === 2, "upcast advances schema version marker")
  const fresh = await v2.append({
    eventId: "e-new",
    eventType: "order.created",
    aggregateType: "Order",
    aggregateId: "new-order",
    aggregateVersion: 1,
    tenant,
    occurredAt: new Date().toISOString(),
    payload: { channel: "pos" },
    metadata: { source: "ui" },
  })
  assert(fresh.metadata.schemaVersion === 2, "new events stamped with current version")

  console.log("\n[9] snapshot policy + replay from snapshot")
  const snapTenant = newTenant({ orgId: "org-s", venueId: "venue-s" })
  const snapKernel = createKernel({ tenant: snapTenant, snapshot: { every: 4, shouldSnapshot: (_c, v) => v > 0 && v % 4 === 0 } })
  await bootKernel(snapKernel, { socket: null })
  const snapActor = systemActor({ userId: "u-snap" })
  const snapItem = "snap-item"
  await snapKernel.execute("inventory.defineItem", { itemId: snapItem, sku: "SNP", name: "Snap", unit: "ea" }, snapActor) // v1
  await snapKernel.execute("inventory.receive", { itemId: snapItem, quantity: 10 }, snapActor) // v2
  await snapKernel.execute("inventory.consume", { itemId: snapItem, quantity: 2 }, snapActor) // v3
  r = await snapKernel.execute("inventory.receive", { itemId: snapItem, quantity: 5 }, snapActor) // v4 -> snapshot
  assert(r.success && r.events.length === 1, "write at version multiple succeeds")
  const snap = await snapKernel.store.loadSnapshot(snapTenant, "InventoryItem", snapItem)
  assert(snap && snap.version === 4, "snapshot taken at version 4")
  assert(snap && snap.state.onHand === 13, "snapshot captures correct state (10-2+5=13)")
  // Load replays from snapshot + events after v4. Adding more and re-checking proves snapshot usage.
  await snapKernel.execute("inventory.receive", { itemId: snapItem, quantity: 1 }, snapActor) // v5
  const q = await snapKernel.ask("get.inventoryItem", { itemId: snapItem }, snapActor)
  assert(q.success && q.data.state.onHand === 14 && q.data.version === 5, "replay from snapshot + tail events correct")
  const evs = await snapKernel.ask("get.aggregateEvents", { aggregateType: "InventoryItem", aggregateId: snapItem }, snapActor)
  assert(evs.success && evs.data.length === 5, "full 5-event audit trail retained behind snapshot")

  console.log("\n[10] permission gating via the real auth adapter")
  const { actorFromAuthPayload } = require("./dist/kernel/tenant/permission-map")
  const waiterActor = actorFromAuthPayload({ sub: "u-w", role: "waiter", permissions: ["order:create", "order:edit_any", "table:view_status"] })
  r = await kernel.execute("reservation.book", { customerName: "X", partySize: 1, date: "2026-10-02", time: "18:00" }, waiterActor)
  assert(!r.success && r.error.code === "FORBIDDEN", "waiter role cannot book reservations")
  assert(waiterActor.permissions.includes("order:edit"), "granular order:edit_any maps to capability order:edit")
  const hostActor = actorFromAuthPayload({ sub: "u-h", role: "host_staff", permissions: ["reservation:create", "waitlist:manage"] })
  r = await kernel.execute("reservation.book", { reservationId: "r-host", customerName: "Hosted", partySize: 2, date: "2026-10-02", time: "18:00" }, hostActor)
  assert(r.success, "host_staff granular permissions map to reservation:manage capability")
  r = await kernel.execute("menu.createItem", { name: "x", categoryId: "c", basePrice: 1 }, hostActor)
  assert(!r.success && r.error.code === "FORBIDDEN", "host cannot manage menu")

  console.log("\n[11] multi-tenant isolation still holds across Phase 2")
  const tenant2 = newTenant({ orgId: "org-2", venueId: "venue-2" })
  const kernel2 = createKernel({ tenant: tenant2 })
  await bootKernel(kernel2, { socket: null })
  const crossQ = await kernel2.ask("get.reservation", { reservationId: res }, systemActor())
  assert(!crossQ.success && crossQ.error.code === "AGGREGATE_NOT_FOUND", "reservation from tenant 1 invisible in tenant 2")

  console.log("\n[12] outbound queue: retry, exponential backoff, DLQ, replay")
  const rec = new RecordingOutboundTransport()
  let clock = 1000
  const qq = new OutboundQueue({
    transport: rec,
    retry: { maxAttempts: 3, baseDelayMs: 1000, factor: 2, maxDelayMs: 60000 },
    now: () => clock,
  })
  rec.failAlways = true
  const m1 = qq.enqueue({ channel: "webhook", target: "https://q.test/h", eventType: "order.closed", tenant, eventId: "e-q1", position: 1, body: { n: 1 } })
  let pr = await qq.process()
  assert(pr.attempted === 1 && pr.retried === 1, "failed attempt schedules a retry")
  assert(m1.nextAttemptAt === 2000, "first retry after baseDelayMs (1000)")
  clock = 1500
  pr = await qq.process()
  assert(pr.attempted === 0, "retry not due before backoff elapses")
  clock = 2000
  pr = await qq.process()
  assert(pr.attempted === 1 && m1.nextAttemptAt === 4000, "backoff doubles on the second failure")
  clock = 4000
  pr = await qq.process()
  assert(pr.dead === 1 && m1.status === "dead", "DLQ after maxAttempts (3) exhausted")
  assert(qq.stats().dead === 1 && qq.stats().pending === 0, "queue stats reflect the dead letter")
  assert(qq.replay("missing-id") === null, "replay of unknown delivery is a no-op")
  assert(qq.replay(m1.id) && m1.status === "pending" && m1.attempts === 0, "dead delivery replayed with a fresh attempt budget")
  rec.failAlways = false
  clock = 5000
  pr = await qq.process()
  assert(pr.delivered === 1 && rec.delivered.length === 1, "replayed delivery succeeds once the transport recovers")

  console.log("\n[13] webhook fabric: subscribe, HMAC signature, DLQ replay, unsubscribe")
  r = await kernel.execute("webhook.subscribe", { url: "ftp://nope" }, admin)
  assert(!r.success && r.error.code === "INVALID_WEBHOOK_URL", "non-http webhook URL rejected")
  r = await kernel.execute("webhook.subscribe", { url: "https://hooks.test/ros", eventTypes: ["order.closed"], secret: "s3cret" }, admin)
  assert(r.success, "webhook endpoint subscribed")
  const endpointId = r.aggregateId
  const hooksQ = await kernel.ask("list.webhooks", {}, admin)
  assert(hooksQ.success && hooksQ.data.length === 1 && hooksQ.data[0].hasSecret === true, "list.webhooks reports a secret")
  assert(hooksQ.success && hooksQ.data[0].secret === undefined, "list.webhooks never leaks the signing secret")
  r = await kernel.ask("list.webhooks", {}, waiterActor)
  assert(!r.success && r.error.code === "FORBIDDEN", "waiter role cannot list webhooks")

  const hookOrder = "o-hook"
  await kernel.execute("order.create", { orderId: hookOrder, channel: "pos" }, admin)
  await kernel.execute("order.addLine", { orderId: hookOrder, menuItemId: "m-hook", name: "Hook Burger", unitPrice: 12, quantity: 2 }, admin)
  await kernel.execute("order.recordPayment", { orderId: hookOrder, method: "card", amount: 24 }, admin)
  await kernel.execute("order.close", { orderId: hookOrder }, admin)

  const fabric = kernel.integrations
  assert(fabric.webhooks.stats().pending === 1 && fabric.webhooks.stats().total === 1, "order.closed enqueued exactly one webhook delivery")
  const delivery = fabric.webhooks.list("pending")[0]
  assert(delivery.target === "https://hooks.test/ros" && delivery.eventType === "order.closed", "delivery targets the subscribed endpoint")
  const rawBody = JSON.stringify(delivery.body)
  assert(verifyWebhookSignature("s3cret", delivery.headers[TIMESTAMP_HEADER], rawBody, delivery.headers[SIGNATURE_HEADER]), "HMAC-SHA256 signature verifies with the endpoint secret")
  assert(delivery.headers["X-ROS-Delivery"] === delivery.id, "X-ROS-Delivery header carries the delivery id")

  const t0 = Date.now()
  webhookTransport.failAlways = true
  pr = await fabric.webhooks.process(t0)
  assert(pr.attempted === 1 && pr.retried === 1, "webhook delivery failure schedules a retry")
  pr = await fabric.webhooks.process(t0 + 999)
  assert(pr.attempted === 0, "webhook retry honors the backoff window")
  pr = await fabric.webhooks.process(t0 + 1000)
  assert(pr.attempted === 1 && pr.retried === 1, "second webhook attempt still failing")
  pr = await fabric.webhooks.process(t0 + 3000)
  assert(pr.dead === 1, "webhook delivery lands in the DLQ")
  r = await kernel.execute("outbound.replay", { deliveryId: delivery.id }, admin)
  assert(r.success, "dead delivery replayed through outbound.replay command")
  r = await kernel.execute("outbound.replay", { deliveryId: "nope" }, admin)
  assert(!r.success && r.error.code === "DELIVERY_NOT_FOUND", "replay of unknown delivery rejected")
  webhookTransport.failAlways = false
  pr = await fabric.webhooks.process(t0 + 4000)
  assert(pr.delivered === 1 && webhookTransport.delivered.some((d) => d.id === delivery.id), "replayed webhook delivers after transport recovers")

  await kernel.execute("webhook.unsubscribe", { endpointId }, admin)
  await kernel.execute("order.create", { orderId: "o-hook2", channel: "pos" }, admin)
  await kernel.execute("order.addLine", { orderId: "o-hook2", menuItemId: "m-hook", name: "Hook Burger", unitPrice: 12, quantity: 1 }, admin)
  await kernel.execute("order.recordPayment", { orderId: "o-hook2", method: "cash", amount: 12 }, admin)
  await kernel.execute("order.close", { orderId: "o-hook2" }, admin)
  assert(fabric.webhooks.stats().pending === 0 && fabric.webhooks.stats().total === 1, "unsubscribed endpoint receives nothing")
  r = await kernel.execute("webhook.update", { endpointId, url: "https://hooks.test/ros" }, admin)
  assert(!r.success && r.error.code === "WEBHOOK_INACTIVE", "unsubscribed endpoint cannot be updated")

  console.log("\n[14] platform/marketplace order injection (idempotent + policy-gated)")
  const platPayload = {
    platform: "uber-eats",
    externalOrderId: "UE-1001",
    items: [{ menuItemId: item, name: "Risotto", unitPrice: 22, quantity: 2 }],
    customer: { name: "Road Runner" },
    fulfillment: "delivery",
  }
  r = await kernel.execute("platform.ingestOrder", platPayload, admin)
  assert(r.success, "marketplace order ingested")
  const pid = r.aggregateId
  assert(r.events.length === 1 && r.events[0].eventType === "platform.orderReceived", "platform.orderReceived committed")
  const ingestedOrder = r.events[0].payload.orderId
  assert(typeof ingestedOrder === "string" && ingestedOrder.length > 0, "event maps external order to internal POS order")

  r = await kernel.execute("platform.ingestOrder", platPayload, admin)
  assert(r.success && r.events.length === 0 && r.aggregateId === pid, "duplicate ingest is idempotent (no new events)")

  let pq = await kernel.ask("get.platformOrder", { platformOrderId: pid }, admin)
  assert(pq.success && pq.data.state.status === "received" && pq.data.state.orderId === ingestedOrder, "platform order records the external -> internal mapping")
  assert(pq.success && pq.data.state.itemsSubtotal === 44 && pq.data.state.itemCount === 1, "items subtotal captured at ingest (22 x 2)")

  await kernel.projections.rebuildAll()
  const platRows = kernel.projections.get("platform.orders").state.rows
  assert(platRows.some((row) => row.id === pid && row.platform === "uber-eats" && row.externalOrderId === "UE-1001"), "platform.orders board shows the injected order")
  assert(kernel.projections.get("kitchen.queue").state.tickets.some((t) => t.orderId === ingestedOrder), "injected order reaches the KDS automatically")

  r = await kernel.execute("platform.ingestOrder", { platform: "uber-eats", externalOrderId: "UE-BAD", items: [] }, admin)
  assert(!r.success && r.error.code === "PLATFORM_ORDER_EMPTY", "empty marketplace order rejected")

  await kernel.execute("menu.eightySix", { itemId: item, reason: "restocking" }, admin)
  r = await kernel.execute("platform.ingestOrder", {
    platform: "uber-eats",
    externalOrderId: "UE-1002",
    items: [{ menuItemId: item, name: "Risotto", unitPrice: 22, quantity: 1 }],
  }, admin)
  assert(!r.success && r.error.code === "MENU_ITEM_UNAVAILABLE", "86 cross-module policy vetoes a marketplace ingest")
  const rejectedOrder = r.error.details.orderId
  pq = await kernel.ask("get.order", { orderId: rejectedOrder }, admin)
  assert(pq.success && pq.data.state.status === "voided", "rejected ingest leaves no open order (auto-voided)")
  await kernel.execute("menu.clearEightySix", { itemId: item }, admin)
  await kernel.projections.rebuildAll()
  assert(!kernel.projections.get("platform.orders").state.rows.some((row) => row.externalOrderId === "UE-1002"), "failed ingest records no platform order")

  r = await kernel.execute("platform.cancelOrder", { platformOrderId: pid, reason: "customer cancelled" }, admin)
  assert(r.success, "platform cancellation voids the POS order atomically")
  pq = await kernel.ask("get.platformOrder", { platformOrderId: pid }, admin)
  assert(pq.success && pq.data.state.status === "cancelled", "cancelled status recorded on the platform order")
  pq = await kernel.ask("get.order", { orderId: ingestedOrder }, admin)
  assert(pq.success && pq.data.state.status === "voided", "linked POS order voided by the cancellation")
  r = await kernel.execute("platform.cancelOrder", { platformOrderId: pid }, admin)
  assert(!r.success && r.error.code === "PLATFORM_ORDER_TERMINAL", "terminal platform orders cannot be cancelled again")

  r = await kernel.execute("platform.ingestOrder", {
    platform: "doordash",
    externalOrderId: "DD-77",
    items: [{ menuItemId: item, name: "Risotto", unitPrice: 22, quantity: 1 }],
  }, admin)
  assert(r.success, "second marketplace order ingested")
  const pid3 = r.aggregateId
  const order3 = r.events[0].payload.orderId
  await kernel.execute("order.recordPayment", { orderId: order3, method: "card", amount: 22 }, admin)
  await kernel.execute("order.close", { orderId: order3 }, admin)
  r = await kernel.execute("platform.completeOrder", { platformOrderId: pid3 }, admin)
  assert(r.success, "platform order completed after POS close")
  r = await kernel.execute("platform.completeOrder", { platformOrderId: pid3 }, admin)
  assert(!r.success && r.error.code === "PLATFORM_ORDER_TERMINAL", "completed platform orders are terminal")

  console.log("\n[15] accounting + delivery connectors on the shared retry fabric")
  const connFabric = kernel.integrations
  const connReport = await connFabric.connectors.process(Date.now())
  assert(connReport.delivered >= 1 && connReport.dead === 0, "connector messages delivered through the queue")
  const sales = connectorTransport.delivered.filter((m) => m.target === "accounting" && m.body.entry === "sale")
  assert(sales.some((m) => m.body.orderId === order3 && m.body.gross === 22), "accounting connector: sale journal entry carries totals stamped on order.closed")
  const ledgerPayments = connectorTransport.delivered.filter((m) => m.target === "accounting" && m.body.entry === "payment")
  assert(ledgerPayments.some((m) => m.body.amount === 24) && ledgerPayments.some((m) => m.body.amount === 22), "accounting connector: payment entries for both closed orders")
  const deliveryStatuses = connectorTransport.delivered
    .filter((m) => m.target === "delivery")
    .map((m) => m.body.status)
  assert(deliveryStatuses.includes("accepted"), "delivery connector: platform.orderReceived -> accepted")
  assert(deliveryStatuses.includes("preparing"), "delivery connector: order.sentToKitchen (platform channel) -> preparing")
  assert(deliveryStatuses.includes("completed"), "delivery connector: order.closed (platform channel) -> completed")
  assert(!connectorTransport.delivered.some((m) => m.target === "delivery" && m.body.orderId === hookOrder), "delivery connector ignores non-platform orders")
  const outQ = await kernel.ask("list.outbound", { channel: "connector" }, admin)
  assert(outQ.success && outQ.data.length === connFabric.connectors.stats().total, "list.outbound exposes the connector queue")

  console.log("\n[16] event compaction: snapshot backfill + hot->cold archive")
  const ciItem = "ci-item"
  await kernel.execute("inventory.defineItem", { itemId: ciItem, sku: "CI", name: "Compact Me", unit: "ea" }, admin)
  for (let i = 0; i < 5; i++) {
    await kernel.execute("inventory.receive", { itemId: ciItem, quantity: 10 }, admin)
  }
  const auditBefore = await kernel.ask("get.aggregateEvents", { aggregateType: "InventoryItem", aggregateId: ciItem }, admin)
  assert(auditBefore.success && auditBefore.data.length === 6, "6-event stream before compaction")

  const compactor = new EventCompactor(kernel.store, { minEventsPerAggregate: 5, prune: true })
  const report = await compactor.run(tenant)
  assert(report.pruneSupported, "event store supports compaction")
  assert(report.snapshotsTaken >= 1, "snapshot backfilled for long streams")
  assert(report.eventsPruned >= 6, `superseded events moved to the cold archive (${report.eventsPruned})`)
  assert(report.streamsCompacted >= 1 && report.streamsSkipped === 0, "streams compacted without skips")

  const archived = await kernel.store.archivedEvents({ tenant, aggregateType: "InventoryItem", aggregateId: ciItem })
  assert(archived.length >= 6, "pruned events preserved in the cold archive")
  const auditAfter = await kernel.ask("get.aggregateEvents", { aggregateType: "InventoryItem", aggregateId: ciItem }, admin)
  assert(auditAfter.success && auditAfter.data.length === 6, "audit trail intact after compaction (archive merged into reads)")

  pq = await kernel.ask("get.inventoryItem", { itemId: ciItem }, admin)
  assert(pq.success && pq.data.version === 6 && pq.data.state.onHand === 50, "replay from snapshot + tail yields correct state")

  const report2 = await compactor.run(tenant)
  assert(report2.eventsPruned === 0, "second compaction run is a no-op")

  r = await kernel.execute("inventory.receive", { itemId: ciItem, quantity: 5 }, admin)
  assert(r.success, "write after compaction sees archived versions (no optimistic-lock conflict)")
  pq = await kernel.ask("get.inventoryItem", { itemId: ciItem }, admin)
  assert(pq.success && pq.data.version === 7 && pq.data.state.onHand === 55, "state correct after post-compaction write")
  await kernel.projections.rebuildAll()
  assert(kernel.projections.get("inventory.board").state !== undefined, "projections still rebuild after compaction")

  console.log("\n[17] public API surface + generated SDK")
  const apiSurface = collectSurface(kernel)
  assert(apiSurface.commands.length === 48, `surface: 48 commands (${apiSurface.commands.length})`)
  assert(apiSurface.queries.length === 17, `surface: 17 queries (${apiSurface.queries.length})`)
  assert(apiSurface.projections.length === 8, `surface: 8 projections (${apiSurface.projections.length})`)
  assert(apiSurface.modules.length === 6, `surface: 6 modules (${apiSurface.modules.length})`)
  const sdkSource = buildSdkSource(apiSurface)
  assert(sdkSource.includes('"platform.ingestOrder"') && sdkSource.includes("platformIngestOrder("), "SDK generates a typed method per command")
  assert(sdkSource.includes("webhookSubscribe(") && sdkSource.includes("outboundReplay("), "SDK covers the integration surface")
  const sdkPath = path.join(__dirname, "sdk", "ros-sdk.ts")
  const committedSdk = fs.existsSync(sdkPath) ? fs.readFileSync(sdkPath, "utf8") : ""
  assert(committedSdk === sdkSource, "committed sdk/ros-sdk.ts matches regeneration (npm run kernel:sdk)")


  await kernel.shutdown()
  console.log("\nDONE. exitCode=" + (process.exitCode || 0))
})().catch((e) => {
  console.error("SMOKE CRASH:", e)
  process.exit(1)
})
