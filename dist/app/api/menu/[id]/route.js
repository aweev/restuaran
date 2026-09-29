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
// GET a specific menu item
async function GET(req, { params }) {
    try {
        const { id } = params;
        const menuItem = await prisma_1.default.menuItem.findUnique({
            where: { id },
            include: {
                modifiers: {
                    include: {
                        options: true,
                    },
                },
            },
        });
        if (!menuItem) {
            return server_1.NextResponse.json({ error: "Menu item not found" }, { status: 404 });
        }
        return server_1.NextResponse.json(menuItem);
    }
    catch (error) {
        console.error("Error fetching menu item:", error);
        return server_1.NextResponse.json({ error: "Failed to fetch menu item" }, { status: 500 });
    }
}
// Schema for updating menu items
const updateMenuItemSchema = zod_1.z.object({
    title: zod_1.z.string().min(3, "Title must be at least 3 characters").optional(),
    description: zod_1.z.string().optional(),
    price: zod_1.z.number().positive("Price must be positive").optional(),
    image: zod_1.z.string().optional(),
    category: zod_1.z.string().optional(),
    type: zod_1.z.enum(["Veg", "NonVeg"]).optional(),
    available: zod_1.z.boolean().optional(),
    discount: zod_1.z.number().optional().nullable(),
    popular: zod_1.z.boolean().optional(),
    allergens: zod_1.z.array(zod_1.z.string()).optional(),
    calories: zod_1.z.number().optional().nullable(),
    protein: zod_1.z.number().optional().nullable(),
    carbs: zod_1.z.number().optional().nullable(),
    fat: zod_1.z.number().optional().nullable(),
});
// PUT - Update a menu item
exports.PUT = (0, auth_middleware_1.withAuth)(async (req) => {
    const { params } = req;
    try {
        const { id } = params;
        const body = await req.json();
        // Validate request body
        const validatedData = updateMenuItemSchema.parse(body);
        // Check if menu item exists
        const existingItem = await prisma_1.default.menuItem.findUnique({
            where: { id },
        });
        if (!existingItem) {
            return server_1.NextResponse.json({ error: "Menu item not found" }, { status: 404 });
        }
        // Update menu item
        const updatedItem = await prisma_1.default.menuItem.update({
            where: { id },
            data: validatedData,
            include: {
                modifiers: {
                    include: {
                        options: true,
                    },
                },
            },
        });
        // Log the action
        await prisma_1.default.auditLog.create({
            data: {
                userId: req.headers.get("user-id") || "unknown",
                action: "UPDATE",
                entity: "MENU_ITEM",
                entityId: id,
                details: { title: updatedItem.title },
            },
        });
        return server_1.NextResponse.json(updatedItem);
    }
    catch (error) {
        console.error("Error updating menu item:", error);
        if (error instanceof zod_1.z.ZodError) {
            return server_1.NextResponse.json({ error: "Validation error", details: error.errors }, { status: 400 });
        }
        return server_1.NextResponse.json({ error: "Failed to update menu item" }, { status: 500 });
    }
});
// DELETE - Delete a menu item
exports.DELETE = (0, auth_middleware_1.withAuth)(async (req) => {
    const { params } = req;
    try {
        const { id } = params;
        // Check if menu item exists
        const existingItem = await prisma_1.default.menuItem.findUnique({
            where: { id },
        });
        if (!existingItem) {
            return server_1.NextResponse.json({ error: "Menu item not found" }, { status: 404 });
        }
        // Delete menu item (this will cascade delete modifiers and options)
        await prisma_1.default.menuItem.delete({
            where: { id },
        });
        // Log the action
        await prisma_1.default.auditLog.create({
            data: {
                userId: req.headers.get("user-id") || "unknown",
                action: "DELETE",
                entity: "MENU_ITEM",
                entityId: id,
                details: { title: existingItem.title },
            },
        });
        return server_1.NextResponse.json({ success: true });
    }
    catch (error) {
        console.error("Error deleting menu item:", error);
        return server_1.NextResponse.json({ error: "Failed to delete menu item" }, { status: 500 });
    }
});
