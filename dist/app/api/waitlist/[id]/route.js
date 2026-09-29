"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DELETE = exports.PATCH = exports.GET = void 0;
const server_1 = require("next/server");
const prisma_1 = __importDefault(require("@/lib/prisma"));
const auth_middleware_1 = require("@/middleware/auth-middleware");
const zod_1 = require("zod");
// GET - Fetch a specific wait list entry
exports.GET = (0, auth_middleware_1.withAuth)(async (req, { params }) => {
    try {
        const { id } = params;
        const waitListEntry = await prisma_1.default.waitList.findUnique({
            where: { id },
        });
        if (!waitListEntry) {
            return server_1.NextResponse.json({ error: "Wait list entry not found" }, { status: 404 });
        }
        return server_1.NextResponse.json(waitListEntry);
    }
    catch (error) {
        console.error("Error fetching wait list entry:", error);
        return server_1.NextResponse.json({ error: "Failed to fetch wait list entry" }, { status: 500 });
    }
});
// Schema for updating wait list entries
const updateWaitListSchema = zod_1.z.object({
    customerName: zod_1.z.string().min(1, "Customer name is required").optional(),
    phoneNumber: zod_1.z.string().optional(),
    partySize: zod_1.z.number().int().positive().optional(),
    estimatedWaitTime: zod_1.z.number().int().min(0).optional(),
    notes: zod_1.z.string().optional(),
    notified: zod_1.z.boolean().optional(),
});
// PATCH - Update a wait list entry
exports.PATCH = (0, auth_middleware_1.withAuth)(async (req, { params }) => {
    try {
        const { id } = params;
        const body = await req.json();
        // Validate request body
        const validatedData = updateWaitListSchema.parse(body);
        // Check if wait list entry exists
        const existingEntry = await prisma_1.default.waitList.findUnique({
            where: { id },
        });
        if (!existingEntry) {
            return server_1.NextResponse.json({ error: "Wait list entry not found" }, { status: 404 });
        }
        // Update wait list entry
        const updatedEntry = await prisma_1.default.waitList.update({
            where: { id },
            data: validatedData,
        });
        // Log the action
        await prisma_1.default.auditLog.create({
            data: {
                userId: req.user.sub,
                action: "UPDATE",
                entity: "WAITLIST",
                entityId: id,
                details: {
                    customerName: updatedEntry.customerName,
                    notified: updatedEntry.notified,
                },
            },
        });
        return server_1.NextResponse.json(updatedEntry);
    }
    catch (error) {
        console.error("Error updating wait list entry:", error);
        if (error instanceof zod_1.z.ZodError) {
            return server_1.NextResponse.json({ error: "Validation error", details: error.errors }, { status: 400 });
        }
        return server_1.NextResponse.json({ error: "Failed to update wait list entry" }, { status: 500 });
    }
});
// DELETE - Remove a wait list entry
exports.DELETE = (0, auth_middleware_1.withAuth)(async (req, { params }) => {
    try {
        const { id } = params;
        // Check if wait list entry exists
        const existingEntry = await prisma_1.default.waitList.findUnique({
            where: { id },
        });
        if (!existingEntry) {
            return server_1.NextResponse.json({ error: "Wait list entry not found" }, { status: 404 });
        }
        // Delete wait list entry
        await prisma_1.default.waitList.delete({
            where: { id },
        });
        // Log the action
        await prisma_1.default.auditLog.create({
            data: {
                userId: req.user.sub,
                action: "DELETE",
                entity: "WAITLIST",
                entityId: id,
                details: {
                    customerName: existingEntry.customerName,
                },
            },
        });
        return server_1.NextResponse.json({ success: true });
    }
    catch (error) {
        console.error("Error deleting wait list entry:", error);
        return server_1.NextResponse.json({ error: "Failed to delete wait list entry" }, { status: 500 });
    }
});
