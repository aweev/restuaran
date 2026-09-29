import { SignJWT, jwtVerify } from "jose"
import { cookies } from "next/headers"
import type { NextRequest } from "next/server"

// Fail closed: a missing secret in production would fall back to a guessable
// key, letting anyone forge an admin token (the kernel derives ALL capabilities
// from token claims). Dev keeps a fixed fallback for convenience.
if (!process.env.JWT_SECRET && process.env.NODE_ENV === "production") {
  throw new Error("JWT_SECRET is required in production")
}
const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key"
const secretKey = new TextEncoder().encode(JWT_SECRET)

interface JWTPayload {
  [key: string]: unknown;
}

export async function signJWT(payload: JWTPayload, expiresIn = "1d") {
  const token = await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(secretKey)

  return token
}

export async function verifyJWT(token: string) {
  try {
    const { payload } = await jwtVerify(token, secretKey)
    return payload
  } catch {
    return null
  }
}

export function getTokenFromRequest(req: NextRequest) {
  // Check Authorization header first
  const authHeader = req.headers.get("authorization")
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.substring(7)
  }

  // Then check cookies
  const token = req.cookies.get("posToken")?.value
  return token || null
}

export async function getTokenFromServerComponent() {
  const cookieStore = await cookies()
  return cookieStore.get("posToken")?.value || null
}

export async function getCurrentUser(token: string | null) {
  if (!token) return null

  try {
    const payload = await verifyJWT(token)
    if (!payload) return null

    return payload
  } catch {
    return null
  }
}
