"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.newTenant = newTenant;
exports.systemActor = systemActor;
exports.assertTenant = assertTenant;
exports.tenantFromEnv = tenantFromEnv;
const crypto_1 = require("crypto");
const types_1 = require("@/kernel/types");
function newTenant(opts) {
    var _a, _b;
    return Object.assign({ orgId: (_a = opts === null || opts === void 0 ? void 0 : opts.orgId) !== null && _a !== void 0 ? _a : (0, crypto_1.randomUUID)(), venueId: (_b = opts === null || opts === void 0 ? void 0 : opts.venueId) !== null && _b !== void 0 ? _b : (0, crypto_1.randomUUID)() }, ((opts === null || opts === void 0 ? void 0 : opts.zoneId) ? { zoneId: opts.zoneId } : {}));
}
function systemActor(overrides) {
    var _a, _b, _c;
    return Object.assign({ userId: (_a = overrides === null || overrides === void 0 ? void 0 : overrides.userId) !== null && _a !== void 0 ? _a : "system", roles: (_b = overrides === null || overrides === void 0 ? void 0 : overrides.roles) !== null && _b !== void 0 ? _b : ["system"], permissions: (_c = overrides === null || overrides === void 0 ? void 0 : overrides.permissions) !== null && _c !== void 0 ? _c : [
            "order:create", "order:edit", "order:process", "order:pay", "order:view",
            "table:create", "table:edit", "table:view",
            "inventory:create", "inventory:edit", "inventory:view",
            "reservation:view", "reservation:manage",
            "waitlist:view", "waitlist:manage",
            "menu:view", "menu:manage",
            "staff:view", "staff:schedule", "staff:clock",
            "integration:view", "integration:manage",
            "audit:view",
        ] }, overrides);
}
function assertTenant(actual, expected) {
    if (actual.orgId !== expected.orgId || actual.venueId !== expected.venueId) {
        throw (0, types_1.kernelError)("TENANT_MISMATCH", "Cross-tenant access denied");
    }
}
function tenantFromEnv() {
    const orgId = process.env.ROS_ORG_ID;
    const venueId = process.env.ROS_VENUE_ID;
    if (!orgId || !venueId)
        return null;
    return Object.assign({ orgId, venueId }, (process.env.ROS_ZONE_ID ? { zoneId: process.env.ROS_ZONE_ID } : {}));
}
