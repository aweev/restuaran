"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runtime = void 0;
exports.POST = POST;
exports.GET = GET;
const server_1 = require("next/server");
const jwt_1 = require("@/lib/jwt");
const kernel_1 = require("@/kernel");
const permission_map_1 = require("@/kernel/tenant/permission-map");
const tenant_1 = require("@/kernel/tenant/tenant");
exports.runtime = "nodejs";
// Single kernel per serverless warm instance; in dev this holds the in-memory event store.
const globalForKernel = globalThis;
function getKernel() {
    var _a;
    if (!globalForKernel.__rosKernel) {
        const tenant = (_a = (0, tenant_1.tenantFromEnv)()) !== null && _a !== void 0 ? _a : { orgId: "default-org", venueId: "default-venue" };
        const kernel = (0, kernel_1.createKernel)({ tenant });
        void kernel.boot();
        globalForKernel.__rosKernel = kernel;
    }
    return globalForKernel.__rosKernel;
}
async function authenticate(req) {
    const token = (0, jwt_1.getTokenFromRequest)(req);
    if (!token)
        return null;
    const payload = await (0, jwt_1.verifyJWT)(token);
    if (!payload)
        return null;
    return (0, permission_map_1.actorFromAuthPayload)(payload);
}
async function POST(req) {
    var _a;
    const actor = await authenticate(req);
    if (!actor)
        return server_1.NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const body = (await req.json());
    if (!body.commandType) {
        return server_1.NextResponse.json({ error: "commandType is required" }, { status: 400 });
    }
    const kernel = getKernel();
    const result = await kernel.execute(body.commandType, (_a = body.payload) !== null && _a !== void 0 ? _a : {}, actor, body.requestId);
    return server_1.NextResponse.json(result, { status: result.success ? 200 : 422 });
}
async function GET(req) {
    const actor = await authenticate(req);
    if (!actor)
        return server_1.NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { searchParams } = new URL(req.url);
    const kernel = getKernel();
    const projectionName = searchParams.get("projection");
    if (projectionName) {
        try {
            const p = kernel.projections.get(projectionName);
            return server_1.NextResponse.json({ name: projectionName, position: p.position, state: p.state });
        }
        catch (_a) {
            return server_1.NextResponse.json({ error: `Unknown projection "${projectionName}"` }, { status: 404 });
        }
    }
    const queryType = searchParams.get("query");
    if (!queryType) {
        return server_1.NextResponse.json({
            commands: kernel.commands.registeredCommands(),
            queries: kernel.queries.registeredQueries(),
            projections: kernel.projections.names(),
        });
    }
    const params = {};
    for (const [k, v] of searchParams.entries()) {
        if (k !== "query")
            params[k] = v;
    }
    const result = await kernel.ask(queryType, params, actor);
    return server_1.NextResponse.json(result, { status: result.success ? 200 : 422 });
}
