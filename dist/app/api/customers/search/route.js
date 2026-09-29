"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = void 0;
const server_1 = require("next/server");
const prisma_1 = __importDefault(require("@/lib/prisma"));
const auth_middleware_1 = require("@/middleware/auth-middleware");
// GET - Search customers
exports.GET = (0, auth_middleware_1.withAuth)(async (req) => {
    try {
        const { searchParams } = new URL(req.url);
        const query = searchParams.get("q") || "";
        if (!query) {
            // If no query, return all customers
            const customers = await prisma_1.default.customer.findMany({
                orderBy: {
                    name: "asc",
                },
                take: 20, // Limit to 20 results
            });
            return server_1.NextResponse.json(customers);
        }
        // Search customers by name, email, or phone
        const customers = await prisma_1.default.customer.findMany({
            where: {
                OR: [
                    { name: { contains: query, mode: "insensitive" } },
                    { email: { contains: query, mode: "insensitive" } },
                    { phone: { contains: query, mode: "insensitive" } },
                ],
            },
            orderBy: {
                name: "asc",
            },
        });
        return server_1.NextResponse.json(customers);
    }
    catch (error) {
        console.error("Error searching customers:", error);
        return server_1.NextResponse.json({ error: "Failed to search customers" }, { status: 500 });
    }
});
