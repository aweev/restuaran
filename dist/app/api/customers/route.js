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
// GET - Fetch all customers
exports.GET = (0, auth_middleware_1.withAuth)(async () => {
    try {
        const customers = await prisma_1.default.customer.findMany({
            orderBy: {
                name: "asc",
            },
        });
        return server_1.NextResponse.json(customers);
    }
    catch (error) {
        console.error("Error fetching customers:", error);
        return server_1.NextResponse.json({ error: "Failed to fetch customers" }, { status: 500 });
    }
});
// Schema for creating customers
const createCustomerSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, "Customer name is required"),
    email: zod_1.z.string().email().optional().nullable(),
    phone: zod_1.z.string().optional().nullable(),
    notes: zod_1.z.string().optional().nullable(),
    allergies: zod_1.z.string().optional().nullable(),
    dietaryRestrictions: zod_1.z.string().optional().nullable(),
    favoriteItems: zod_1.z.string().optional().nullable(),
    seatingPreferences: zod_1.z.string().optional().nullable(),
    visitCount: zod_1.z.number().int().min(0).optional(),
    lastVisit: zod_1.z.string().datetime().optional().nullable(),
    totalSpent: zod_1.z.number().min(0).optional(),
});
// POST - Create a new customer
exports.POST = (0, auth_middleware_1.withAuth)(async (req) => {
    var _a, _b;
    try {
        const body = await req.json();
        // Validate request body
        const validatedData = createCustomerSchema.parse(body);
        // Create customer
        const customer = await prisma_1.default.customer.create({
            data: {
                name: validatedData.name,
                email: validatedData.email || null,
                phone: validatedData.phone || null,
                notes: validatedData.notes || null,
                allergies: validatedData.allergies || null,
                dietaryRestrictions: validatedData.dietaryRestrictions || null,
                favoriteItems: validatedData.favoriteItems || null,
                seatingPreferences: validatedData.seatingPreferences || null,
                visitCount: validatedData.visitCount || 0,
                lastVisit: validatedData.lastVisit ? new Date(validatedData.lastVisit) : null,
                totalSpent: validatedData.totalSpent || 0,
                userId: ((_a = req.user) === null || _a === void 0 ? void 0 : _a.sub) || "unknown",
            },
        });
        // Log the action
        await prisma_1.default.auditLog.create({
            data: {
                userId: ((_b = req.user) === null || _b === void 0 ? void 0 : _b.sub) || "unknown",
                action: "CREATE",
                entity: "CUSTOMER",
                entityId: customer.id,
                details: {
                    name: customer.name,
                    email: customer.email,
                },
            },
        });
        return server_1.NextResponse.json(customer, { status: 201 });
    }
    catch (error) {
        console.error("Error creating customer:", error);
        if (error instanceof zod_1.z.ZodError) {
            return server_1.NextResponse.json({ error: "Validation error", details: error.errors }, { status: 400 });
        }
        return server_1.NextResponse.json({ error: "Failed to create customer" }, { status: 500 });
    }
});
