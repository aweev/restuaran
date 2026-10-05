import { SignJWT, jwtVerify } from "jose"
import { cookies } from "next/headers"
import type { NextRequest, NextResponse } from "next/server"

if (!process.env.JWT_SECRET && process.env.NODE_ENV === "production") {
  throw new Error("JWT_SECRET is required in production")
}
const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key"
const secretKey = new TextEncoder().encode(JWT_SECRET)

const ACCESS_TOKEN_EXPIRY = "15m"
const REFRESH_TOKEN_EXPIRY = "7d"

interface JWTPayload {
  [key: string]: unknown;
}

interface TokenPair {
  accessToken: string
  refreshToken: string
}

export async function signAccessToken(payload: JWTPayload): Promise<string> {
  return new SignJWT({ ...payload, type: "access" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(ACCESS_TOKEN_EXPIRY)
    .sign(secretKey)
}

export async function signRefreshToken(payload: JWTPayload): Promise<string> {
  return new SignJWT({ ...payload, type: "refresh" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(REFRESH_TOKEN_EXPIRY)
    .sign(secretKey)
}

export async function signTokenPair(payload: JWTPayload): Promise<TokenPair> {
  const [accessToken, refreshToken] = await Promise.all([
    signAccessToken(payload),
    signRefreshToken(payload),
  ])
  return { accessToken, refreshToken }
}

export async function verifyJWT(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey)
    return payload as JWTPayload
  } catch {
    return null
  }
}

export async function verifyAccessToken(token: string): Promise<JWTPayload | null> {
  const payload = await verifyJWT(token)
  if (!payload || payload.type !== "access") return null
  return payload
}

export async function verifyRefreshToken(token: string): Promise<JWTPayload | null> {
  const payload = await verifyJWT(token)
  if (!payload || payload.type !== "refresh") return null
  return payload
}

export function getAccessTokenFromRequest(req: NextRequest): string | null {
  const authHeader = req.headers.get("authorization")
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.substring(7)
  }
  return req.cookies.get("posAccessToken")?.value ?? null
}

export function getRefreshTokenFromRequest(req: NextRequest): string | null {
  return req.cookies.get("posRefreshToken")?.value ?? null
}

export async function getRefreshTokenFromServerComponent(): Promise<string | null> {
  const cookieStore = await cookies()
  return cookieStore.get("posRefreshToken")?.value ?? null
}

/** Back-compat alias: reads the Bearer access token from the request. */
export const getTokenFromRequest = getAccessTokenFromRequest

export function setAuthCookies(
  res: NextResponse,
  accessToken: string,
  refreshToken: string
): void {
  res.cookies.set("posAccessToken", accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 60 * 15,
  })

  res.cookies.set("posRefreshToken", refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  })
}

export function clearAuthCookies(res: NextResponse): void {
  res.cookies.delete("posAccessToken")
  res.cookies.delete("posRefreshToken")
}

export async function getCurrentUser(token: string | null) {
  if (!token) return null

  try {
    const payload = await verifyAccessToken(token)
    if (!payload) return null
    return payload
  } catch {
    return null
  }
}
