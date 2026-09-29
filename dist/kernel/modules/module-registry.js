"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ModuleRegistry = void 0;
class ModuleRegistry {
    constructor() {
        this.modules = new Map();
    }
    list() {
        return [...this.modules.values()].map((r) => ({
            id: r.module.id,
            name: r.module.name,
            version: r.module.version,
            status: r.status,
        }));
    }
    get(id) {
        var _a;
        return (_a = this.modules.get(id)) === null || _a === void 0 ? void 0 : _a.module;
    }
    async install(module, runtime) {
        var _a, _b, _c, _d, _e;
        if (this.modules.has(module.id)) {
            throw new Error(`Module already installed: ${module.id}`);
        }
        for (const dep of (_a = module.dependencies) !== null && _a !== void 0 ? _a : []) {
            const d = this.modules.get(dep);
            if (!d || d.status !== "active") {
                throw new Error(`Module "${module.id}" requires active dependency "${dep}"`);
            }
        }
        const record = { module, status: "installed" };
        this.modules.set(module.id, record);
        try {
            await ((_c = (_b = module.lifecycle) === null || _b === void 0 ? void 0 : _b.validate) === null || _c === void 0 ? void 0 : _c.call(_b));
            await ((_e = (_d = module.lifecycle) === null || _d === void 0 ? void 0 : _d.install) === null || _e === void 0 ? void 0 : _e.call(_d, runtime));
        }
        catch (err) {
            record.status = "failed";
            throw err;
        }
    }
    async activate(id, runtime) {
        var _a, _b;
        const record = this.modules.get(id);
        if (!record)
            throw new Error(`Module not installed: ${id}`);
        await ((_b = (_a = record.module.lifecycle) === null || _a === void 0 ? void 0 : _a.activate) === null || _b === void 0 ? void 0 : _b.call(_a, runtime));
        record.status = "active";
    }
    async deactivate(id, runtime) {
        var _a, _b;
        const record = this.modules.get(id);
        if (!record)
            return;
        try {
            await ((_b = (_a = record.module.lifecycle) === null || _a === void 0 ? void 0 : _a.deactivate) === null || _b === void 0 ? void 0 : _b.call(_a, runtime));
        }
        finally {
            record.status = "inactive";
        }
    }
    async uninstall(id, runtime) {
        var _a, _b;
        const record = this.modules.get(id);
        if (!record)
            return;
        if (record.status === "active")
            await this.deactivate(id, runtime);
        await ((_b = (_a = record.module.lifecycle) === null || _a === void 0 ? void 0 : _a.uninstall) === null || _b === void 0 ? void 0 : _b.call(_a, runtime));
        this.modules.delete(id);
    }
    activeModules() {
        return [...this.modules.values()].filter((r) => r.status === "active").map((r) => r.module);
    }
}
exports.ModuleRegistry = ModuleRegistry;
