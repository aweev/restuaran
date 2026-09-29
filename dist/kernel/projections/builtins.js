"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.kitchenQueueProjection = kitchenQueueProjection;
exports.tableBoardProjection = tableBoardProjection;
exports.inventoryBoardProjection = inventoryBoardProjection;
const projection_1 = require("./projection");
function kitchenQueueProjection(store, tenant) {
    return (0, projection_1.defineProjection)({
        name: "kitchen.queue",
        initial: { tickets: [] },
        watchedEventTypes: [
            "order.sentToKitchen",
            "kitchen.lineBegan",
            "kitchen.lineReady",
            "kitchen.lineServed",
            "order.lineVoided",
            "order.voided",
            "order.closed",
        ],
        reduce: (state, event) => {
            var _a, _b;
            switch (event.eventType) {
                case "order.sentToKitchen": {
                    const p = event.payload;
                    const ids = new Set(p.lineIds);
                    const added = ((_a = p.lines) !== null && _a !== void 0 ? _a : [])
                        .filter((l) => ids.has(l.lineId))
                        .map((l) => (Object.assign(Object.assign({}, l), { status: "sent" })));
                    const existing = state.tickets.find((t) => t.orderId === event.aggregateId);
                    if (existing) {
                        return {
                            tickets: state.tickets.map((t) => t.orderId === event.aggregateId ? Object.assign(Object.assign({}, t), { lines: [...t.lines, ...added], status: "queued" }) : t),
                        };
                    }
                    return {
                        tickets: [
                            ...state.tickets,
                            {
                                orderId: event.aggregateId,
                                tableLabel: String((_b = p.tableId) !== null && _b !== void 0 ? _b : "?"),
                                dinerName: p.dinerName ? String(p.dinerName) : null,
                                sentAt: event.occurredAt,
                                lines: added,
                                status: "queued",
                            },
                        ],
                    };
                }
                case "kitchen.lineBegan": {
                    const lineId = event.payload.lineId;
                    return setLine(state, event.aggregateId, lineId, "preparing");
                }
                case "kitchen.lineReady": {
                    const lineId = event.payload.lineId;
                    return setLine(state, event.aggregateId, lineId, "ready");
                }
                case "kitchen.lineServed":
                case "order.lineVoided":
                    return dropLine(state, event.aggregateId, event.payload.lineId);
                case "order.voided":
                case "order.closed":
                    return { tickets: state.tickets.filter((t) => t.orderId !== event.aggregateId) };
                default:
                    return state;
            }
        },
    }, store, tenant);
}
function setLine(state, orderId, lineId, status) {
    return {
        tickets: state.tickets.map((t) => {
            if (t.orderId !== orderId)
                return t;
            const lines = t.lines.map((l) => (l.lineId === lineId ? Object.assign(Object.assign({}, l), { status }) : l));
            const ticketStatus = lines.every((l) => l.status === "ready")
                ? "ready"
                : lines.some((l) => l.status !== "sent")
                    ? "in_progress"
                    : "queued";
            return Object.assign(Object.assign({}, t), { lines, status: ticketStatus });
        }),
    };
}
function dropLine(state, orderId, lineId) {
    return {
        tickets: state.tickets
            .map((t) => (t.orderId === orderId ? Object.assign(Object.assign({}, t), { lines: t.lines.filter((l) => l.lineId !== lineId) }) : t))
            .filter((t) => t.orderId !== orderId || t.lines.length > 0),
    };
}
function tableBoardProjection(store, tenant) {
    return (0, projection_1.defineProjection)({
        name: "tables.board",
        initial: { rows: [] },
        watchedEventTypes: [
            "table.created",
            "table.seated",
            "table.cleared",
            "table.cleaned",
            "table.reserved",
            "table.reservationReleased",
        ],
        reduce: (state, event) => {
            var _a, _b, _c, _d, _e, _f;
            const rows = [...state.rows];
            const idx = rows.findIndex((r) => r.tableId === event.aggregateId);
            const p = event.payload;
            const base = idx >= 0 ? rows[idx] : { tableId: event.aggregateId, label: "?", capacity: 0, floor: "main", status: "available", serverId: null, currentOrderId: null, seatedAt: null };
            const next = Object.assign({}, base);
            switch (event.eventType) {
                case "table.created":
                    next.label = String((_a = p.label) !== null && _a !== void 0 ? _a : "?");
                    next.capacity = Number((_b = p.capacity) !== null && _b !== void 0 ? _b : 0);
                    next.floor = String((_c = p.floor) !== null && _c !== void 0 ? _c : "main");
                    break;
                case "table.seated":
                    next.status = "occupied";
                    next.currentOrderId = (_d = p.currentOrderId) !== null && _d !== void 0 ? _d : null;
                    next.serverId = (_e = p.serverId) !== null && _e !== void 0 ? _e : null;
                    next.seatedAt = (_f = p.seatedAt) !== null && _f !== void 0 ? _f : event.occurredAt;
                    break;
                case "table.cleared":
                    next.status = "dirty";
                    next.currentOrderId = null;
                    next.serverId = null;
                    next.seatedAt = null;
                    break;
                case "table.cleaned":
                    next.status = "available";
                    break;
                case "table.reserved":
                    next.status = "reserved";
                    break;
                case "table.reservationReleased":
                    next.status = "available";
                    break;
            }
            if (idx >= 0)
                rows[idx] = next;
            else
                rows.push(next);
            return { rows };
        },
    }, store, tenant);
}
function inventoryBoardProjection(store, tenant) {
    return (0, projection_1.defineProjection)({
        name: "inventory.board",
        initial: { rows: [] },
        watchedEventTypes: [
            "inventory.itemDefined",
            "inventory.received",
            "inventory.consumed",
            "inventory.wasted",
            "inventory.adjusted",
        ],
        reduce: (state, event) => {
            var _a, _b, _c, _d, _e, _f, _g;
            const rows = [...state.rows];
            const idx = rows.findIndex((r) => r.itemId === event.aggregateId);
            const p = event.payload;
            const base = idx >= 0
                ? rows[idx]
                : { itemId: event.aggregateId, sku: "", name: "", unit: "ea", onHand: 0, available: 0, reorderPoint: 0 };
            const next = Object.assign({}, base);
            switch (event.eventType) {
                case "inventory.itemDefined":
                    next.sku = String((_a = p.sku) !== null && _a !== void 0 ? _a : "");
                    next.name = String((_b = p.name) !== null && _b !== void 0 ? _b : "");
                    next.unit = String((_c = p.unit) !== null && _c !== void 0 ? _c : "ea");
                    next.reorderPoint = Number((_d = p.reorderPoint) !== null && _d !== void 0 ? _d : 0);
                    break;
                case "inventory.received":
                    next.onHand += Number((_e = p.delta) !== null && _e !== void 0 ? _e : 0);
                    break;
                case "inventory.consumed":
                case "inventory.wasted":
                    next.onHand -= Number((_f = p.delta) !== null && _f !== void 0 ? _f : 0);
                    break;
                case "inventory.adjusted":
                    next.onHand = Number((_g = p.target) !== null && _g !== void 0 ? _g : next.onHand);
                    break;
            }
            next.available = next.onHand;
            if (idx >= 0)
                rows[idx] = next;
            else
                rows.push(next);
            return { rows };
        },
    }, store, tenant);
}
