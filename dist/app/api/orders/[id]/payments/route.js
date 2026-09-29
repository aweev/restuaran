"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = void 0;
exports.GET = GET;
const server_1 = require("next/server");
const prisma_1 = __importDefault(require("@/lib/prisma"));
const auth_middleware_1 = require("@/middleware/auth-middleware");
const zod_1 = require("zod");
// GET all payments for an order
async function GET(req, { params }) {
    try {
        const { id } = params;
        const payments = await prisma_1.default.payment.findMany({
            where: { orderId: id },
            orderBy: { timestamp: "desc" },
        });
        return server_1.NextResponse.json(payments);
    }
    catch (error) {
        console.error("Error fetching payments:", error);
        return server_1.NextResponse.json({ error: "Failed to fetch payments" }, { status: 500 });
    }
}
// Schema for creating payments
const paymentSchema = zod_1.z.object({
    method: zod_1.z.enum(["cash", "credit", "debit", "mobile", "gift"]),
    amount: zod_1.z.number().positive(),
    reference: zod_1.z.string().optional(),
});
// POST - Add a payment to an order
exports.POST = (0, auth_middleware_1.withAuth)(async (req) => {
    const { params } = req;
    try {
        const { id } = params;
        const body = await req.json();
        // Validate request body
        const validatedData = paymentSchema.parse(body);
        // Check if order exists
        const order = await prisma_1.default.order.findUnique({
            where: { id },
            include: { payments: true },
        });
        if (!order) {
            return server_1.NextResponse.json({ error: "Order not found" }, { status: 404 });
        }
        // Create payment
        const payment = await prisma_1.default.payment.create({
            data: Object.assign(Object.assign({}, validatedData), { orderId: id, timestamp: new Date() }),
        });
        // Calculate total paid amount
        const totalPaid = [...order.payments, payment].reduce((sum, p) => sum + p.amount, 0);
        // Update order's isPaid status if total paid amount covers the total
        if (totalPaid >= order.total && !order.isPaid) {
            await prisma_1.default.order.update({
                where: { id },
                data: { isPaid: true },
            });
        }
        // Log the action
        await prisma_1.default.auditLog.create({
            data: {
                userId: req.headers.get("user-id") || "unknown",
                action: "PAYMENT",
                entity: "ORDER",
                entityId: id,
                details: {
                    method: payment.method,
                    amount: payment.amount,
                    isPaid: totalPaid >= order.total,
                },
            },
        });
        return server_1.NextResponse.json(payment, { status: 201 });
    }
    catch (error) {
        console.error("Error adding payment:", error);
        if (error instanceof zod_1.z.ZodError) {
            return server_1.NextResponse.json({ error: "Validation error", details: error.errors }, { status: 400 });
        }
        return server_1.NextResponse.json({ error: "Failed to add payment" }, { status: 500 });
    }
});
