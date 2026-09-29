"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deriveCapabilities = deriveCapabilities;
exports.actorFromAuthPayload = actorFromAuthPayload;
// Kernel capabilities are intentionally decoupled from any single RBAC taxonomy.
// This adapter maps the host app's granular permission names (and role defaults)
// onto the coarse capabilities the kernel checks.
const GRANULAR_TO_CAPABILITY = {
    // Phase 3 integrations (webhooks, outbound deliveries)
    "integration:manage_webhooks": ["integration:manage"],
    "integration:view_deliveries": ["integration:view"],
    "order:create": ["order:create"],
    "order:edit_own": ["order:edit"],
    "order:edit_any": ["order:edit"],
    "order:change_status": ["order:process"],
    "order:process_payment": ["order:pay", "order:edit"],
    "order:issue_refund": ["order:pay"],
    "order:split_bill": ["order:edit"],
    "order:transfer_items": ["order:edit"],
    "order:view_all": ["order:view"],
    "order:view_assigned": ["order:view"],
    "table:change_status": ["table:edit"],
    "table:assign_to_order": ["table:edit"],
    "table:assign_server": ["table:edit"],
    "table:view_status": ["table:view"],
    "table_layout:edit": ["table:create"],
    "inventory:view": ["inventory:view"],
    "inventory:create": ["inventory:create"],
    "inventory:edit": ["inventory:edit"],
    "inventory:delete": ["inventory:edit"],
    "inventory:view_stock": ["inventory:view"],
    "inventory:manage_ingredients": ["inventory:create", "inventory:edit"],
    "inventory:perform_stock_take": ["inventory:edit"],
    "inventory:record_wastage": ["inventory:edit"],
    // Reservations & waitlist
    "reservation:view": ["reservation:view"],
    "reservation:create": ["reservation:manage"],
    "reservation:edit": ["reservation:manage"],
    "reservation:cancel": ["reservation:manage"],
    "reservation:seat_party": ["reservation:manage", "table:edit"],
    "waitlist:manage": ["waitlist:view", "waitlist:manage"],
    // Menu
    "menu:view": ["menu:view"],
    "menu:create_items": ["menu:manage"],
    "menu:edit_items": ["menu:manage"],
    "menu:delete_items": ["menu:manage"],
    "menu:set_availability": ["menu:manage"],
    "menu:set_pricing": ["menu:manage"],
    "menu:manage_modifiers": ["menu:manage"],
    // Staff scheduling & time clock
    "user:manage_shifts": ["staff:schedule", "staff:view"],
    "user:view_list": ["staff:view"],
    "user:view_details": ["staff:view"],
    // Audit
    "audit_log:view": ["audit:view"],
};
const ROLE_TO_CAPABILITIES = {
    admin: [
        "order:create", "order:edit", "order:process", "order:pay", "order:view",
        "table:create", "table:edit", "table:view",
        "inventory:create", "inventory:edit", "inventory:view",
        "reservation:view", "reservation:manage",
        "waitlist:view", "waitlist:manage",
        "menu:view", "menu:manage",
        "staff:view", "staff:schedule", "staff:clock",
        "integration:view", "integration:manage",
        "audit:view",
    ],
    manager: [
        "order:create", "order:edit", "order:process", "order:pay", "order:view",
        "table:create", "table:edit", "table:view",
        "inventory:create", "inventory:edit", "inventory:view",
        "reservation:view", "reservation:manage",
        "waitlist:view", "waitlist:manage",
        "menu:view", "menu:manage",
        "staff:view", "staff:schedule", "staff:clock",
        "integration:view", "integration:manage",
        "audit:view",
    ],
    owner: [
        "order:create", "order:edit", "order:process", "order:pay", "order:view",
        "table:create", "table:edit", "table:view",
        "inventory:create", "inventory:edit", "inventory:view",
        "reservation:view", "reservation:manage",
        "waitlist:view", "waitlist:manage",
        "menu:view", "menu:manage",
        "staff:view", "staff:schedule",
        "integration:view", "integration:manage",
        "audit:view",
    ],
    waiter: ["order:create", "order:edit", "order:view", "table:view", "table:edit", "reservation:view", "waitlist:view", "menu:view"],
    server: ["order:create", "order:edit", "order:view", "table:view", "table:edit", "reservation:view", "waitlist:view", "menu:view"],
    host: ["reservation:view", "reservation:manage", "waitlist:view", "waitlist:manage", "table:view"],
    "host_staff": ["reservation:view", "reservation:manage", "waitlist:view", "waitlist:manage", "table:view"],
    cashier: ["order:create", "order:edit", "order:pay", "order:view", "table:view", "reservation:view", "menu:view"],
    kitchen: ["order:view", "order:process", "inventory:view", "menu:view"],
    staff: ["order:create", "order:edit", "order:view", "table:view", "menu:view", "staff:clock"],
};
function deriveCapabilities(payload) {
    var _a, _b, _c, _d;
    const caps = new Set();
    const role = String((_a = payload.role) !== null && _a !== void 0 ? _a : "");
    for (const c of (_b = ROLE_TO_CAPABILITIES[role]) !== null && _b !== void 0 ? _b : [])
        caps.add(c);
    for (const p of (_c = payload.permissions) !== null && _c !== void 0 ? _c : []) {
        for (const c of (_d = GRANULAR_TO_CAPABILITY[p]) !== null && _d !== void 0 ? _d : [])
            caps.add(c);
    }
    return [...caps];
}
function actorFromAuthPayload(payload, device) {
    var _a;
    return Object.assign({ userId: payload.sub, roles: [(_a = payload.role) !== null && _a !== void 0 ? _a : "staff"], permissions: deriveCapabilities(payload) }, (device ? { device } : {}));
}
