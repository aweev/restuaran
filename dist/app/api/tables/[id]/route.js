"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DELETE = exports.PUT = void 0;
exports.GET = GET;
const server_1 = require("next/server");
const prisma_1 = __importDefault(require("@/lib/prisma"));
const auth_middleware_1 = require("@/middleware/auth-middleware");
const zod_1 = require("zod");
// GET a specific table
async function GET(req, { params }) {
    try {
        const { id } = params;
        const table = await prisma_1.default.table.findUnique({
            where: { id },
        });
        if (!table) {
            return server_1.NextResponse.json({ error: "Table not found" }, { status: 404 });
        }
        return server_1.NextResponse.json(table);
    }
    catch (error) {
        console.error("Error fetching table:", error);
        return server_1.NextResponse.json({ error: "Failed to fetch table" }, { status: 500 });
    }
}
// Schema for updating tables
const updateTableSchema = zod_1.z.object({
    number: zod_1.z.string().optional(),
    capacity: zod_1.z.number().int().positive().optional(),
    status: zod_1.z.enum(["available", "occupied", "reserved", "dirty"]).optional(),
    customerName: zod_1.z.string().optional().nullable(),
    customerCount: zod_1.z.number().int().positive().optional().nullable(),
    startTime: zod_1.z.string().datetime().optional().nullable(),
    serverName: zod_1.z.string().optional().nullable(),
    positionX: zod_1.z.number().int().optional(),
    positionY: zod_1.z.number().int().optional(),
});
// PUT - Update a table
exports.PUT = (0, auth_middleware_1.withAuth)(async (req) => {
    var _a, _b;
    const { params } = req;
    try {
        const { id } = params;
        const body = await req.json();
        // Validate request body
        const validatedData = updateTableSchema.parse(body);
        // Check if table exists
        const existingTable = await prisma_1.default.table.findUnique({
            where: { id },
        });
        if (!existingTable) {
            return server_1.NextResponse.json({ error: "Table not found" }, { status: 404 });
        }
        // If number is being updated, check if it already exists
        if (validatedData.number && validatedData.number !== existingTable.number) {
            const tableWithNumber = await prisma_1.default.table.findUnique({
                where: { number: validatedData.number },
            });
            if (tableWithNumber) {
                return server_1.NextResponse.json({ error: "Table number already exists" }, { status: 400 });
            }
        }
        // Update table
        const updatedTable = await prisma_1.default.table.update({
            where: { id },
            data: validatedData,
        });
        // Log the action
        await prisma_1.default.auditLog.create({
            data: {
                userId: (_b = (_a = req.user) === null || _a === void 0 ? void 0 : _a.sub) !== null && _b !== void 0 ? _b : "unknown",
                action: "UPDATE",
                entity: "TABLE",
                entityId: id,
                details: { number: updatedTable.number, status: updatedTable.status },
            },
        });
        return server_1.NextResponse.json(updatedTable);
    }
    catch (error) {
        console.error("Error updating table:", error);
        if (error instanceof zod_1.z.ZodError) {
            return server_1.NextResponse.json({ error: "Validation error", details: error.errors }, { status: 400 });
        }
        return server_1.NextResponse.json({ error: "Failed to update table" }, { status: 500 });
    }
});
// DELETE - Delete a table
exports.DELETE = (0, auth_middleware_1.withAuth)(async (req) => {
    var _a, _b;
    const { params } = req;
    try {
        const { id } = params;
        // Check if table exists
        const existingTable = await prisma_1.default.table.findUnique({
            where: { id },
        });
        if (!existingTable) {
            return server_1.NextResponse.json({ error: "Table not found" }, { status: 404 });
        }
        // Delete table
        await prisma_1.default.table.delete({
            where: { id },
        });
        // Log the action
        await prisma_1.default.auditLog.create({
            data: {
                userId: (_b = (_a = req.user) === null || _a === void 0 ? void 0 : _a.sub) !== null && _b !== void 0 ? _b : "unknown",
                action: "DELETE",
                entity: "TABLE",
                entityId: id,
                details: { number: existingTable.number },
            },
        });
        return server_1.NextResponse.json({ success: true });
    }
    catch (error) {
        console.error("Error deleting table:", error);
        return server_1.NextResponse.json({ error: "Failed to delete table" }, { status: 500 });
    }
});
