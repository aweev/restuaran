"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
const server_1 = require("next/server");
const prisma_1 = __importDefault(require("@/lib/prisma"));
async function GET(req) {
    try {
        const { searchParams } = new URL(req.url);
        const customerId = searchParams.get("customerId");
        if (!customerId) {
            return server_1.NextResponse.json({ error: "Customer ID is required" }, { status: 400 });
        }
        // Get customer's order history
        const customerOrders = await prisma_1.default.order.findMany({
            where: {
                customerName: customerId,
            },
            include: {
                items: true,
            },
            orderBy: {
                createdAt: "desc",
            },
            take: 10, // Consider last 10 orders
        });
        const orderedItemIds = customerOrders.flatMap((order) => order.items.map((item) => item.menuItemId));
        // Count frequency of each menu item
        const itemFrequency = {};
        orderedItemIds.forEach((id) => {
            itemFrequency[id] = (itemFrequency[id] || 0) + 1;
        });
        // Get categories of frequently ordered items
        const frequentItemIds = Object.entries(itemFrequency)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([id]) => id);
        const frequentItems = await prisma_1.default.menuItem.findMany({
            where: {
                id: {
                    in: frequentItemIds,
                },
            },
        });
        const preferredCategories = frequentItems.map((item) => item.category);
        // Get recommendations based on preferred categories
        // Exclude items the customer has already ordered
        const recommendations = await prisma_1.default.menuItem.findMany({
            where: {
                category: {
                    in: preferredCategories,
                },
                id: {
                    notIn: orderedItemIds,
                },
                available: true,
            },
            orderBy: {
                popular: "desc",
            },
            take: 5,
        });
        // If we don't have enough recommendations, add some popular items
        if (recommendations.length < 5) {
            const additionalItems = await prisma_1.default.menuItem.findMany({
                where: {
                    id: {
                        notIn: [...orderedItemIds, ...recommendations.map((item) => item.id)],
                    },
                    available: true,
                    popular: true,
                },
                take: 5 - recommendations.length,
            });
            recommendations.push(...additionalItems);
        }
        return server_1.NextResponse.json(recommendations);
    }
    catch (error) {
        console.error("Error fetching personalized recommendations:", error);
        return server_1.NextResponse.json({ error: "Failed to fetch recommendations" }, { status: 500 });
    }
}
