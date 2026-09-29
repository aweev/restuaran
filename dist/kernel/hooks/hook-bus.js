"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HookBus = void 0;
class HookBus {
    constructor() {
        this.listeners = new Map();
    }
    on(hook, listener) {
        var _a;
        const set = (_a = this.listeners.get(hook)) !== null && _a !== void 0 ? _a : new Set();
        set.add(listener);
        this.listeners.set(hook, set);
        return () => set.delete(listener);
    }
    async emit(hook, payload) {
        const set = this.listeners.get(hook);
        if (!set)
            return;
        for (const listener of set) {
            try {
                await listener(payload);
            }
            catch (err) {
                // A misbehaving hook must never break the kernel write path.
                // eslint-disable-next-line no-console
                console.error(`[kernel:hooks] listener for "${hook}" failed:`, err);
            }
        }
    }
    clear() {
        this.listeners.clear();
    }
}
exports.HookBus = HookBus;
