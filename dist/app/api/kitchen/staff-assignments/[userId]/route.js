"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DELETE = void 0;
const server_1 = require("next/server");
const prisma_1 = __importDefault(require("@/lib/prisma"));
const auth_middleware_1 = require("@/middleware/auth-middleware");
// DELETE - Remove a staff assignment
exports.DELETE = (0, auth_middleware_1.withAuth)(async (req) => {
    const { params: { userId } } = req;
    try {
        // Check if assignment exists
        const existingAssignment = await prisma_1.default.kitchenStaffAssignment.findUnique({
            where: { userId },
        });
        if (!existingAssignment) {
            return server_1.NextResponse.json({ error: "Staff assignment not found" }, { status: 404 });
        }
        // Delete the assignment
        await prisma_1.default.kitchenStaffAssignment.delete({
            where: { userId },
        });
        return server_1.NextResponse.json({ success: true });
    }
    catch (error) {
        console.error("Error deleting staff assignment:", error);
        return server_1.NextResponse.json({ error: "Failed to delete staff assignment" }, { status: 500 });
    }
});
