"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PermissionGuard = PermissionGuard;
exports.AnyPermissionGuard = AnyPermissionGuard;
exports.AllPermissionsGuard = AllPermissionsGuard;
const AuthContext_1 = require("@/context/AuthContext");
const auth_utils_1 = require("@/lib/auth-utils");
function PermissionGuard({ permission, children, fallback }) {
    const { state } = (0, AuthContext_1.useAuth)();
    const { user } = state;
    if (user && (0, auth_utils_1.hasPermission)(user, permission)) {
        return <>{children}</>;
    }
    return fallback ? <>{fallback}</> : null;
}
function AnyPermissionGuard({ permissions, children, fallback }) {
    const { state } = (0, AuthContext_1.useAuth)();
    const { user } = state;
    if (user && (0, auth_utils_1.hasAnyPermission)(user, permissions)) {
        return <>{children}</>;
    }
    return fallback ? <>{fallback}</> : null;
}
function AllPermissionsGuard({ permissions, children, fallback }) {
    const { state } = (0, AuthContext_1.useAuth)();
    const { user } = state;
    if (user && (0, auth_utils_1.hasAllPermissions)(user, permissions)) {
        return <>{children}</>;
    }
    return fallback ? <>{fallback}</> : null;
}
