"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
const server_1 = require("next/server");
const auth_utils_1 = require("@/lib/auth-utils");
const prisma_1 = __importDefault(require("@/lib/prisma"));
const zod_1 = require("zod");
async function POST(req) {
    try {
        const body = await req.json();
        // Validate request body
        const { name, email, password, role, phone, address } = auth_utils_1.registerSchema.parse(body);
        // Check if email already exists
        const existingUser = await prisma_1.default.user.findUnique({
            where: { email },
        });
        if (existingUser) {
            return server_1.NextResponse.json({ error: "Email already in use" }, { status: 400 });
        }
        // Hash password
        const hashedPassword = await (0, auth_utils_1.hashPassword)(password);
        // Create new user
        const user = await prisma_1.default.user.create({
            data: {
                name,
                email,
                password: hashedPassword,
                role,
                phone,
                address,
                isActive: true,
                hireDate: new Date(),
            },
        });
        // Generate JWT token
        const token = (0, auth_utils_1.generateToken)(user.id, user.email, user.role);
        // Log the registration action
        await prisma_1.default.auditLog.create({
            data: {
                userId: user.id,
                action: "REGISTER",
                entity: "USER",
                entityId: user.id,
                details: { email: user.email, role: user.role },
            },
        });
        // Return user data and token
        return server_1.NextResponse.json({
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                avatar: user.avatar,
                phone: user.phone,
                address: user.address,
                hireDate: user.hireDate,
                isActive: user.isActive,
                customPermissions: user.customPermissions,
            },
            token,
        });
    }
    catch (error) {
        console.error("Registration error:", error);
        if (error instanceof zod_1.ZodError) {
            return server_1.NextResponse.json({ error: "Validation error", details: error.errors }, { status: 400 });
        }
        return server_1.NextResponse.json({ error: "An error occurred during registration" }, { status: 500 });
    }
}
