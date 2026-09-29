"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
const server_1 = require("next/server");
const prisma_1 = __importDefault(require("@/lib/prisma"));
const zod_1 = require("zod");
// Schema for validating delivery request data
const deliverySchema = zod_1.z.object({
    provider: zod_1.z.enum(["doordash", "ubereats", "grubhub", "restaurant"]),
    address: zod_1.z.object({
        street: zod_1.z.string(),
        city: zod_1.z.string(),
        state: zod_1.z.string(),
        zipCode: zod_1.z.string(),
        instructions: zod_1.z.string().optional(),
    }),
});
async function POST(req, { params }) {
    try {
        const { id } = params;
        const body = await req.json();
        // Validate request body
        const validatedData = deliverySchema.parse(body);
        // Check if order exists
        const order = await prisma_1.default.order.findUnique({
            where: { id },
        });
        if (!order) {
            return server_1.NextResponse.json({ error: "Order not found" }, { status: 404 });
        }
        // Update order with delivery information
        await prisma_1.default.order.update({
            where: { id },
            data: {
                diningMode: "Delivery",
                deliveryInfo: {
                    create: {
                        provider: validatedData.provider,
                        status: "pending",
                        address: {
                            street: validatedData.address.street,
                            city: validatedData.address.city,
                            state: validatedData.address.state,
                            zipCode: validatedData.address.zipCode,
                            instructions: validatedData.address.instructions,
                        },
                        estimatedDeliveryTime: new Date(Date.now() + 45 * 60 * 1000), // 45 minutes from now
                    },
                },
            },
        });
        // Create audit log entry
        await prisma_1.default.auditLog.create({
            data: {
                action: "UPDATE",
                entity: "ORDER",
                entityId: id,
                details: {
                    update: "delivery_setup",
                    provider: validatedData.provider,
                },
            },
        });
        // For third-party delivery services, simulate API integration
        let redirectUrl = null;
        if (validatedData.provider !== "restaurant") {
            // In a real implementation, this would call the delivery service's API
            // For now, we'll just simulate a redirect URL
            redirectUrl = `https://${validatedData.provider}.com/tracking?orderId=${id}`;
        }
        return server_1.NextResponse.json({
            success: true,
            provider: validatedData.provider,
            redirectUrl,
        });
    }
    catch (error) {
        console.error("Error setting up delivery:", error);
        if (error instanceof zod_1.z.ZodError) {
            return server_1.NextResponse.json({ error: "Validation error", details: error.errors }, { status: 400 });
        }
        return server_1.NextResponse.json({ error: "Failed to set up delivery" }, { status: 500 });
    }
}
