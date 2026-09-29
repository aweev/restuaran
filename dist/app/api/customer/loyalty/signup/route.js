"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
const server_1 = require("next/server");
const prisma_1 = __importDefault(require("@/lib/prisma"));
const zod_1 = require("zod");
// Schema for validating signup data
const signupSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    phone: zod_1.z.string(),
    tableNumber: zod_1.z.string().optional(),
});
async function POST(req) {
    try {
        const body = await req.json();
        // Validate request body
        const validatedData = signupSchema.parse(body);
        // Check if customer already exists
        const existingCustomer = await prisma_1.default.loyaltyCustomer.findFirst({
            where: {
                OR: [{ email: validatedData.email }, { phone: validatedData.phone }],
            },
        });
        if (existingCustomer) {
            return server_1.NextResponse.json({ error: "Customer already exists" }, { status: 400 });
        }
        // Create new customer
        const customer = await prisma_1.default.loyaltyCustomer.create({
            data: {
                email: validatedData.email,
                phone: validatedData.phone,
                name: validatedData.email.split("@")[0], // Default name from email
                points: 100, // Welcome points
                tier: "bronze",
                joinDate: new Date(),
                lastActivity: new Date(),
                totalSpent: 0,
                visitsCount: 1,
            },
        });
        // Create loyalty activity record for welcome points
        await prisma_1.default.loyaltyActivity.create({
            data: {
                customerId: customer.id,
                type: "welcome",
                points: 100,
                description: "Welcome bonus",
                timestamp: new Date(),
            },
        });
        return server_1.NextResponse.json({ customer });
    }
    catch (error) {
        console.error("Error signing up for loyalty program:", error);
        if (error instanceof zod_1.z.ZodError) {
            return server_1.NextResponse.json({ error: "Validation error", details: error.errors }, { status: 400 });
        }
        return server_1.NextResponse.json({ error: "Failed to sign up" }, { status: 500 });
    }
}
