// lib/auth-utils.ts
import { z } from "zod";
import { hash, compare } from "bcrypt";
import { sql } from "@/lib/db";
import jwt, { JwtPayload } from "jsonwebtoken";
import { type NextRequest } from "next/server";

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error("JWT_SECRET is not defined in the environment variables");
}

// Define a type for the payload of your JWT
export interface UserPayload extends JwtPayload {
  sub: string; // User ID
  email: string;
  role: string;
  permissions?: string[]; // Optional: Include permissions in the token
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
  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader?.split(" ")[1] || null;
  return token || null;
}

export async function hashPassword(password: string): Promise<string> {
  return hash(password, 10);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return compare(password, hash);
}

export function generateToken(userId: string, email: string, role: string, permissions: string[] = []): string | null {
  if (!JWT_SECRET) {
    console.error("JWT_SECRET is not set, cannot generate token.");
    return null;
  }

  const payload: UserPayload = {
    sub: userId,
    email,
    role,
    permissions, // Include permissions in the token
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24), // Token expires in 24 hours
  };

  try {
    return jwt.sign(payload, JWT_SECRET);
  } catch (error) {
    console.error("Error signing JWT:", error);
    return null;
  }
}

export async function verifyToken(token: string): Promise<UserPayload | null> {
  if (!JWT_SECRET) {
    console.error("JWT_SECRET is not set, cannot verify token.");
    return null;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as UserPayload;
    return decoded;
  } catch (error) {
    console.error("Error verifying token:", error);
    return null;
  }
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

function verifyJWT(token: string): UserPayload | PromiseLike<UserPayload> {
  if (!JWT_SECRET) {
    throw new Error("JWT_SECRET is not set, cannot verify token.");
  }

  try {
    return jwt.verify(token, JWT_SECRET) as UserPayload;
  } catch (error) {
    console.error("Error verifying JWT:", error);
    throw new Error("Invalid token");
  }
}
