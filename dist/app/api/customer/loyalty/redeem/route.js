"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
const server_1 = require("next/server");
const prisma_1 = __importDefault(require("@/lib/prisma"));
const zod_1 = require("zod");
// Schema for validating redemption data
const redeemSchema = zod_1.z.object({
    customerId: zod_1.z.string(),
    rewardId: zod_1.z.string(),
    tableNumber: zod_1.z.string().optional(),
});
async function POST(req) {
    try {
        const body = await req.json();
        // Validate request body
        const validatedData = redeemSchema.parse(body);
        // Get customer and reward
        const [customer, reward] = await Promise.all([
            prisma_1.default.loyaltyCustomer.findUnique({
                where: { id: validatedData.customerId },
            }),
            prisma_1.default.loyaltyReward.findUnique({
                where: { id: validatedData.rewardId },
            }),
        ]);
        if (!customer) {
            return server_1.NextResponse.json({ error: "Customer not found" }, { status: 404 });
        }
        if (!reward) {
            return server_1.NextResponse.json({ error: "Reward not found" }, { status: 404 });
        }
        if (!reward.available) {
            return server_1.NextResponse.json({ error: "Reward is not available" }, { status: 400 });
        }
        if (customer.points < reward.pointsCost) {
            return server_1.NextResponse.json({ error: "Insufficient points" }, { status: 400 });
        }
        // Create redemption transaction
        const redemption = await prisma_1.default.loyaltyRedemption.create({
            data: {
                customerId: customer.id,
                rewardId: reward.id,
                pointsCost: reward.pointsCost,
                tableNumber: validatedData.tableNumber || null,
                timestamp: new Date(),
            },
        });
        // Update customer points
        const updatedCustomer = await prisma_1.default.loyaltyCustomer.update({
            where: { id: customer.id },
            data: {
                points: customer.points - reward.pointsCost,
                lastActivity: new Date(),
            },
        });
        // Create loyalty activity record
        await prisma_1.default.loyaltyActivity.create({
            data: {
                customerId: customer.id,
                type: "redemption",
                points: -reward.pointsCost,
                description: `Redeemed: ${reward.name}`,
                timestamp: new Date(),
            },
        });
        return server_1.NextResponse.json({
            success: true,
            redemption,
            newPointsBalance: updatedCustomer.points,
        });
    }
    catch (error) {
        console.error("Error redeeming reward:", error);
        if (error instanceof zod_1.z.ZodError) {
            return server_1.NextResponse.json({ error: "Validation error", details: error.errors }, { status: 400 });
        }
        return server_1.NextResponse.json({ error: "Failed to redeem reward" }, { status: 500 });
    }
}
