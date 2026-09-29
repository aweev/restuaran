"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = exports.GET = void 0;
const server_1 = require("next/server");
const prisma_1 = __importDefault(require("@/lib/prisma"));
const auth_middleware_1 = require("@/middleware/auth-middleware");
const zod_1 = require("zod");
// GET - Fetch all preparation times
exports.GET = (0, auth_middleware_1.withAuth)(async () => {
    try {
        const prepTimes = await prisma_1.default.preparationTime.findMany();
        const prepTimesMap = prepTimes.reduce((acc, item) => {
            acc[item.menuItemId] = item.timeInMinutes;
            return acc;
        }, {});
        return server_1.NextResponse.json(prepTimesMap);
    }
    catch (error) {
        console.error("Error fetching preparation times:", error);
        return server_1.NextResponse.json({ error: "Failed to fetch preparation times" }, { status: 500 });
    }
});
// Schema for preparation time
const prepTimeSchema = zod_1.z.object({
    menuItemId: zod_1.z.string(),
    time: zod_1.z.number().min(1).max(120),
});
// POST - Create or update a preparation time
exports.POST = (0, auth_middleware_1.withAuth)(async (req) => {
    try {
        const body = await req.json();
        // Validate request body
        const validatedData = prepTimeSchema.parse(body);
        // Check if prep time already exists
        const existingPrepTime = await prisma_1.default.preparationTime.findUnique({
            where: { menuItemId: validatedData.menuItemId },
        });
        if (existingPrepTime) {
            // Update existing prep time
            const updatedPrepTime = await prisma_1.default.preparationTime.update({
                where: { menuItemId: validatedData.menuItemId },
                data: {
                    timeInMinutes: validatedData.time,
                },
            });
            return server_1.NextResponse.json(updatedPrepTime);
        }
        else {
            // Create new prep time
            const newPrepTime = await prisma_1.default.preparationTime.create({
                data: {
                    menuItemId: validatedData.menuItemId,
                    timeInMinutes: validatedData.time,
                },
            });
            return server_1.NextResponse.json(newPrepTime);
        }
    }
    catch (error) {
        console.error("Error creating/updating preparation time:", error);
        if (error instanceof zod_1.z.ZodError) {
            return server_1.NextResponse.json({ error: "Validation error", details: error.errors }, { status: 400 });
        }
        return server_1.NextResponse.json({ error: "Failed to create/update preparation time" }, { status: 500 });
    }
});
