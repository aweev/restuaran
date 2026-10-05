import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

function generateNonce(): string {
  const array = new Uint8Array(16)
  crypto.getRandomValues(array)
  return Buffer.from(array).toString("base64")
}

function buildCspHeader(nonce: string): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'wasm-unsafe-eval' 'unsafe-inline' 'nonce-${nonce}'`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ")
}

export function middleware(request: NextRequest) {
  const nonce = generateNonce()
  const csp = buildCspHeader(nonce)

  const response = NextResponse.next()
  response.headers.set("Content-Security-Policy", csp)
  response.headers.set("x-csp-nonce", nonce)

  const securityHeaders = [
    ["X-Frame-Options", "DENY"],
    ["X-Content-Type-Options", "nosniff"],
    ["Referrer-Policy", "strict-origin-when-cross-origin"],
    ["Permissions-Policy", "camera=(self), microphone=(), geolocation=()"],
    ["Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload"],
  ]

  for (const [key, value] of securityHeaders) {
    response.headers.set(key, value)
  }

  // Passthrough for upstream rate-limit headers (e.g. set by /api/kernel):
  // the middleware-generated response must not strip them.
  for (const name of ["x-ratelimit-limit", "x-ratelimit-remaining", "x-ratelimit-reset", "retry-after"]) {
    const v = request.headers.get(name)
    if (v && !response.headers.has(name)) response.headers.set(name, v)
  }

  return response
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|manifest.json|icons|sw.js).*)",
  ],
}