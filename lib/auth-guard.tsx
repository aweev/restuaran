"use client";

import { useAuth } from "@/context/AuthContext";
import { getUserPermissions } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ShieldAlert } from "lucide-react";

/**
 * Client-side route guard. Middleware only sets CSP headers (it cannot read
 * the HttpOnly JWT without a verify step), so capability gating lives here.
 */
export function RequireCapability({
  capability,
  children,
}: {
  capability: string;
  children: React.ReactNode;
}) {
  const { state } = useAuth();
  const user = state.user;

  if (state.loading) {
    return <p className="p-6 text-sm text-muted-foreground">Checking access…</p>;
  }

  const role = user?.role;
  const elevated = role === "admin" || role === "manager" || role === "owner";
  const perms = user ? (getUserPermissions(user) as string[]) : [];
  const allowed = !!user && (elevated || perms.includes(capability));

  if (!allowed) {
    return (
      <Card className="mx-auto mt-10 max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-destructive" /> Access restricted
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Ask a manager — your role ({role ?? "signed out"}) doesn&apos;t include{" "}
            <code>{capability}</code>.
          </p>
          <Button asChild variant="outline" size="sm">
            <Link href="/dashboard">Back to dashboard</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return <>{children}</>;
}
