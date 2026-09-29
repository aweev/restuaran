"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
const server_1 = require("next/server");
const prisma_1 = __importDefault(require("@/lib/prisma"));
async function GET() {
    try {
        const rewards = await prisma_1.default.loyaltyReward.findMany({
            where: {
                available: true,
            },
            orderBy: {
                pointsCost: "asc",
            },
        });
        return server_1.NextResponse.json(rewards);
    }
    catch (error) {
        console.error("Error fetching loyalty rewards:", error);
        return server_1.NextResponse.json({ error: "Failed to fetch rewards" }, { status: 500 });
    }
}
