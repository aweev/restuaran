"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerSchema = void 0;
exports.getCurrentUser = getCurrentUser;
exports.getTokenFromRequest = getTokenFromRequest;
exports.hashPassword = hashPassword;
exports.comparePassword = comparePassword;
exports.generateToken = generateToken;
exports.verifyToken = verifyToken;
exports.hasPermission = hasPermission;
// lib/auth-utils.ts
const zod_1 = require("zod");
const bcrypt_1 = require("bcrypt");
const db_1 = require("@/lib/db");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    throw new Error("JWT_SECRET is not defined in the environment variables");
}
async function getCurrentUser(token) {
    if (!token)
        return null;
    try {
        const payload = (await verifyJWT(token));
        if (!payload)
            return null;
        const users = await (0, db_1.sql) `
      SELECT * FROM "User" WHERE id = ${payload.sub}
    `;
        if (users.length === 0) {
            return null;
        }
        const user = users[0];
        return {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            avatar: user.avatar,
            phone: user.phone,
            address: user.address,
            hireDate: user.hireDate ? user.hireDate.toISOString() : null,
            isActive: user.isActive,
            lastLogin: user.lastLogin ? user.lastLogin.toISOString() : null,
            customPermissions: user.customPermissions || [],
        };
    }
    catch (error) {
        console.error("Error verifying JWT:", error);
        return null;
    }
}
async function getTokenFromRequest(req) {
    const authHeader = req.headers.get("Authorization") || "";
    const token = (authHeader === null || authHeader === void 0 ? void 0 : authHeader.split(" ")[1]) || null;
    return token || null;
}
async function hashPassword(password) {
    return (0, bcrypt_1.hash)(password, 10);
}
async function comparePassword(password, hash) {
    return (0, bcrypt_1.compare)(password, hash);
}
function generateToken(userId, email, role, permissions = []) {
    if (!JWT_SECRET) {
        console.error("JWT_SECRET is not set, cannot generate token.");
        return null;
    }
    const payload = {
        sub: userId,
        email,
        role,
        permissions, // Include permissions in the token
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24), // Token expires in 24 hours
    };
    try {
        return jsonwebtoken_1.default.sign(payload, JWT_SECRET);
    }
    catch (error) {
        console.error("Error signing JWT:", error);
        return null;
    }
}
async function verifyToken(token) {
    if (!JWT_SECRET) {
        console.error("JWT_SECRET is not set, cannot verify token.");
        return null;
    }
    try {
        const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET);
        return decoded;
    }
    catch (error) {
        console.error("Error verifying token:", error);
        return null;
    }
}
function hasPermission(user, requiredPermission) {
    if (!user || !user.permissions) {
        return false;
    }
    return user.permissions.includes(requiredPermission);
}
exports.registerSchema = zod_1.z.object({
    name: zod_1.z.string().min(3, "Name must be at least 3 characters"),
    email: zod_1.z.string().email("Invalid email address"),
    password: zod_1.z.string().min(6, "Password must be at least 6 characters"),
    role: zod_1.z.enum(["admin", "manager", "server", "kitchen", "cashier"]),
    phone: zod_1.z.string().optional(),
    address: zod_1.z.string().optional(),
});
function verifyJWT(token) {
    if (!JWT_SECRET) {
        throw new Error("JWT_SECRET is not set, cannot verify token.");
    }
    try {
        return jsonwebtoken_1.default.verify(token, JWT_SECRET);
    }
    catch (error) {
        console.error("Error verifying JWT:", error);
        throw new Error("Invalid token");
    }
}
