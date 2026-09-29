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
// Schema for staff assignment
const staffAssignmentSchema = zod_1.z.object({
    userId: zod_1.z.string(),
    userName: zod_1.z.string(),
    station: zod_1.z.string(),
    assignedOrders: zod_1.z.array(zod_1.z.string()).optional(),
});
// GET - Fetch all staff assignments
exports.GET = (0, auth_middleware_1.withAuth)(async () => {
    try {
        const staffAssignments = await prisma_1.default.kitchenStaffAssignment.findMany({
            include: {
                assignedOrders: true,
            },
        });
        const formattedAssignments = staffAssignments.map((assignment) => ({
            userId: assignment.userId,
            userName: assignment.userName,
            station: assignment.station,
            assignedOrders: assignment.assignedOrders.map((order) => order.orderId),
        }));
        return server_1.NextResponse.json(formattedAssignments);
    }
    catch (error) {
        console.error("Error fetching staff assignments:", error);
        return server_1.NextResponse.json({ error: "Failed to fetch staff assignments" }, { status: 500 });
    }
});
// POST - Create or update a staff assignment
exports.POST = (0, auth_middleware_1.withAuth)(async (req) => {
    try {
        const body = await req.json();
        // Validate request body
        const validatedData = staffAssignmentSchema.parse(body);
        // Check if assignment already exists
        const existingAssignment = await prisma_1.default.kitchenStaffAssignment.findUnique({
            where: { userId: validatedData.userId },
        });
        if (existingAssignment) {
            // Update existing assignment
            const updatedAssignment = await prisma_1.default.kitchenStaffAssignment.update({
                where: { userId: validatedData.userId },
                data: {
                    userName: validatedData.userName,
                    station: validatedData.station,
                },
            });
            return server_1.NextResponse.json(updatedAssignment);
        }
        else {
            // Create new assignment
            const newAssignment = await prisma_1.default.kitchenStaffAssignment.create({
                data: {
                    userId: validatedData.userId,
                    userName: validatedData.userName,
                    station: validatedData.station,
                },
            });
            return server_1.NextResponse.json(newAssignment);
        }
    }
    catch (error) {
        console.error("Error creating/updating staff assignment:", error);
        if (error instanceof zod_1.z.ZodError) {
            return server_1.NextResponse.json({ error: "Validation error", details: error.errors }, { status: 400 });
        }
        return server_1.NextResponse.json({ error: "Failed to create/update staff assignment" }, { status: 500 });
    }
});
