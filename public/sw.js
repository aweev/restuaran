/// <reference lib="webworker" />

importScripts("https://storage.googleapis.com/workbox-cdn/releases/7.3.0/workbox-sw.js")

/* global workbox */

workbox.precaching.precacheAndRoute(self.__WB_MANIFEST)
workbox.precaching.cleanupOutdatedCaches()

/**
 * API responses are NEVER cached.
 *
 * Every `/api/*` route in this app is authenticated by cookie, and a POS
 * terminal is shared: an authenticated response left in a named cache is one
 * `fetch()` away from being shown to the next user who logs in. A previous
 * version tried to skip only requests with `credentials: "include"`, but the
 * Cache API normalises stored requests to `credentials: "same-origin"`, so
 * that guard could not identify an authenticated response and the leak stood.
 *
 * Failing closed is the only safe rule here. Offline behaviour lives in the
 * command queue (kernel-provider), which is explicit and user-owned, rather
 * than in an implicit HTTP cache.
 */
workbox.routing.registerRoute(
  ({ url }) => url.pathname.startsWith("/api/"),
  new workbox.strategies.NetworkOnly()
)

/**
 * Navigations are network-first with a short offline fallback. The dashboard
 * shell is not user data — real data arrives via `/api/*` (never cached) — so
 * caching the shell only buys an offline paint. It is still dropped on logout
 * so a stale shell cannot be shown to the next session.
 */
workbox.routing.registerRoute(
  ({ request }) => request.mode === "navigate",
  new workbox.strategies.NetworkFirst({
    cacheName: "pages",
    networkTimeoutSeconds: 3,
    plugins: [
      new workbox.expiration.ExpirationPlugin({
        maxEntries: 20,
        maxAgeSeconds: 24 * 60 * 60,
      }),
    ],
  })
)

workbox.routing.registerRoute(
  ({ request }) => request.destination === "script" || request.destination === "style",
  new workbox.strategies.StaleWhileRevalidate({
    cacheName: "static-resources",
    plugins: [
      new workbox.expiration.ExpirationPlugin({
        maxEntries: 100,
        maxAgeSeconds: 7 * 24 * 60 * 60,
      }),
    ],
  })
)

workbox.routing.registerRoute(
  ({ request }) => request.destination === "image",
  new workbox.strategies.CacheFirst({
    cacheName: "images",
    plugins: [
      new workbox.expiration.ExpirationPlugin({
        maxEntries: 100,
        maxAgeSeconds: 30 * 24 * 60 * 60,
      }),
    ],
  })
)

/** Caches holding anything session-shaped, purged whenever a session ends. */
const SESSION_SCOPED_CACHES = ["pages", "api-cache"]

self.addEventListener("message", (event) => {
  if (event.data === "skipWaiting") {
    self.skipWaiting()
    return
  }

  if (event.data === "CLEAR_AUTH_CACHE") {
    // Delete by name: enumerating cache contents and filtering by request
    // flags is unreliable (see the note above about `credentials`), and the
    // session-scoped set is known and small.
    event.waitUntil(
      Promise.all(SESSION_SCOPED_CACHES.map((name) => caches.delete(name)))
    )
  }
})

self.addEventListener("install", () => {
  self.skipWaiting()
})

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim())
})