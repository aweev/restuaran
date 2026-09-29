"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isTokenExpired = isTokenExpired;
exports.getUserPermissions = getUserPermissions;
exports.hasPermission = hasPermission;
exports.hasAnyPermission = hasAnyPermission;
exports.hasAllPermissions = hasAllPermissions;
exports.formatDuration = formatDuration;
exports.calculateHoursWorked = calculateHoursWorked;
const jwt_decode_1 = require("jwt-decode");
const auth_1 = require("@/types/auth");
function isTokenExpired(token) {
    try {
        const decoded = (0, jwt_decode_1.jwtDecode)(token);
        const currentTime = Date.now() / 1000;
        return decoded.exp < currentTime;
    }
    catch (_a) {
        return true;
    }
}
function getUserPermissions(user) {
    if (!user)
        return [];
    // Start with role-based permissions
    const rolePermissions = auth_1.ROLE_PERMISSIONS[user.role] || [];
    // Add any custom permissions assigned to the user
    const customPermissions = user.customPermissions || [];
    // Combine and remove duplicates
    return [...new Set([...rolePermissions, ...customPermissions])];
}
function hasPermission(user, permission) {
    if (!user)
        return false;
    const permissions = getUserPermissions(user);
    return permissions.includes(permission);
}
function hasAnyPermission(user, permissions) {
    if (!user)
        return false;
    const userPermissions = getUserPermissions(user);
    return permissions.some((permission) => userPermissions.includes(permission));
}
function hasAllPermissions(user, permissions) {
    if (!user)
        return false;
    const userPermissions = getUserPermissions(user);
    return permissions.every((permission) => userPermissions.includes(permission));
}
// Format duration in hours and minutes
function formatDuration(startTime, endTime) {
    if (!endTime)
        return "In progress";
    const start = new Date(startTime).getTime();
    const end = new Date(endTime).getTime();
    const durationMs = end - start;
    const hours = Math.floor(durationMs / (1000 * 60 * 60));
    const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
}
// Calculate hours worked
function calculateHoursWorked(startTime, endTime) {
    if (!endTime)
        return 0;
    const start = new Date(startTime).getTime();
    const end = new Date(endTime).getTime();
    const durationMs = end - start;
    return Number.parseFloat((durationMs / (1000 * 60 * 60)).toFixed(2));
}
