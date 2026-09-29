"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
const server_1 = require("next/server");
const prisma_1 = __importDefault(require("@/lib/prisma"));
const zod_1 = require("zod");
// Schema for validating feedback data
const feedbackSchema = zod_1.z.object({
    orderId: zod_1.z.string().nullable(),
    tableNumber: zod_1.z.string().nullable(),
    rating: zod_1.z.number().min(1).max(5),
    foodQuality: zod_1.z.number().min(1).max(5).nullable(),
    serviceQuality: zod_1.z.number().min(1).max(5).nullable(),
    ambience: zod_1.z.number().min(1).max(5).nullable(),
    comments: zod_1.z.string().optional(),
    timestamp: zod_1.z.string().datetime(),
});
async function POST(req) {
    try {
        const body = await req.json();
        // Validate request body
        const validatedData = feedbackSchema.parse(body);
        // Create feedback entry
        const feedback = await prisma_1.default.feedback.create({
            data: {
                orderId: validatedData.orderId,
                tableId: validatedData.tableNumber,
                rating: validatedData.rating,
                foodQuality: validatedData.foodQuality || undefined,
                serviceQuality: validatedData.serviceQuality || undefined,
                ambience: validatedData.ambience || undefined,
                comments: validatedData.comments || undefined,
                timestamp: new Date(validatedData.timestamp),
            },
        });
        // Create audit log entry
        await prisma_1.default.auditLog.create({
            data: {
                action: "CREATE",
                entity: "FEEDBACK",
                entityId: feedback.id,
                details: {
                    orderId: validatedData.orderId,
                    tableId: validatedData.tableNumber,
                    rating: validatedData.rating,
                },
            },
        });
        return server_1.NextResponse.json({ success: true, id: feedback.id }, { status: 201 });
    }
    catch (error) {
        console.error("Error creating feedback:", error);
        if (error instanceof zod_1.z.ZodError) {
            return server_1.NextResponse.json({ error: "Validation error", details: error.errors }, { status: 400 });
        }
        return server_1.NextResponse.json({ error: "Failed to submit feedback" }, { status: 500 });
    }
}
