"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.configuredApiKeys = configuredApiKeys;
exports.apiKeyFromHeaders = apiKeyFromHeaders;
exports.checkApiKey = checkApiKey;
const permission_map_1 = require("@/kernel/tenant/permission-map");
/**
 * Static API keys for the public REST API (/api/v1).
 *
 * Configuration (either env works):
 *   ROS_PUBLIC_API_KEYS="key-one,key-two=manager"   // "key" or "key=role"
 *   ROS_PUBLIC_API_KEY="single-dev-key"            // shorthand (role: admin)
 *
 * No keys configured => the public API answers 503 PUBLIC_API_DISABLED.
 * Multi-tenant key -> venue mapping is a future concern; keys currently act on
 * the kernel's tenant (ROS_ORG_ID / ROS_VENUE_ID, or the dev default).
 */
function configuredApiKeys() {
    var _a, _b;
    const raw = (_b = (_a = process.env.ROS_PUBLIC_API_KEYS) !== null && _a !== void 0 ? _a : process.env.ROS_PUBLIC_API_KEY) !== null && _b !== void 0 ? _b : "";
    return raw
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean)
        .map((entry) => {
        const [key, role] = entry.split("=");
        return { key: key.trim(), role: (role !== null && role !== void 0 ? role : "admin").trim() };
    })
        .filter((entry) => entry.key.length > 0);
}
/** Extract "..." from `Authorization: Bearer ...` or the x-api-key header. */
function apiKeyFromHeaders(headers) {
    const auth = headers.get("authorization");
    if (auth) {
        const match = /^Bearer\s+(.+)$/i.exec(auth.trim());
        if (match)
            return match[1].trim();
    }
    return headers.get("x-api-key");
}
function checkApiKey(provided) {
    const keys = configuredApiKeys();
    if (keys.length === 0)
        return { status: "disabled" };
    if (!provided)
        return { status: "unauthorized" };
    const match = keys.find((k) => k.key === provided);
    if (!match)
        return { status: "unauthorized" };
    return {
        status: "ok",
        role: match.role,
        actor: (0, permission_map_1.actorFromAuthPayload)({ sub: `public-api:${match.role}`, role: match.role }),
    };
}
