"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DELETE = exports.PATCH = exports.PUT = void 0;
exports.GET = GET;
const server_1 = require("next/server");
const prisma_1 = __importDefault(require("@/lib/prisma"));
const auth_middleware_1 = require("@/middleware/auth-middleware");
const zod_1 = require("zod");
// GET a specific order
async function GET(req, { params }) {
    try {
        const { id } = params;
        const order = await prisma_1.default.order.findUnique({
            where: { id },
            include: {
                table: true,
                items: {
                    include: {
                        modifierSelections: true,
                    },
                },
                payments: true,
            },
        });
        if (!order) {
            return server_1.NextResponse.json({ error: "Order not found" }, { status: 404 });
        }
        return server_1.NextResponse.json(order);
    }
    catch (error) {
        console.error("Error fetching order:", error);
        return server_1.NextResponse.json({ error: "Failed to fetch order" }, { status: 500 });
    }
}
// Schema for updating orders
const updateOrderSchema = zod_1.z.object({
    status: zod_1.z.enum(["pending", "preparing", "ready", "delivered", "completed", "cancelled"]).optional(),
    notes: zod_1.z.string().optional().nullable(),
    items: zod_1.z
        .array(zod_1.z.object({
        id: zod_1.z.string(),
        menuItemId: zod_1.z.string(),
        title: zod_1.z.string(),
        price: zod_1.z.number(),
        quantity: zod_1.z.number(),
        totalPrice: zod_1.z.number(),
        type: zod_1.z.enum(["Veg", "Non Veg"]),
        specialInstructions: zod_1.z.string().optional().nullable(),
        modifiers: zod_1.z
            .array(zod_1.z.object({
            modifierId: zod_1.z.string(),
            optionIds: zod_1.z.array(zod_1.z.string()),
        }))
            .optional(),
    }))
        .optional(),
});
// PUT - Update an order
exports.PUT = (0, auth_middleware_1.withAuth)(async (req) => {
    const { params } = req;
    try {
        const { id } = params;
        const body = await req.json();
        // Validate request body
        const validatedData = updateOrderSchema.parse(body);
        // Check if order exists
        const existingOrder = await prisma_1.default.order.findUnique({
            where: { id },
            include: {
                table: true,
                items: {
                    include: {
                        modifierSelections: true,
                    },
                },
            },
        });
        if (!existingOrder) {
            return server_1.NextResponse.json({ error: "Order not found" }, { status: 404 });
        }
        // If status is changing to completed or cancelled, update table status
        if (validatedData.status &&
            (validatedData.status === "completed" || validatedData.status === "cancelled") &&
            existingOrder.tableId) {
            await prisma_1.default.table.update({
                where: { id: existingOrder.tableId },
                data: {
                    status: "dirty",
                    customerName: null,
                    customerCount: null,
                    startTime: null,
                },
            });
        }
        const result = await prisma_1.default.$transaction(async (tx) => {
            // Update order items if provided
            if (validatedData.items) {
                // Delete existing items and their modifier selections
                await tx.orderItem.deleteMany({
                    where: { orderId: id },
                });
                // Create new items
                for (const item of validatedData.items) {
                    const newItem = await tx.orderItem.create({
                        data: {
                            orderId: id,
                            menuItemId: item.menuItemId,
                            title: item.title,
                            price: item.price,
                            quantity: item.quantity,
                            totalPrice: item.totalPrice,
                            type: item.type,
                            specialInstructions: item.specialInstructions,
                        },
                    });
                    // Create modifier selections if any
                    if (item.modifiers && item.modifiers.length > 0) {
                        for (const modifier of item.modifiers) {
                            await tx.modifierSelection.create({
                                data: {
                                    orderItemId: newItem.id,
                                    modifierId: modifier.modifierId,
                                    optionIds: modifier.optionIds,
                                },
                            });
                        }
                    }
                }
                // Recalculate totals
                const subtotal = validatedData.items.reduce((sum, item) => sum + item.totalPrice, 0);
                const taxRate = 0.05; // 5% tax rate
                const tax = subtotal * taxRate;
                const total = subtotal + tax - existingOrder.discount;
                // Update order with new totals
                await tx.order.update({
                    where: { id },
                    data: {
                        subtotal,
                        tax,
                        total,
                        notes: validatedData.notes,
                        status: validatedData.status,
                        updatedAt: new Date(),
                    },
                });
            }
            else {
                // Just update status and notes
                await tx.order.update({
                    where: { id },
                    data: {
                        status: validatedData.status,
                        notes: validatedData.notes,
                        updatedAt: new Date(),
                    },
                });
            }
            // Return the updated order
            return tx.order.findUnique({
                where: { id },
                include: {
                    table: true,
                    items: {
                        include: {
                            modifierSelections: true,
                        },
                    },
                    payments: true,
                },
            });
        });
        // Log the action
        await prisma_1.default.auditLog.create({
            data: {
                userId: req.user.sub,
                action: "UPDATE",
                entity: "ORDER",
                entityId: id,
                details: {
                    status: validatedData.status,
                    notes: validatedData.notes,
                    itemsUpdated: validatedData.items ? true : false,
                },
            },
        });
        return server_1.NextResponse.json(result);
    }
    catch (error) {
        console.error("Error updating order:", error);
        if (error instanceof zod_1.z.ZodError) {
            return server_1.NextResponse.json({ error: "Validation error", details: error.errors }, { status: 400 });
        }
        return server_1.NextResponse.json({ error: "Failed to update order" }, { status: 500 });
    }
});
// PATCH - Update order status
exports.PATCH = (0, auth_middleware_1.withAuth)(async (req) => {
    const { params } = req;
    try {
        const { id } = params;
        const body = await req.json();
        // Validate status
        if (!body.status ||
            !["pending", "preparing", "ready", "delivered", "completed", "cancelled"].includes(body.status)) {
            return server_1.NextResponse.json({ error: "Invalid status" }, { status: 400 });
        }
        // Check if order exists
        const existingOrder = await prisma_1.default.order.findUnique({
            where: { id },
            include: { table: true },
        });
        if (!existingOrder) {
            return server_1.NextResponse.json({ error: "Order not found" }, { status: 404 });
        }
        // If status is changing to completed or cancelled, update table status
        if ((body.status === "completed" || body.status === "cancelled") && existingOrder.tableId) {
            await prisma_1.default.table.update({
                where: { id: existingOrder.tableId },
                data: {
                    status: "dirty",
                    customerName: null,
                    customerCount: null,
                    startTime: null,
                },
            });
        }
        // Update order status
        const updatedOrder = await prisma_1.default.order.update({
            where: { id },
            data: {
                status: body.status,
                notes: body.notes || existingOrder.notes,
                updatedAt: new Date(),
            },
            include: {
                table: true,
                items: {
                    include: {
                        modifierSelections: true,
                    },
                },
                payments: true,
            },
        });
        // Log the action
        await prisma_1.default.auditLog.create({
            data: {
                userId: req.user.sub,
                action: "STATUS_UPDATE",
                entity: "ORDER",
                entityId: id,
                details: {
                    oldStatus: existingOrder.status,
                    newStatus: body.status,
                },
            },
        });
        return server_1.NextResponse.json(updatedOrder);
    }
    catch (error) {
        console.error("Error updating order status:", error);
        return server_1.NextResponse.json({ error: "Failed to update order status" }, { status: 500 });
    }
});
// DELETE - Delete an order
exports.DELETE = (0, auth_middleware_1.withAuth)(async (req) => {
    const { params } = req;
    try {
        const { id } = params;
        // Check if order exists
        const existingOrder = await prisma_1.default.order.findUnique({
            where: { id },
            include: { table: true },
        });
        if (!existingOrder) {
            return server_1.NextResponse.json({ error: "Order not found" }, { status: 404 });
        }
        // If order has a table, update table status
        if (existingOrder.tableId) {
            await prisma_1.default.table.update({
                where: { id: existingOrder.tableId },
                data: {
                    status: "available",
                    customerName: null,
                    customerCount: null,
                    startTime: null,
                },
            });
        }
        // Delete order (this will cascade delete items, modifier selections, and payments)
        await prisma_1.default.order.delete({
            where: { id },
        });
        // Log the action
        await prisma_1.default.auditLog.create({
            data: {
                userId: req.user.sub,
                action: "DELETE",
                entity: "ORDER",
                entityId: id,
                details: {
                    tableId: existingOrder.tableId,
                    customerName: existingOrder.customerName,
                    total: existingOrder.total,
                },
            },
        });
        return server_1.NextResponse.json({ success: true });
    }
    catch (error) {
        console.error("Error deleting order:", error);
        return server_1.NextResponse.json({ error: "Failed to delete order" }, { status: 500 });
    }
});
