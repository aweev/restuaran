"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = exports.GET = void 0;
const server_1 = require("next/server");
const prisma_1 = __importDefault(require("@/lib/prisma"));
const auth_middleware_1 = require("@/middleware/auth-middleware");
const zod_1 = require("zod");
// GET - Fetch all wait list entries
exports.GET = (0, auth_middleware_1.withAuth)(async (req) => {
    try {
        const waitList = await prisma_1.default.waitList.findMany({
            orderBy: {
                createdAt: "asc",
            },
        });
        return server_1.NextResponse.json(waitList);
    }
    catch (error) {
        console.error("Error fetching wait list:", error);
        return server_1.NextResponse.json({ error: "Failed to fetch wait list" }, { status: 500 });
    }
});
// Schema for creating wait list entries
const createWaitListSchema = zod_1.z.object({
    customerName: zod_1.z.string().min(1, "Customer name is required"),
    phoneNumber: zod_1.z.string().optional(),
    partySize: zod_1.z.number().int().positive(),
    estimatedWaitTime: zod_1.z.number().int().min(0),
    notes: zod_1.z.string().optional(),
});
// POST - Create a new wait list entry
exports.POST = (0, auth_middleware_1.withAuth)(async (req) => {
    try {
        const body = await req.json();
        // Validate request body
        const validatedData = createWaitListSchema.parse(body);
        // Create wait list entry
        const waitListEntry = await prisma_1.default.waitList.create({
            data: {
                customerName: validatedData.customerName,
                phoneNumber: validatedData.phoneNumber || "",
                partySize: validatedData.partySize,
                estimatedWaitTime: validatedData.estimatedWaitTime,
                notes: validatedData.notes || "",
                notified: false,
            },
        });
        // Log the action
        await prisma_1.default.auditLog.create({
            data: {
                userId: req.user.sub,
                action: "CREATE",
                entity: "WAITLIST",
                entityId: waitListEntry.id,
                details: {
                    customerName: waitListEntry.customerName,
                    partySize: waitListEntry.partySize,
                },
            },
        });
        return server_1.NextResponse.json(waitListEntry, { status: 201 });
    }
    catch (error) {
        console.error("Error creating wait list entry:", error);
        if (error instanceof zod_1.z.ZodError) {
            return server_1.NextResponse.json({ error: "Validation error", details: error.errors }, { status: 400 });
        }
        return server_1.NextResponse.json({ error: "Failed to create wait list entry" }, { status: 500 });
    }
});
