"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = void 0;
const server_1 = require("next/server");
const prisma_1 = __importDefault(require("@/lib/prisma"));
const auth_middleware_1 = require("@/middleware/auth-middleware");
const zod_1 = require("zod");
// Schema for seating a customer
const seatCustomerSchema = zod_1.z.object({
    tableId: zod_1.z.string().uuid("Invalid table ID"),
});
// POST - Seat a customer from the wait list
exports.POST = (0, auth_middleware_1.withAuth)(async (req, { params }) => {
    try {
        const { id } = params;
        const body = await req.json();
        // Validate request body
        const validatedData = seatCustomerSchema.parse(body);
        // Check if wait list entry exists
        const waitListEntry = await prisma_1.default.waitList.findUnique({
            where: { id },
        });
        if (!waitListEntry) {
            return server_1.NextResponse.json({ error: "Wait list entry not found" }, { status: 404 });
        }
        // Check if table exists
        const table = await prisma_1.default.table.findUnique({
            where: { id: validatedData.tableId },
        });
        if (!table) {
            return server_1.NextResponse.json({ error: "Table not found" }, { status: 404 });
        }
        // Check if table is available
        if (table.status !== "available") {
            return server_1.NextResponse.json({ error: "Table is not available" }, { status: 400 });
        }
        // Update table status to occupied
        await prisma_1.default.table.update({
            where: { id: validatedData.tableId },
            data: {
                status: "occupied",
                customerName: waitListEntry.customerName,
                customerCount: waitListEntry.partySize,
                startTime: new Date(),
            },
        });
        // Remove from wait list
        await prisma_1.default.waitList.delete({
            where: { id },
        });
        // Log the action
        await prisma_1.default.auditLog.create({
            data: {
                userId: req.user.sub,
                action: "SEAT",
                entity: "WAITLIST",
                entityId: id,
                details: {
                    customerName: waitListEntry.customerName,
                    tableId: validatedData.tableId,
                    tableNumber: table.number,
                },
            },
        });
        return server_1.NextResponse.json({ success: true });
    }
    catch (error) {
        console.error("Error seating customer:", error);
        if (error instanceof zod_1.z.ZodError) {
            return server_1.NextResponse.json({ error: "Validation error", details: error.errors }, { status: 400 });
        }
        return server_1.NextResponse.json({ error: "Failed to seat customer" }, { status: 500 });
    }
});
