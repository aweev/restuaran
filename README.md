# Restaurant POS

A point-of-sale, kitchen-display and guest-ordering system for a working
restaurant. Next.js 15 (App Router) · React 19 · Tailwind v4 · Postgres ·
an event-sourced domain kernel under `kernel/`.

---

## Getting started

### 1. Prerequisites

- Node 20+
- A Postgres 13+ database (local, Docker, Neon, …)

### 2. Environment

Copy `.env.example` to `.env.local` and fill it in:

```bash
cp .env.example .env.local
```

| Variable          | Required | Purpose                                              |
| ----------------- | -------- | ---------------------------------------------------- |
| `DATABASE_URL`    | yes      | Postgres connection string                            |
| `JWT_SECRET`      | yes      | Signs session tokens — use a long random value        |
| `ROS_USE_PG`      | no       | `1` makes the kernel use Postgres instead of memory   |
| `INTERNAL_EMIT_SECRET` | no | Enables the kernel's Socket.IO bridge            |
| `NEXT_PUBLIC_SOCKET_URL` | no | Where the browser reaches the socket server     |
| `WS_PORT`         | no       | Port for the standalone socket server (`npm run start:ws`) |
| `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_PHONE_NUMBER` | no | Enables SMS waitlist notifications |

### 3. Database

The schema and seed are plain SQL, so any runner works.

```bash
# schema — idempotent, safe to re-run
psql "$DATABASE_URL" -f db/schema.sql

# event-sourced kernel store
psql "$DATABASE_URL" -f kernel/event-store/schema.sql

# demo data — resets to a known state
psql "$DATABASE_URL" -f db/seed.sql
```

No `prisma generate` step: this project talks to Postgres directly through
`lib/db.ts`, so there is no ORM and nothing to codegen.

### 4. Run

```bash
npm install
npm run dev            # http://localhost:3000
```

Realtime features additionally need the socket server:

```bash
npm run start:ws       # separate process, WS_PORT (default 3001)
```

### 5. Sign in

Every seeded account uses the password **`pos1234`**.

| Email                     | Role             | Lands on         |
| ------------------------- | ---------------- | ---------------- |
| `owner@copperfig.test`    | Owner / Admin    | Dashboard        |
| `manager@copperfig.test`  | Floor Manager    | Dashboard        |
| `host@copperfig.test`     | Host             | Dashboard        |
| `waiter@copperfig.test`   | Server           | Tables           |
| `waiter2@copperfig.test`  | Server           | Tables           |
| `bartender@copperfig.test`| Bartender        | Dashboard        |
| `cashier@copperfig.test`  | Cashier          | New order        |
| `kitchen@copperfig.test`  | Kitchen          | Kitchen display  |

> The sign-in endpoint no longer falls back to a demo administrator. An unknown
> address fails exactly like a wrong password, and repeated failures are
> rate-limited. If you cannot sign in, the usual cause is an unseeded database.

---

## Commands

| Command                    | What it does                                  |
| -------------------------- | --------------------------------------------- |
| `npm run dev`              | Dev server (Turbopack)                        |
| `npm run build`            | Production build                              |
| `npm run typecheck`        | `tsc --noEmit`                                |
| `npm run lint`             | ESLint                                        |
| `npm run verify:sql`       | Static schema/seed consistency check (no DB needed) |
| `npm run assets:icons`     | Regenerate the PWA icons                      |
| `npm run start:ws`         | Standalone Socket.IO server                   |
| `npm run kernel:typecheck` | Typecheck the kernel in isolation             |
| `npm run kernel:smoke`     | Kernel smoke tests                            |
| `npm run kernel:sdk:check` | Regenerate + diff the public SDK              |

---

## Architecture

```
app/          Next routes, API handlers, customer-facing pages
components/   UI. components/ui is shadcn primitives; everything else is product
context/      Client-side domain state (React context)
kernel/       Event-sourced, command-driven domain core — see kernel/README.md
db/           schema.sql + seed.sql — the canonical relational model
lib/          db access, auth, feedback, personas
```

### Data access

All SQL goes through `lib/db.ts`. Two entry points, deliberately different:

- `sql` — forgiving in development. If Postgres is unreachable it returns an
  empty result so the app still boots. Correct for **reads**.
- `sqlWrite` (`lib/db-helpers.ts`) — always throws. A swallowed `INSERT` that
  still returns `201` would tell a cashier an order was taken when it was not.

Money is `NUMERIC(12,2)`; never a float.

### The kernel

`kernel/` is an event-sourced, multi-tenant command bus with projections
(`kitchen.queue`, `tables.board`, `menu.board`, `inventory.board`,
`reservations.board`, `waitlist.board`) and a plugin architecture. It is the
intended direction for domain state; the REST routes in `app/api` remain the
current read/write path for CRUD screens. See `kernel/README.md`.

By default the kernel uses an in-memory event store in development. Set
`ROS_USE_PG=1` and apply `kernel/event-store/schema.sql` to persist it.

---

## Regenerating assets

PWA icons are generated, not committed as opaque binaries:

```bash
node scripts/generate-icons.mjs
```
