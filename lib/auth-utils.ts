// lib/auth-utils.ts — compat layer over the canonical jose stack in lib/jwt.ts.
// New code should import from "@/lib/jwt" directly.
import { z } from "zod";
import { hash, compare } from "bcrypt";
import { sql } from "@/lib/db";
import { verifyAccessToken, getAccessTokenFromRequest } from "@/lib/jwt";
import { type NextRequest } from "next/server";

// Define a type for the payload of your JWT
export interface UserPayload {
  sub: string; // User ID
  email: string;
  role: string;
  permissions?: string[];
  exp?: number;
  iat?: number;
  [key: string]: unknown;
}

// Row shape returned by `SELECT * FROM "User"`.
interface UserRow {
  id: string;
  name: string;
  email: string;
  role: string;
  avatar: string | null;
  phone: string | null;
  address: string | null;
  hireDate: Date | null;
  isActive: boolean;
  lastLogin: Date | null;
  customPermissions: string[] | null;
}

export async function getCurrentUser(token: string | null): Promise<
  | {
      id: string;
      name: string;
      email: string;
      role: string;
      avatar: string | null;
      phone: string | null;
      address: string | null;
      hireDate: string | null;
      isActive: boolean;
      lastLogin: string | null;
      customPermissions: string[];
    }
  | null
> {
  if (!token) return null;

  try {
    const payload = (await verifyJWT(token)) as UserPayload;
    if (!payload) return null;

    const users = await sql`
      SELECT * FROM "User" WHERE id = ${payload.sub}
    `;

    if (users.length === 0) {
      return null;
    }

    const user = users[0] as unknown as UserRow;

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
      customPermissions: user.customPermissions ?? [],
    };
  } catch (error) {
    console.error("Error verifying JWT:", error);
    return null;
  }
}

export async function getTokenFromRequest(
  req: NextRequest
): Promise<string | null> {
  return getAccessTokenFromRequest(req);
}

export async function hashPassword(password: string): Promise<string> {
  return hash(password, 10);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return compare(password, hash);
}

export function generateToken(): string | null {
  // Removed: legacy 24h jsonwebtoken signer. Use signAccessToken/signTokenPair from "@/lib/jwt".
  throw new Error('generateToken() was removed — use signAccessToken() from "@/lib/jwt"');
}

export async function verifyToken(token: string): Promise<UserPayload | null> {
  const payload = await verifyAccessToken(token);
  return (payload as unknown as UserPayload) ?? null;
}

// A permission-bearing principal. Accepts both the JWT payload (which carries
// `permissions`) and the client-side `User` (which also carries `customPermissions`).
export interface PermissionSubject {
  permissions?: readonly string[] | null
  customPermissions?: readonly string[] | null
}

function collectPermissions(user: PermissionSubject | undefined | null): string[] {
  if (!user) return []
  return [...(user.permissions ?? []), ...(user.customPermissions ?? [])]
}

export function hasPermission(user: PermissionSubject | undefined | null, requiredPermission: string): boolean {
  return collectPermissions(user).includes(requiredPermission)
}

export function hasAnyPermission(user: PermissionSubject | undefined | null, requiredPermissions: readonly string[]): boolean {
  const granted = collectPermissions(user)
  return requiredPermissions.some((permission) => granted.includes(permission))
}

export function hasAllPermissions(user: PermissionSubject | undefined | null, requiredPermissions: readonly string[]): boolean {
  const granted = collectPermissions(user)
  return requiredPermissions.every((permission) => granted.includes(permission))
}

export const registerSchema = z.object({
  name: z.string().min(3, "Name must be at least 3 characters"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  role: z.enum(["admin", "manager", "server", "kitchen", "cashier"]),
  phone: z.string().optional(),
  address: z.string().optional(),
});

async function verifyJWT(token: string): Promise<UserPayload> {
  const payload = await verifyAccessToken(token);
  if (!payload) throw new Error("Invalid token");
  return payload as unknown as UserPayload;
}
