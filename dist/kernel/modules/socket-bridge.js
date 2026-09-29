"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RecordingSocketTransport = exports.HttpSocketTransport = exports.SocketBridge = exports.DEFAULT_ROUTES = exports.DEFAULT_ROOM_MAP = void 0;
/** Default map onto the rooms the existing standalone server actually joins. */
exports.DEFAULT_ROOM_MAP = {
    allStations: ["admin", "kitchen", "server"],
    management: ["admin"],
    kitchen: ["kitchen", "admin"],
    servers: ["server"],
    // host/reception and back-office stations are not separate rooms yet in the
    // legacy server; route to admin so the signal is never dropped.
    reception: ["admin"],
    backOffice: ["admin"],
};
const st = (e) => { var _a; return (_a = e.payload.serverId) !== null && _a !== void 0 ? _a : null; };
const cu = (e) => { var _a; return (_a = e.payload.customerId) !== null && _a !== void 0 ? _a : null; };
exports.DEFAULT_ROUTES = {
    "order.created": {
        rooms: (_e, r) => [...r("allStations")],
        legacy: (e) => ({ event: "order_new", data: legacyOrder(e) }),
    },
    "order.lineAdded": {
        rooms: (e, r) => [...r("allStations"), ...withServer(e)],
        legacy: (e) => ({ event: "order_update", data: legacyOrder(e) }),
    },
    "order.sentToKitchen": {
        rooms: (e, r) => [...r("kitchen"), ...withServer(e)],
        legacy: (e) => ({ event: "order_preparing", data: { orderId: e.aggregateId, serverId: st(e) } }),
    },
    "order.paymentRecorded": { rooms: (e, r) => [...r("management"), ...withServer(e)] },
    "order.closed": {
        rooms: (e, r) => [...r("allStations"), ...withCustomer(e)],
        legacy: (e) => ({ event: "order_update", data: legacyOrder(e) }),
    },
    "order.voided": {
        rooms: (e, r) => [...r("allStations")],
        legacy: (e) => ({ event: "order_cancelled", data: legacyOrder(e) }),
    },
    "kitchen.lineBegan": { rooms: (_e, r) => [...r("kitchen")] },
    "kitchen.lineReady": {
        rooms: (e, r) => [...r("servers"), ...withServer(e)],
        legacy: (e) => ({ event: "order_ready", data: { orderId: e.aggregateId, serverId: st(e) } }),
    },
    "table.seated": { rooms: (_e, r) => [...r("allStations")] },
    "table.cleared": { rooms: (_e, r) => [...r("allStations")] },
    "table.cleaned": { rooms: (_e, r) => [...r("management")] },
    "reservation.booked": {
        rooms: (_e, r) => [...r("reception"), ...r("management")],
        legacy: (e) => ({ event: "reservation_new", data: legacyReservation(e) }),
    },
    "reservation.confirmed": {
        rooms: (_e, r) => [...r("reception")],
        legacy: (e) => ({ event: "reservation_update", data: legacyReservation(e) }),
    },
    "reservation.seated": { rooms: (_e, r) => [...r("allStations")] },
    "reservation.completed": { rooms: (_e, r) => [...r("reception")] },
    "reservation.cancelled": {
        rooms: (_e, r) => [...r("reception")],
        legacy: (e) => ({ event: "reservation_update", data: legacyReservation(e) }),
    },
    "reservation.noShow": { rooms: (_e, r) => [...r("reception")] },
    "waitlist.joined": { rooms: (_e, r) => [...r("reception")] },
    "waitlist.notified": { rooms: (_e, r) => [...r("reception")] },
    "waitlist.seated": { rooms: (_e, r) => [...r("allStations")] },
    "waitlist.removed": { rooms: (_e, r) => [...r("reception")] },
    "menu.eightySixed": { rooms: (_e, r) => [...r("kitchen"), ...r("servers")] },
    "menu.eightySixCleared": { rooms: (_e, r) => [...r("servers")] },
    "menu.priceChanged": { rooms: (_e, r) => [...r("servers")] },
    "shift.clockedIn": { rooms: (_e, r) => [...r("management")] },
    "shift.clockedOut": { rooms: (_e, r) => [...r("management")] },
    "inventory.consumed": { rooms: () => [], silent: true },
    "inventory.received": { rooms: (_e, r) => [...r("backOffice")] },
    "inventory.wasted": { rooms: (_e, r) => [...r("backOffice")] },
};
function withServer(e) {
    const s = st(e);
    return s ? [`server:${s}`] : [];
}
function withCustomer(e) {
    const c = cu(e);
    return c ? [`customer:${c}`] : [];
}
function legacyOrder(e) {
    var _a, _b, _c;
    return {
        id: e.aggregateId,
        orderId: e.aggregateId,
        tableId: (_a = e.payload.tableId) !== null && _a !== void 0 ? _a : null,
        serverId: st(e),
        status: String((_c = (_b = e.payload.status) !== null && _b !== void 0 ? _b : e.eventType.split(".")[1]) !== null && _c !== void 0 ? _c : ""),
        updatedAt: e.occurredAt,
    };
}
function legacyReservation(e) {
    var _a, _b, _c;
    return {
        id: e.aggregateId,
        customerName: (_a = e.payload.customerName) !== null && _a !== void 0 ? _a : null,
        tableId: (_b = e.payload.tableId) !== null && _b !== void 0 ? _b : null,
        status: (_c = e.payload.status) !== null && _c !== void 0 ? _c : null,
        updatedAt: e.occurredAt,
    };
}
/**
 * Bridges kernel events to the socket layer:
 *  - canonical `ros.event` (tenant-scoped) for new OS-aware clients
 *  - legacy event names/rooms so existing UI keeps working unchanged
 */
