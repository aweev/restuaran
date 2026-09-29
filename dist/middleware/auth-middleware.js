"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.withAuth = withAuth;
exports.withPermission = withPermission;
// auth-middleware.ts
const server_1 = require("next/server");
const auth_utils_1 = require("@/lib/auth-utils");
function withAuth(handler) {
    return async (req) => {
        try {
            const token = await (0, auth_utils_1.getTokenFromRequest)(req); // Ensure getTokenFromRequest is awaited
            if (!token) {
                return server_1.NextResponse.json({ error: "Unauthorized" }, { status: 401 });
            }
            const decoded = await (0, auth_utils_1.verifyToken)(token); // Ensure verifyToken is awaited
            if (!decoded) {
                return server_1.NextResponse.json({ error: "Invalid or expired token" }, { status: 401 });
            }
            // Add user to request
            req.user = decoded; // Type assertion here
            return handler(req);
        }
        catch (error) {
            console.error("Auth middleware error:", error);
            return server_1.NextResponse.json({ error: "Authentication error" }, { status: 500 });
        }
    };
}
function withPermission(handler, requiredPermission) {
    return withAuth(async (req) => {
        try {
            const user = req.user;
            if (!user || !(0, auth_utils_1.hasPermission)(user, requiredPermission)) {
                return server_1.NextResponse.json({ error: "Forbidden: Insufficient permissions" }, { status: 403 });
            }
            return handler(req);
        }
        catch (error) {
            console.error("Permission middleware error:", error);
            return server_1.NextResponse.json({ error: "Permission check error" }, { status: 500 });
        }
    });
}
