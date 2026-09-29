"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
const server_1 = require("next/server");
const auth_utils_1 = require("@/lib/auth-utils");
async function GET(req) {
    try {
        const token = await (0, auth_utils_1.getTokenFromRequest)(req); // Ensure getTokenFromRequest is async
        const user = await (0, auth_utils_1.getCurrentUser)(token);
        if (!user) {
            return server_1.NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        return server_1.NextResponse.json({ user });
    }
    catch (error) {
        console.error("Get current user error:", error);
        return server_1.NextResponse.json({ error: "An error occurred while fetching user data" }, { status: 500 });
    }
}