class SocketBridge {
    constructor(transport, opts = {}) {
        var _a, _b, _c;
        this.transport = transport;
        this.published = [];
        this.resolve = (room) => { var _a; return (_a = this.roomMap[room]) !== null && _a !== void 0 ? _a : []; };
        this.routes = (_a = opts.routes) !== null && _a !== void 0 ? _a : exports.DEFAULT_ROUTES;
        this.roomMap = (_b = opts.roomMap) !== null && _b !== void 0 ? _b : exports.DEFAULT_ROOM_MAP;
        this.canonical = (_c = opts.canonicalEvent) !== null && _c !== void 0 ? _c : true;
        this.onError = opts.onError;
    }
    async handle(event) {
        var _a;
        const route = this.routes[event.eventType];
        if (!route || route.silent)
            return [];
        const rooms = dedupe(route.rooms(event, this.resolve));
        if (rooms.length === 0)
            return [];
        const emits = [];
        if (this.canonical) {
            emits.push({
                room: rooms,
                event: "ros.event",
                data: {
                    orgId: event.tenant.orgId,
                    venueId: event.tenant.venueId,
                    eventType: event.eventType,
                    aggregateType: event.aggregateType,
                    aggregateId: event.aggregateId,
                    occurredAt: event.occurredAt,
                    payload: event.payload,
                },
            });
        }
        const legacy = (_a = route.legacy) === null || _a === void 0 ? void 0 : _a.call(route, event);
        if (legacy)
            emits.push({ room: rooms, event: legacy.event, data: legacy.data });
        for (const emit of emits) {
            try {
                await this.transport.emit(emit);
            }
            catch (err) {
                if (this.onError)
                    this.onError(err, emit);
                // eslint-disable-next-line no-console
                console.error(`[kernel:socket] failed to emit ${emit.event}`, err);
            }
        }
        this.published.push(...emits);
        return emits;
    }
    /** Test/debug: every emit handled so far. */
    recentEmits() {
        return [...this.published];
    }
}
exports.SocketBridge = SocketBridge;
function dedupe(arr) {
    return [...new Set(arr)];
}
/**
 * Production transport: POSTs to the standalone Socket.IO server's
 * /internal/emit endpoint (same contract as lib/socketEmitter.ts).
 */
class HttpSocketTransport {
    constructor(opts) {
        var _a;
        this.opts = opts;
        this.doFetch = (_a = opts.fetchImpl) !== null && _a !== void 0 ? _a : fetch;
    }
    async emit(payload) {
        const res = await this.doFetch(`${this.opts.url.replace(/\/$/, "")}/internal/emit`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(Object.assign(Object.assign({}, payload), { secret: this.opts.secret })),
        });
        if (!res.ok) {
            throw new Error(`socket emit failed: ${res.status} ${await res.text().catch(() => "")}`);
        }
    }
}
exports.HttpSocketTransport = HttpSocketTransport;
/** Transport that records emits in-process — tests, offline mode, embedded deployments. */
class RecordingSocketTransport {
    constructor() {
        this.emitted = [];
    }
    async emit(payload) {
        this.emitted.push(payload);
    }
}
exports.RecordingSocketTransport = RecordingSocketTransport;
