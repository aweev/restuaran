"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PROJECTION_CAPABILITIES = void 0;
exports.requiredCapabilityFor = requiredCapabilityFor;
exports.assertProjectionAccess = assertProjectionAccess;
const types_1 = require("@/kernel/types");
/**
 * Capability required to read each projection over the HTTP surface.
 * The generic GET /api/kernel?projection= path is deliberately gated here:
 * projection state can embed PII (customer names/phones), financials
 * (menu cost/margin) or stock data, so it must not bypass the per-query
 * permission gates that the list/get query handlers already enforce.
 */
exports.PROJECTION_CAPABILITIES = {
    "kitchen.queue": "order:view",
    "tables.board": "table:view",
    "inventory.board": "inventory:view",
    "reservations.board": "reservation:view",
    "waitlist.board": "waitlist:view",
    "menu.board": "menu:view",
    "platform.orders": "order:view",
};
function requiredCapabilityFor(projectionName) {
    var _a;
    return (_a = exports.PROJECTION_CAPABILITIES[projectionName]) !== null && _a !== void 0 ? _a : "audit:view";
}
function assertProjectionAccess(actorPermissions, projectionName) {
    const capability = requiredCapabilityFor(projectionName);
    if (!actorPermissions.includes(capability)) {
        throw (0, types_1.kernelError)("FORBIDDEN", `Missing permission "${capability}" for projection "${projectionName}"`);
    }
}
