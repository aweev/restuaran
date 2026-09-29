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
        // Get popular menu items
        const popularItems = await prisma_1.default.menuItem.findMany({
            where: {
                available: true,
                popular: true,
            },
            take: 5,
        });
        return server_1.NextResponse.json(popularItems);
    }
    catch (error) {
        console.error("Error fetching popular items:", error);
        return server_1.NextResponse.json({ error: "Failed to fetch popular items" }, { status: 500 });
    }
}
