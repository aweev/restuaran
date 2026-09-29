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
        const order = await prisma_1.default.order.findUnique({
            where: { id },
            include: {
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
        console.error("Error fetching customer order:", error);
        return server_1.NextResponse.json({ error: "Failed to fetch order" }, { status: 500 });
    }
}
