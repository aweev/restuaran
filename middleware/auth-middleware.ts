// auth-middleware.ts
import { type NextRequest, NextResponse } from "next/server";
import { getTokenFromRequest, verifyToken, hasPermission } from "@/lib/auth-utils";
import { UserPayload } from "@/lib/auth-utils"; // Import the UserPayload type

// Extend NextRequest to include a user property
declare module "next/server" {
  interface NextRequest {
    user?: UserPayload; // Use the imported type
  }
}

/**
 * A request that has already been through `withAuth`, so `user` is guaranteed
 * to be present. Handlers wrapped by the HOFs below receive this narrower type,
 * which removes the `possibly undefined` checks at every `req.user.sub` call site.
 */
export type AuthenticatedRequest = NextRequest & { user: UserPayload };

/**
 * Next.js route context carrying the dynamic segment params for `[id]`-style routes.
 *
 * Next 15 delivers `params` as a Promise, so handlers must `await params` rather
 * than destructure it synchronously.
 */
export type RouteContext<P> = { params: Promise<P> };

/** Handler shape accepted by `withAuth` / `withPermission`. */
export type AuthHandler<P> = (
  req: AuthenticatedRequest,
  ctx: RouteContext<P>,
) => Promise<NextResponse> | NextResponse;

export function withAuth<P = Record<string, never>>(handler: AuthHandler<P>) {
  return async (req: NextRequest, ctx: RouteContext<P>): Promise<NextResponse> => {
    try {
      const token = await getTokenFromRequest(req); // Ensure getTokenFromRequest is awaited

      if (!token) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      const decoded = await verifyToken(token); // Ensure verifyToken is awaited
      if (!decoded) {
        return NextResponse.json({ error: "Invalid or expired token" }, { status: 401 });
      }

      // Add user to request. `withAuth` guarantees the handler only runs with a
      // decoded token, so narrowing here is safe.
      return handler(req as AuthenticatedRequest, ctx);
    } catch (error) {
      console.error("Auth middleware error:", error);
      return NextResponse.json({ error: "Authentication error" }, { status: 500 });
    }
  };
}

export function withPermission<P = Record<string, never>>(handler: AuthHandler<P>, requiredPermission: string) {
  return withAuth<P>(async (req: AuthenticatedRequest, ctx: RouteContext<P>) => {
    try {
      if (!hasPermission(req.user, requiredPermission)) {
        return NextResponse.json({ error: "Forbidden: Insufficient permissions" }, { status: 403 });
      }

      return handler(req, ctx);
    } catch (error) {
      console.error("Permission middleware error:", error);
      return NextResponse.json({ error: "Permission check error" }, { status: 500 });
    }
  });
}