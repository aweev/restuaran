"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sql = void 0;
exports.snakeToCamel = snakeToCamel;
exports.camelToSnake = camelToSnake;
const serverless_1 = require("@neondatabase/serverless");
// Connection string is required in production; the localhost fallback exists
// only so `next dev` runs without infra.
const isProduction = process.env.NODE_ENV === "production";
const connectionString = process.env.DATABASE_URL;
if (!connectionString && isProduction) {
    throw new Error("DATABASE_URL is required in production");
}
const rawSql = (0, serverless_1.neon)(connectionString || "postgresql://postgres:postgres@localhost:5432/restau_pos");
// Dev-only resilience: with no local database running, degrade to empty data so
// the app boots. NEVER do this in production — an outage would be misread as
// empty results (phantom not-found errors, spurious version conflicts).
function swallowIfDev(err) {
    var _a, _b;
    const connectionDown = ((_a = err === null || err === void 0 ? void 0 : err.sourceError) === null || _a === void 0 ? void 0 : _a.code) === "ECONNREFUSED" || String((_b = err === null || err === void 0 ? void 0 : err.message) !== null && _b !== void 0 ? _b : "").includes("fetch failed");
    if (connectionDown && !isProduction) {
        console.warn("Database connection unavailable, falling back to safe empty dataset (dev only).");
        return [];
    }
    throw err;
}
exports.sql = Object.assign(async (strings, ...values) => {
    try {
        return await rawSql(strings, ...values);
    }
    catch (err) {
        return swallowIfDev(err);
    }
}, {
    unsafe: async (query, params) => {
        try {
            return await rawSql.unsafe(query, params);
        }
        catch (err) {
            return swallowIfDev(err);
        }
    },
    transaction: rawSql.transaction,
});
// Helper function to convert snake_case to camelCase
function snakeToCamel(obj) {
    if (obj === null || typeof obj !== "object") {
        return obj;
    }
    if (Array.isArray(obj)) {
        return obj.map(snakeToCamel);
    }
    return Object.keys(obj).reduce((acc, key) => {
        const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
        acc[camelKey] = snakeToCamel(obj[key]);
        return acc;
    }, {});
}
// Helper function to convert camelCase to snake_case
function camelToSnake(obj) {
    if (obj === null || typeof obj !== "object") {
        return obj;
    }
    if (Array.isArray(obj)) {
        return obj.map(camelToSnake);
    }
    return Object.keys(obj).reduce((acc, key) => {
        const snakeKey = key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
        acc[snakeKey] = camelToSnake(obj[key]);
        return acc;
    }, {});
}
