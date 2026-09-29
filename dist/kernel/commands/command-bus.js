"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CommandBus = void 0;
const crypto_1 = require("crypto");
const types_1 = require("@/kernel/types");
class CommandBus {
    constructor(deps) {
        this.deps = deps;
        this.handlers = new Map();
        this.policies = [];
    }
    use(policy) {
        this.policies.push(policy);
        return () => this.removePolicy(policy.id);
    }
    removePolicy(id) {
        this.policies = this.policies.filter((p) => p.id !== id);
    }
    register(handler) {
        if (this.handlers.has(handler.commandType)) {
            throw (0, types_1.kernelError)("DUPLICATE_HANDLER", `Command handler already registered: ${handler.commandType}`);
        }
        this.handlers.set(handler.commandType, handler);
    }
    registeredCommands() {
        return [...this.handlers.keys()];
    }
    async dispatch(commandType, payload, ctx) {
        const handler = this.handlers.get(commandType);
        const commandId = (0, crypto_1.randomUUID)();
        if (!handler) {
            return { success: false, commandId, error: (0, types_1.kernelError)("UNKNOWN_COMMAND", `No handler for "${commandType}"`) };
        }
        if (handler.requiredPermission && !ctx.actor.permissions.includes(handler.requiredPermission)) {
            return {
                success: false,
                commandId,
                error: (0, types_1.kernelError)("FORBIDDEN", `Missing permission "${handler.requiredPermission}"`),
            };
        }
        const command = {
            commandId,
            commandType,
            payload,
            tenant: ctx.tenant,
            actor: ctx.actor,
            requestId: ctx.requestId,
            issuedAt: new Date().toISOString(),
        };
        const deps = Object.assign({ events: this.deps.events, hooks: this.deps.hooks, projections: this.deps.projections, repository: this.deps.repository }, ctx);
        await this.deps.hooks.emit("command:before", { command });
        for (const policy of this.policies) {
            const veto = await policy.check(command, deps).catch((err) => normalizeError(err));
            if (veto) {
                const rejected = { success: false, commandId, error: veto };
                await this.deps.hooks.emit("command:failed", { command, result: rejected });
                return rejected;
            }
        }
        try {
            const result = await handler.handle(command, deps);
            await this.deps.hooks.emit("command:after", { command, result });
            return result;
        }
        catch (err) {
            const failed = { success: false, commandId, error: normalizeError(err) };
            await this.deps.hooks.emit("command:failed", { command, result: failed });
            return failed;
        }
    }
}
exports.CommandBus = CommandBus;
function normalizeError(err) {
    if (err && typeof err === "object" && "code" in err && "message" in err) {
        const e = err;
        return (0, types_1.kernelError)(String(e.code), String(e.message), e.details);
    }
    return (0, types_1.kernelError)("HANDLER_FAILED", err instanceof Error ? err.message : String(err));
}
