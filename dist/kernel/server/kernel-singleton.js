"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isSocketEnabled = isSocketEnabled;
exports.getKernel = getKernel;
const kernel_1 = require("@/kernel");
const tenant_1 = require("@/kernel/tenant/tenant");
/**
 * Single kernel per serverless warm instance (in dev this holds the in-memory
 * event store). Cached on globalThis; the *promise* is cached so concurrent
 * first-requests share one boot. Used by both /api/kernel and the /api/v1
 * public API — they must see the same kernel.
 */
const globalForKernel = globalThis;
function isSocketEnabled() {
    var _a;
    return (_a = globalForKernel.__rosSocketEnabled) !== null && _a !== void 0 ? _a : false;
}
function getKernel() {
    var _a;
    if (!globalForKernel.__rosKernel) {
        const tenant = (_a = (0, tenant_1.tenantFromEnv)()) !== null && _a !== void 0 ? _a : { orgId: "default-org", venueId: "default-venue" };
        const socketEnabled = Boolean(process.env.INTERNAL_EMIT_SECRET);
        globalForKernel.__rosSocketEnabled = socketEnabled;
        const kernel = (0, kernel_1.createKernel)({ tenant });
        // bootKernel: installs Phase 2 + Phase 3 modules, wires the socket bridge
        // when INTERNAL_EMIT_SECRET is set, drains outbound deliveries automatically
        // (webhooks/connectors), optionally schedules compaction, boots projections.
        globalForKernel.__rosKernel = (0, kernel_1.bootKernel)(kernel, {
            socket: socketEnabled ? { enabled: true } : null,
            integrations: { autoProcess: true },
            compaction: compactionFromEnv(),
        }).then(() => kernel, (err) => {
            globalForKernel.__rosKernel = undefined;
            throw err;
        });
    }
    return globalForKernel.__rosKernel;
}
function compactionFromEnv() {
    var _a, _b;
    const interval = Number((_a = process.env.ROS_COMPACTION_INTERVAL_MS) !== null && _a !== void 0 ? _a : 0);
    if (!Number.isFinite(interval) || interval <= 0)
        return undefined;
    const minEvents = Number((_b = process.env.ROS_COMPACTION_MIN_EVENTS) !== null && _b !== void 0 ? _b : 50);
    return Object.assign(Object.assign({ intervalMs: interval }, (Number.isFinite(minEvents) && minEvents > 0 ? { minEventsPerAggregate: minEvents } : {})), { prune: process.env.ROS_COMPACTION_PRUNE === "1" });
}
