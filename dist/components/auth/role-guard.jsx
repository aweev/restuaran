"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RoleGuard = RoleGuard;
const AuthContext_1 = require("@/context/AuthContext");
function RoleGuard({ roles, children, fallback }) {
    const { state } = (0, AuthContext_1.useAuth)();
    const { user } = state;
    if (user && roles.includes(user.role)) {
        return <>{children}</>;
    }
    return fallback ? <>{fallback}</> : null;
}
