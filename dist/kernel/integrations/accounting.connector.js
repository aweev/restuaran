"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.accountingConnector = accountingConnector;
const connectors_1 = require("./connectors");
/**
 * Accounting connector: turns closed sales, payments and voids into journal
 * entry messages an external ledger (QuickBooks / Xero / ...) ingests.
 * `order.closed` carries totals (total/paid) stamped by the aggregate, so the
 * connector never loads state — the event is self-contained.
 */
function accountingConnector() {
    return {
        id: "accounting",
        eventTypes: ["order.closed", "order.paymentRecorded", "order.voided"],
        build(event) {
            var _a, _b, _c, _d, _e, _f, _g, _h, _j;
            const p = event.payload;
            const common = {
                channel: "connector",
                target: "accounting",
                eventType: event.eventType,
                tenant: event.tenant,
                eventId: event.eventId,
                position: event.globalPosition,
            };
            switch (event.eventType) {
                case "order.closed":
                    return Object.assign(Object.assign({}, common), { body: (0, connectors_1.connectorBody)(event, {
                            entry: "sale",
                            orderId: event.aggregateId,
                            channel: String((_a = p.channel) !== null && _a !== void 0 ? _a : "pos"),
                            gross: Number((_b = p.total) !== null && _b !== void 0 ? _b : 0),
                            paid: Number((_c = p.paid) !== null && _c !== void 0 ? _c : 0),
                            currency: "USD",
                        }) });
                case "order.paymentRecorded": {
                    const payment = ((_d = p.payment) !== null && _d !== void 0 ? _d : {});
                    return Object.assign(Object.assign({}, common), { body: (0, connectors_1.connectorBody)(event, {
                            entry: "payment",
                            orderId: event.aggregateId,
                            method: String((_e = payment.method) !== null && _e !== void 0 ? _e : "unknown"),
                            amount: Number((_f = payment.amount) !== null && _f !== void 0 ? _f : 0),
                            gateway: (_g = payment.gateway) !== null && _g !== void 0 ? _g : null,
                            currency: "USD",
                        }) });
                }
                case "order.voided":
                    return Object.assign(Object.assign({}, common), { body: (0, connectors_1.connectorBody)(event, {
                            entry: "void",
                            orderId: event.aggregateId,
                            reason: String((_h = p.reason) !== null && _h !== void 0 ? _h : "voided"),
                            channel: String((_j = p.channel) !== null && _j !== void 0 ? _j : "pos"),
                            currency: "USD",
                        }) });
                default:
                    return null;
            }
        },
    };
}
