"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DELETE = exports.PUT = exports.GET = void 0;
const server_1 = require("next/server");
const prisma_1 = __importDefault(require("@/lib/prisma"));
const auth_middleware_1 = require("@/middleware/auth-middleware");
const zod_1 = require("zod");
// GET - Fetch a specific customer
exports.GET = (0, auth_middleware_1.withAuth)(async (req) => {
    const { params } = req;
    try {
        const { id } = params;
        const customer = await prisma_1.default.customer.findUnique({
            where: { id },
        });
        if (!customer) {
            return server_1.NextResponse.json({ error: "Customer not found" }, { status: 404 });
        }
        return server_1.NextResponse.json(customer);
    }
    catch (error) {
        console.error("Error fetching customer:", error);
        return server_1.NextResponse.json({ error: "Failed to fetch customer" }, { status: 500 });
    }
});
// Schema for updating customers
const updateCustomerSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, "Customer name is required").optional(),
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
// PUT - Update a customer
exports.PUT = (0, auth_middleware_1.withAuth)(async (req) => {
    const { params } = req;
    try {
        const { id } = params;
        const body = await req.json();
        // Validate request body
        const validatedData = updateCustomerSchema.parse(body);
        // Check if customer exists
        const existingCustomer = await prisma_1.default.customer.findUnique({
            where: { id },
        });
        if (!existingCustomer) {
            return server_1.NextResponse.json({ error: "Customer not found" }, { status: 404 });
        }
        // Update customer
        const updatedCustomer = await prisma_1.default.customer.update({
            where: { id },
            data: {
                name: validatedData.name,
                email: validatedData.email,
                phone: validatedData.phone,
                notes: validatedData.notes,
                allergies: validatedData.allergies,
                dietaryRestrictions: validatedData.dietaryRestrictions,
                favoriteItems: validatedData.favoriteItems,
                seatingPreferences: validatedData.seatingPreferences,
                visitCount: validatedData.visitCount,
                lastVisit: validatedData.lastVisit ? new Date(validatedData.lastVisit) : existingCustomer.lastVisit,
                totalSpent: validatedData.totalSpent,
            },
        });
        // Log the action
        await prisma_1.default.auditLog.create({
            data: {
                userId: req.headers.get("user-id") || "unknown",
                action: "UPDATE",
                entity: "CUSTOMER",
                entityId: id,
                details: {
                    name: updatedCustomer.name,
                },
            },
        });
        return server_1.NextResponse.json(updatedCustomer);
    }
    catch (error) {
        console.error("Error updating customer:", error);
        if (error instanceof zod_1.z.ZodError) {
            return server_1.NextResponse.json({ error: "Validation error", details: error.errors }, { status: 400 });
        }
        return server_1.NextResponse.json({ error: "Failed to update customer" }, { status: 500 });
    }
});
// DELETE - Delete a customer
exports.DELETE = (0, auth_middleware_1.withAuth)(async (req) => {
    const { params } = req;
    try {
        const { id } = params;
        // Check if customer exists
        const existingCustomer = await prisma_1.default.customer.findUnique({
            where: { id },
        });
        if (!existingCustomer) {
            return server_1.NextResponse.json({ error: "Customer not found" }, { status: 404 });
        }
        // Delete customer
        await prisma_1.default.customer.delete({
            where: { id },
        });
        // Log the action
        await prisma_1.default.auditLog.create({
            data: {
                userId: req.headers.get("user-id") || "unknown",
                action: "DELETE",
                entity: "CUSTOMER",
                entityId: id,
                details: {
                    name: existingCustomer.name,
                },
            },
        });
        return server_1.NextResponse.json({ success: true });
    }
    catch (error) {
        console.error("Error deleting customer:", error);
        return server_1.NextResponse.json({ error: "Failed to delete customer" }, { status: 500 });
    }
});
