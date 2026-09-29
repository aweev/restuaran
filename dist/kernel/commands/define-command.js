"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.defineCommand = defineCommand;
/**
 * Standard shape for every write: load aggregate (guarded), run behavior,
 * commit through the repository (snapshot policy applies), publish events.
 * Keeps handlers declarative and guarantees a uniform CommandResult envelope.
 */
function defineCommand(spec) {
    return {
        commandType: spec.commandType,
        requiredPermission: spec.requiredPermission,
        async handle(command, deps) {
            const allCommitted = [];
            const ctx = {
                deps,
                payload: command.payload,
                actor: command.actor,
                tenant: deps.tenant,
                events: deps.events,
                projections: deps.projections,
                repository: deps.repository,
                commandId: command.commandId,
                load: (aggregateType, aggregateId) => deps.repository.load(aggregateType, deps.tenant, aggregateId),
                loadOrEmpty: (aggregateType, aggregateId) => deps.repository.read(aggregateType, deps.tenant, aggregateId),
                commit: async (agg) => {
                    const committed = await deps.repository.save(agg);
                    allCommitted.push(...committed);
                    for (const e of committed)
                        await deps.hooks.emit("event:published", { event: e });
                    return committed;
                },
            };
            const aggregateId = await spec.execute(ctx);
            return {
                success: true,
                commandId: command.commandId,
                aggregateId: aggregateId !== null && aggregateId !== void 0 ? aggregateId : undefined,
                events: allCommitted,
            };
        },
    };
}
