"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { LoginForm } from "@/components/auth/login-form";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, Flame, Keyboard, LifeBuoy } from "lucide-react";
import { getVenueSettings } from "@/lib/settings";

const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION || "dev";

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null);
  const [support, setSupport] = useState("");

  useEffect(() => {
    setSupport(getVenueSettings().supportContact || "");
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-background to-muted/60 px-4 py-12 sm:px-6 lg:px-8 pos-fade-in">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm" aria-hidden>
            <Flame className="h-6 w-6" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Maison Chili POS</h1>
          <p className="text-sm text-muted-foreground">Sign in to your shift — orders, tables, kitchen and reports.</p>
        </div>

        {error && (
          <Alert variant="destructive" role="alert">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Sign-in failed</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Welcome back</CardTitle>
            <CardDescription>Use your staff email and password.</CardDescription>
          </CardHeader>
          <CardContent>
            <LoginForm onError={setError} />
          </CardContent>
        </Card>

        <div className="flex flex-col items-center gap-2 text-center text-xs text-muted-foreground">
          <p className="inline-flex items-center gap-1.5">
            <Keyboard className="h-3.5 w-3.5" /> Press Ctrl+K anywhere to jump between screens
          </p>
          <p className="inline-flex items-center gap-1.5">
            <LifeBuoy className="h-3.5 w-3.5" />
            {support ? (
              <span>Stuck mid-service? Call <span className="font-medium text-foreground">{support}</span></span>
            ) : (
              <span>Stuck mid-service? Ask a manager — the support number lives in Settings.</span>
            )}
          </p>
          <p>
            New here? <Link href="/register" className="underline underline-offset-2">Create an account</Link>
            {" · "}
            <Link href="/forgot-password" className="underline underline-offset-2">Forgot password?</Link>
          </p>
          <p className="text-[11px] opacity-70">Restaurant OS · build {APP_VERSION}</p>
        </div>
      </div>
    </div>
  );
}
