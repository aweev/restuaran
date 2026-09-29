"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.signJWT = signJWT;
exports.verifyJWT = verifyJWT;
exports.getTokenFromRequest = getTokenFromRequest;
exports.getTokenFromServerComponent = getTokenFromServerComponent;
exports.getCurrentUser = getCurrentUser;
const jose_1 = require("jose");
const headers_1 = require("next/headers");
const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";
const secretKey = new TextEncoder().encode(JWT_SECRET);
async function signJWT(payload, expiresIn = "1d") {
    const token = await new jose_1.SignJWT(payload)
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime(expiresIn)
        .sign(secretKey);
    return token;
}
async function verifyJWT(token) {
    try {
        const { payload } = await (0, jose_1.jwtVerify)(token, secretKey);
        return payload;
    }
    catch (_a) {
        return null;
    }
}
function getTokenFromRequest(req) {
    var _a;
    // Check Authorization header first
    const authHeader = req.headers.get("authorization");
    if (authHeader && authHeader.startsWith("Bearer ")) {
        return authHeader.substring(7);
    }
    // Then check cookies
    const token = (_a = req.cookies.get("posToken")) === null || _a === void 0 ? void 0 : _a.value;
    return token || null;
}
async function getTokenFromServerComponent() {
    var _a;
    const cookieStore = await (0, headers_1.cookies)();
    return ((_a = cookieStore.get("posToken")) === null || _a === void 0 ? void 0 : _a.value) || null;
}
async function getCurrentUser(token) {
    if (!token)
        return null;
    try {
        const payload = await verifyJWT(token);
        if (!payload)
            return null;
        return payload;
    }
    catch (_a) {
        return null;
    }
}
