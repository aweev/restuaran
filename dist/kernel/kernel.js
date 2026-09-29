"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Kernel = void 0;
const crypto_1 = require("crypto");
const versioned_store_1 = require("@/kernel/event-store/versioned-store");
const command_bus_1 = require("@/kernel/commands/command-bus");
const query_bus_1 = require("@/kernel/queries/query-bus");
const hook_bus_1 = require("@/kernel/hooks/hook-bus");
const projection_1 = require("@/kernel/projections/projection");
const module_registry_1 = require("@/kernel/modules/module-registry");
const repository_1 = require("@/kernel/aggregates/repository");
const registry_1 = require("@/kernel/aggregates/registry");
class Kernel {
    get version() {
        return this.store instanceof versioned_store_1.VersionedEventStore ? this.store.version : versioned_store_1.CURRENT_SCHEMA_VERSION;
    }
    constructor(cfg) {
        var _a, _b;
        this.hooks = new hook_bus_1.HookBus();
        this.modules = new module_registry_1.ModuleRegistry();
        this.disposers = [];
        this.store = cfg.store;
        this.tenant = cfg.tenant;
        this.projections = (_a = cfg.projections) !== null && _a !== void 0 ? _a : new projection_1.ProjectionRegistry();
        this.repository = new repository_1.AggregateRepository({
            events: cfg.store,
            snapshot: cfg.snapshot,
            load: registry_1.loadExisting,
            read: registry_1.loadAggregate,
            saveAggregate: registry_1.saveAggregate,
        });
        this.commands = new command_bus_1.CommandBus({
            events: cfg.store,
            hooks: this.hooks,
            projections: this.projections,
            repository: this.repository,
        });
        this.queries = new query_bus_1.QueryBus({ events: cfg.store, projections: this.projections, repository: this.repository });
        this.config = (_b = cfg.config) !== null && _b !== void 0 ? _b : {};
    }
    runtime() {
        return {
            kernel: this,
            commands: this.commands,
            queries: this.queries,
            hooks: this.hooks,
            events: this.store,
            projections: this.projections,
            repository: this.repository,
            tenant: this.tenant,
            config: this.config,
        };
    }
    async execute(commandType, payload, actor, requestId) {
        return this.commands.dispatch(commandType, payload, {
            tenant: this.tenant,
            actor,
            requestId: requestId !== null && requestId !== void 0 ? requestId : (0, crypto_1.randomUUID)(),
        });
    }
    async ask(queryType, params, actor) {
        return this.queries.ask(queryType, params, { tenant: this.tenant, actor });
    }
    async installModule(module, activate = true) {
        const runtime = this.runtime();
        await this.modules.install(module, runtime);
        if (activate)
            await this.modules.activate(module.id, runtime);
    }
    async boot() {
        await this.projections.rebuildAll();
        this.projections.startAll();
    }
    /** Register cleanup (timers, schedulers) run by shutdown(). */
    addDisposer(dispose) {
        this.disposers.push(dispose);
    }
    async shutdown() {
        this.projections.stopAll();
        for (const dispose of this.disposers.splice(0)) {
            try {
                dispose();
            }
            catch (err) {
                console.error("[kernel:shutdown] disposer failed:", err);
            }
        }
    }
}
exports.Kernel = Kernel;
