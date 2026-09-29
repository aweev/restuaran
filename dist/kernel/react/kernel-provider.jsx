"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.KernelProvider = KernelProvider;
exports.useKernel = useKernel;
exports.useCommand = useCommand;
exports.useProjection = useProjection;
const react_1 = require("react");
const KernelContext = (0, react_1.createContext)(null);
async function postCommand(body) {
    const res = await fetch("/api/kernel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        credentials: "include",
    });
    return (await res.json());
}
function qs(params, extra) {
    const sp = new URLSearchParams(extra);
    for (const [k, v] of Object.entries(params))
        sp.set(k, String(v));
    return sp.toString();
}
function KernelProvider({ children }) {
    const execute = (0, react_1.useCallback)((commandType, payload, requestId) => postCommand({ commandType, payload, requestId }), []);
    const ask = (0, react_1.useCallback)(async (queryType, params) => {
        const res = await fetch(`/api/kernel?${qs(params, { query: queryType })}`, { credentials: "include" });
        return (await res.json());
    }, []);
    const readProjection = (0, react_1.useCallback)(async (name) => {
        const res = await fetch(`/api/kernel?projection=${encodeURIComponent(name)}`, { credentials: "include" });
        if (!res.ok)
            throw new Error(`Unknown projection: ${name}`);
        return (await res.json());
    }, []);
    const subscribeProjection = (0, react_1.useCallback)((name, intervalMs, cb) => {
        let active = true;
        let lastPosition = -1;
        const tick = async () => {
            try {
                const envelope = await readProjection(name);
                if (active && envelope.position !== lastPosition) {
                    lastPosition = envelope.position;
                    cb(envelope);
                }
            }
            catch (_a) {
                // transient server error; next tick retries
            }
        };
        void tick();
        const id = setInterval(tick, intervalMs);
        return () => {
            active = false;
            clearInterval(id);
        };
    }, [readProjection]);
    const value = (0, react_1.useMemo)(() => ({ execute, ask, readProjection, subscribeProjection }), [execute, ask, readProjection, subscribeProjection]);
    return <KernelContext.Provider value={value}>{children}</KernelContext.Provider>;
}
function useKernel() {
    const ctx = (0, react_1.useContext)(KernelContext);
    if (!ctx)
        throw new Error("useKernel must be used within <KernelProvider>");
    return ctx;
}
function useCommand() {
    const { execute } = useKernel();
    const [pending, setPending] = (0, react_1.useState)(false);
    const run = (0, react_1.useCallback)(async (commandType, payload) => {
        setPending(true);
        try {
            return await execute(commandType, payload);
        }
        finally {
            setPending(false);
        }
    }, [execute]);
    return { run, pending };
}
function useProjection(name, intervalMs = 1000) {
    var _a, _b;
    const { subscribeProjection } = useKernel();
    const [envelope, setEnvelope] = (0, react_1.useState)(null);
    const [error, setError] = (0, react_1.useState)(null);
    const subRef = (0, react_1.useRef)(null);
    (0, react_1.useEffect)(() => {
        subRef.current = subscribeProjection(name, intervalMs, (env) => {
            setEnvelope(env);
            setError(null);
        });
        return () => { var _a; return (_a = subRef.current) === null || _a === void 0 ? void 0 : _a.call(subRef); };
    }, [subscribeProjection, name, intervalMs]);
    return { state: (_a = envelope === null || envelope === void 0 ? void 0 : envelope.state) !== null && _a !== void 0 ? _a : null, position: (_b = envelope === null || envelope === void 0 ? void 0 : envelope.position) !== null && _b !== void 0 ? _b : -1, error };
}
