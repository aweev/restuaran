"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
const server_1 = require("next/server");
const prisma_1 = __importDefault(require("@/lib/prisma"));
const zod_1 = require("zod");
// Schema for validating order data
const orderSchema = zod_1.z.object({
    items: zod_1.z.array(zod_1.z.object({
        id: zod_1.z.string(),
        menuItemId: zod_1.z.string(),
        title: zod_1.z.string(),
        price: zod_1.z.number(),
        quantity: zod_1.z.number(),
        totalPrice: zod_1.z.number(),
        type: zod_1.z.enum(["Veg", "Non Veg"]),
        specialInstructions: zod_1.z.string().optional(),
        modifiers: zod_1.z
            .array(zod_1.z.object({
            modifierId: zod_1.z.string(),
            optionIds: zod_1.z.array(zod_1.z.string()),
        }))
            .optional(),
    })),
    tableId: zod_1.z.string().optional(),
    customerName: zod_1.z.string(),
    diningMode: zod_1.z.enum(["Dine in", "Take Away", "Delivery"]),
    subtotal: zod_1.z.number(),
    tax: zod_1.z.number(),
    total: zod_1.z.number(),
    notes: zod_1.z.string().optional(),
    status: zod_1.z.enum(["pending", "preparing", "ready", "delivered", "completed", "cancelled"]),
});
async function POST(req) {
    try {
        const body = await req.json();
        // Validate request body
        const validatedData = orderSchema.parse(body);
        // Generate a unique order ID
        const orderId = crypto.randomUUID();
        // Insert order
        await prisma_1.default.order.create({
            data: {
                id: orderId,
                tableId: validatedData.tableId || null,
                customerName: validatedData.customerName,
                status: validatedData.status,
                diningMode: validatedData.diningMode,
                serverId: null, // No server assigned yet for customer orders
                subtotal: validatedData.subtotal,
                tax: validatedData.tax,
                discount: 0, // No discount applied initially
                total: validatedData.total,
                isPaid: false,
                notes: validatedData.notes || null,
                createdAt: new Date(),
                updatedAt: new Date(),
                items: {
                    create: validatedData.items.map((item) => ({
                        menuItemId: item.menuItemId,
                        title: item.title,
                        price: item.price,
                        quantity: item.quantity,
                        totalPrice: item.totalPrice,
                        specialInstructions: item.specialInstructions || null,
                        type: item.type,
                        modifierSelections: item.modifiers
                            ? {
                                create: item.modifiers.map((modifier) => ({
                                    modifierId: modifier.modifierId,
                                    optionIds: modifier.optionIds,
                                })),
                            }
                            : undefined,
                    })),
                },
            },
        });
        // If table ID is provided, update table status
        if (validatedData.tableId && validatedData.diningMode === "Dine in") {
            await prisma_1.default.table.update({
                where: { id: validatedData.tableId },
                data: {
                    status: "occupied",
                    customerName: validatedData.customerName,
                    startTime: new Date(),
                },
            });
        }
        // Create audit log entry
        await prisma_1.default.auditLog.create({
            data: {
                action: "CREATE",
                entity: "ORDER",
                entityId: orderId,
                details: {
                    source: "customer",
                    tableId: validatedData.tableId,
                    customerName: validatedData.customerName,
                    total: validatedData.total,
                    itemCount: validatedData.items.length,
                },
            },
        });
        // Return the created order ID
        return server_1.NextResponse.json({ id: orderId, status: "pending" }, { status: 201 });
    }
    catch (error) {
        console.error("Error creating customer order:", error);
        if (error instanceof zod_1.z.ZodError) {
            return server_1.NextResponse.json({ error: "Validation error", details: error.errors }, { status: 400 });
        }
        return server_1.NextResponse.json({ error: "Failed to create order" }, { status: 500 });
    }
}
