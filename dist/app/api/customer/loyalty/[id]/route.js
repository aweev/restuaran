"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
const server_1 = require("next/server");
const prisma_1 = __importDefault(require("@/lib/prisma"));
async function GET(req, { params }) {
    try {
        const { id } = params;
        const customer = await prisma_1.default.loyaltyCustomer.findUnique({
            where: { id },
            include: {
                activities: {
                    orderBy: {
                        timestamp: "desc",
                    },
                    take: 10,
                },
            },
        });
        if (!customer) {
            return server_1.NextResponse.json({ error: "Customer not found" }, { status: 404 });
        }
        return server_1.NextResponse.json(customer);
    }
    catch (error) {
        console.error("Error fetching loyalty customer:", error);
        return server_1.NextResponse.json({ error: "Failed to fetch customer data" }, { status: 500 });
    }
}
