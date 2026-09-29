"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.QueryBus = void 0;
const types_1 = require("@/kernel/types");
class QueryBus {
    constructor(deps) {
        this.deps = deps;
        this.handlers = new Map();
    }
    register(handler) {
        if (this.handlers.has(handler.queryType)) {
            throw (0, types_1.kernelError)("DUPLICATE_HANDLER", `Query handler already registered: ${handler.queryType}`);
        }
        this.handlers.set(handler.queryType, handler);
    }
    registeredQueries() {
        return [...this.handlers.keys()];
    }
    async ask(queryType, params, ctx) {
        var _a, _b;
        const handler = this.handlers.get(queryType);
        if (!handler) {
            return { success: false, error: (0, types_1.kernelError)("UNKNOWN_QUERY", `No handler for "${queryType}"`) };
        }
        if (handler.requiredPermission && !((_b = (_a = ctx.actor) === null || _a === void 0 ? void 0 : _a.permissions.includes(handler.requiredPermission)) !== null && _b !== void 0 ? _b : false)) {
            return { success: false, error: (0, types_1.kernelError)("FORBIDDEN", `Missing permission "${handler.requiredPermission}"`) };
        }
        try {
            const data = await handler.handle(params, Object.assign(Object.assign({}, ctx), { events: this.deps.events, projections: this.deps.projections, repository: this.deps.repository }));
            return { success: true, data };
        }
        catch (err) {
            return { success: false, error: normalizeError(err) };
        }
    }
}
exports.QueryBus = QueryBus;
function normalizeError(err) {
    if (err && typeof err === "object" && "code" in err && "message" in err) {
        const e = err;
        return (0, types_1.kernelError)(String(e.code), String(e.message), e.details);
    }
    return (0, types_1.kernelError)("QUERY_FAILED", err instanceof Error ? err.message : String(err));
}
