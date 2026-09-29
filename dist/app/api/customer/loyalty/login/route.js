"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
const server_1 = require("next/server");
const prisma_1 = __importDefault(require("@/lib/prisma"));
const zod_1 = require("zod");
// Schema for validating login data
const loginSchema = zod_1.z.object({
    email: zod_1.z.string().email().optional(),
    phone: zod_1.z.string().optional(),
});
async function POST(req) {
    try {
        const body = await req.json();
        // Validate request body
        const validatedData = loginSchema.parse(body);
        if (!validatedData.email && !validatedData.phone) {
            return server_1.NextResponse.json({ error: "Email or phone is required" }, { status: 400 });
        }
        // Find customer by email or phone
        const customer = await prisma_1.default.loyaltyCustomer.findFirst({
            where: {
                OR: [
                    validatedData.email ? { email: validatedData.email } : {},
                    validatedData.phone ? { phone: validatedData.phone } : {},
                ],
            },
        });
        if (!customer) {
            return server_1.NextResponse.json({ customer: null });
        }
        // Update last activity timestamp
        await prisma_1.default.loyaltyCustomer.update({
            where: { id: customer.id },
            data: {
                lastActivity: new Date(),
            },
        });
        return server_1.NextResponse.json({ customer });
    }
    catch (error) {
        console.error("Error logging in to loyalty program:", error);
        if (error instanceof zod_1.z.ZodError) {
            return server_1.NextResponse.json({ error: "Validation error", details: error.errors }, { status: 400 });
        }
        return server_1.NextResponse.json({ error: "Failed to login" }, { status: 500 });
    }
}
