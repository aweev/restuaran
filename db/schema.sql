-- ============================================================================
-- Restaurant POS — canonical relational schema
--
-- Idempotent: safe to run repeatedly. Apply with:
--   psql "$DATABASE_URL" -f db/schema.sql
--
-- Conventions
--   * Identifiers are quoted PascalCase ("Order", "MenuItem"). A few legacy
--     routes used unquoted snake_case (reservations, ingredients); those are
--     migrated here to the single convention and their routes updated.
--   * Primary keys are TEXT, not UUID. The event-sourced kernel uses TEXT
--     aggregate ids (see kernel/event-store/schema.sql) and human-readable
--     ids ("table-t1") make seeds and support tickets far easier to trace.
--   * Money is NUMERIC(12,2). Never float.
--   * All timestamps are TIMESTAMPTZ.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE "OrderStatus" AS ENUM (
    'pending', 'preparing', 'ready', 'served', 'delivered', 'completed', 'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "FoodType" AS ENUM ('Veg', 'Non Veg');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "TableStatus" AS ENUM ('available', 'occupied', 'reserved', 'dirty');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "PaymentMethod" AS ENUM ('cash', 'credit', 'debit', 'mobile', 'gift');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "DiningMode" AS ENUM ('Dine in', 'Take Away', 'Delivery');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "ReservationStatus" AS ENUM (
    'pending', 'confirmed', 'seated', 'completed', 'cancelled', 'no_show'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "LoyaltyTier" AS ENUM ('bronze', 'silver', 'gold', 'platinum');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------------------
-- Staff
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "User" (
  id                 TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name               TEXT NOT NULL,
  email              TEXT NOT NULL,
  password           TEXT NOT NULL,
  -- Roles: admin, manager, owner, server, waiter, host, host_staff, cashier, bartender, delivery, kitchen, staff
  role               TEXT NOT NULL DEFAULT 'staff',
  avatar             TEXT,
  phone              TEXT,
  address            TEXT,
  "hireDate"         TIMESTAMPTZ,
  "isActive"         BOOLEAN NOT NULL DEFAULT TRUE,
  "lastLogin"        TIMESTAMPTZ,
  customPermissions  TEXT[] NOT NULL DEFAULT '{}',
  "createdAt"        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Fast shared-device login. NULL = no PIN set. Attempts/lockout live here
  -- (not the kernel) because auth is session infrastructure, not domain state.
  "pinHash"          TEXT,
  "pinAttempts"      INTEGER NOT NULL DEFAULT 0,
  "pinLockedUntil"   TIMESTAMPTZ
);
-- Existing deployments: add PIN columns idempotently.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "pinHash" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "pinAttempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "pinLockedUntil" TIMESTAMPTZ;
CREATE UNIQUE INDEX IF NOT EXISTS user_email_key ON "User" (LOWER(email));
CREATE INDEX IF NOT EXISTS user_role_idx ON "User" (role) WHERE "isActive";

-- Shifts / time clock (the kernel keeps its own event-sourced view; this is the
-- operational roster the host stand and payroll screens read).
CREATE TABLE IF NOT EXISTS "Shift" (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "userId"    TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  "startTime" TIMESTAMPTZ NOT NULL,
  "endTime"   TIMESTAMPTZ,
  "breakMins" INTEGER NOT NULL DEFAULT 0,
  notes       TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS shift_user_idx ON "Shift" ("userId", "startTime" DESC);

-- ---------------------------------------------------------------------------
-- Floor plan
-- positionX/positionY drive the drag-to-seat floor plan; section groups tables
-- into server-owned zones.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "Table" (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  number          TEXT NOT NULL,
  capacity        INTEGER NOT NULL DEFAULT 2 CHECK (capacity > 0),
  status          "TableStatus" NOT NULL DEFAULT 'available',
  "customerName"  TEXT,
  "customerCount" INTEGER,
  "startTime"     TIMESTAMPTZ,
  "serverName"    TEXT,
  "serverId"      TEXT REFERENCES "User"(id) ON DELETE SET NULL,
  "positionX"     INTEGER NOT NULL DEFAULT 0,
  "positionY"     INTEGER NOT NULL DEFAULT 0,
  shape           TEXT NOT NULL DEFAULT 'round',
  section         TEXT NOT NULL DEFAULT 'main',
  "createdAt"     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS table_number_key ON "Table" (number);
CREATE INDEX IF NOT EXISTS table_status_idx ON "Table" (status);
CREATE INDEX IF NOT EXISTS table_section_idx ON "Table" (section);
-- ---------------------------------------------------------------------------
-- Menu
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "MenuItem" (
  id                   TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  title                TEXT NOT NULL,
  description          TEXT NOT NULL DEFAULT '',
  price                NUMERIC(12,2) NOT NULL CHECK (price >= 0),
  image                TEXT,
  category             TEXT NOT NULL DEFAULT 'main',
  type                 "FoodType" NOT NULL DEFAULT 'Veg',
  available            BOOLEAN NOT NULL DEFAULT TRUE,
  discount             NUMERIC(12,2),
  popular              BOOLEAN NOT NULL DEFAULT FALSE,
  allergens            TEXT[] NOT NULL DEFAULT '{}',
  calories             INTEGER,
  protein              NUMERIC(6,2),
  carbs                NUMERIC(6,2),
  fat                  NUMERIC(6,2),
  -- Operational + merchandising fields used by the KDS and the customer menu.
  cost                 NUMERIC(12,2) NOT NULL DEFAULT 0,
  "preparationMinutes" INTEGER NOT NULL DEFAULT 10,
  "spiceLevel"         SMALLINT NOT NULL DEFAULT 0 CHECK ("spiceLevel" BETWEEN 0 AND 3),
  tags                 TEXT[] NOT NULL DEFAULT '{}',
  "sortOrder"          INTEGER NOT NULL DEFAULT 0,
  "isChefPick"         BOOLEAN NOT NULL DEFAULT FALSE,
  "createdAt"          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS menuitem_category_idx ON "MenuItem" (category);
CREATE INDEX IF NOT EXISTS menuitem_available_idx ON "MenuItem" (available);
CREATE INDEX IF NOT EXISTS menuitem_popular_idx ON "MenuItem" (popular) WHERE popular;

CREATE TABLE IF NOT EXISTS "MenuItemModifier" (
  id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name         TEXT NOT NULL,
  required     BOOLEAN NOT NULL DEFAULT FALSE,
  multiple     BOOLEAN NOT NULL DEFAULT FALSE,
  "maxSelect"  INTEGER,
  "sortOrder"  INTEGER NOT NULL DEFAULT 0,
  "menuItemId" TEXT NOT NULL REFERENCES "MenuItem"(id) ON DELETE CASCADE,
  "createdAt"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS modifier_item_idx ON "MenuItemModifier" ("menuItemId");

CREATE TABLE IF NOT EXISTS "MenuItemModifierOption" (
  id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name         TEXT NOT NULL,
  price        NUMERIC(12,2) NOT NULL DEFAULT 0,
  "isDefault"  BOOLEAN NOT NULL DEFAULT FALSE,
  "sortOrder"  INTEGER NOT NULL DEFAULT 0,
  "modifierId" TEXT NOT NULL REFERENCES "MenuItemModifier"(id) ON DELETE CASCADE,
  "createdAt"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS modifieropt_modifier_idx ON "MenuItemModifierOption" ("modifierId");

-- Per-item ticket times, so the KDS can escalate against a promise the venue made.
CREATE TABLE IF NOT EXISTS "PreparationTime" (
  "menuItemId"    TEXT PRIMARY KEY REFERENCES "MenuItem"(id) ON DELETE CASCADE,
  "timeInMinutes" INTEGER NOT NULL CHECK ("timeInMinutes" BETWEEN 1 AND 120)
);
-- ---------------------------------------------------------------------------
-- Orders
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "Order" (
  id             TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "tableId"      TEXT REFERENCES "Table"(id) ON DELETE SET NULL,
  "customerName" TEXT,
  "customerId"   TEXT REFERENCES "Customer"(id) ON DELETE SET NULL,
  status         "OrderStatus" NOT NULL DEFAULT 'pending',
  "diningMode"   "DiningMode" NOT NULL DEFAULT 'Dine in',
  "serverId"     TEXT REFERENCES "User"(id) ON DELETE SET NULL,
  subtotal       NUMERIC(12,2) NOT NULL DEFAULT 0,
  tax            NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount       NUMERIC(12,2) NOT NULL DEFAULT 0,
  tip            NUMERIC(12,2) NOT NULL DEFAULT 0,
  total          NUMERIC(12,2) NOT NULL DEFAULT 0,
  "isPaid"       BOOLEAN NOT NULL DEFAULT FALSE,
  notes          TEXT,
  "createdAt"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS order_status_idx ON "Order" (status);
CREATE INDEX IF NOT EXISTS order_table_idx ON "Order" ("tableId");
CREATE INDEX IF NOT EXISTS order_created_idx ON "Order" ("createdAt" DESC);
CREATE INDEX IF NOT EXISTS order_customer_idx ON "Order" ("customerName");

CREATE TABLE IF NOT EXISTS "OrderItem" (
  id                    TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "orderId"             TEXT NOT NULL REFERENCES "Order"(id) ON DELETE CASCADE,
  "menuItemId"          TEXT REFERENCES "MenuItem"(id) ON DELETE SET NULL,
  title                 TEXT NOT NULL,
  price                 NUMERIC(12,2) NOT NULL DEFAULT 0,
  quantity              INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  "totalPrice"          NUMERIC(12,2) NOT NULL DEFAULT 0,
  "specialInstructions" TEXT,
  type                  "FoodType" NOT NULL DEFAULT 'Veg',
  "course"              INTEGER NOT NULL DEFAULT 1,
  "sentToKitchenAt"     TIMESTAMPTZ,
  "createdAt"           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS orderitem_order_idx ON "OrderItem" ("orderId");

CREATE TABLE IF NOT EXISTS "ModifierSelection" (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "orderItemId" TEXT NOT NULL REFERENCES "OrderItem"(id) ON DELETE CASCADE,
  "modifierId"  TEXT NOT NULL,
  "optionIds"   TEXT[] NOT NULL DEFAULT '{}',
  "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS modsel_orderitem_idx ON "ModifierSelection" ("orderItemId");

CREATE TABLE IF NOT EXISTS "Payment" (
  id        TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "orderId" TEXT NOT NULL REFERENCES "Order"(id) ON DELETE CASCADE,
  method    "PaymentMethod" NOT NULL,
  amount    NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
  tip       NUMERIC(12,2) NOT NULL DEFAULT 0,
  reference TEXT,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS payment_order_idx ON "Payment" ("orderId");

CREATE TABLE IF NOT EXISTS "DeliveryInfo" (
  id                      TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "orderId"               TEXT NOT NULL UNIQUE REFERENCES "Order"(id) ON DELETE CASCADE,
  provider                TEXT NOT NULL,
  status                  TEXT NOT NULL DEFAULT 'pending',
  street                  TEXT,
  city                    TEXT,
  state                   TEXT,
  "zipCode"               TEXT,
  instructions            TEXT,
  "estimatedDeliveryTime" TIMESTAMPTZ,
  "createdAt"             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- ---------------------------------------------------------------------------
-- Auth: password reset
-- The token is stored hashed (bcrypt) so a database leak cannot be replayed
-- against live accounts. `usedAt` makes every token single-use.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "PasswordResetToken" (
  id         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "userId"   TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMPTZ NOT NULL,
  "usedAt"    TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS passwordreset_user_idx
  ON "PasswordResetToken" ("userId", "expiresAt" DESC);

-- ---------------------------------------------------------------------------
-- Customers, loyalty, feedback
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "Customer" (
  id                    TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name                  TEXT NOT NULL,
  email                 TEXT,
  phone                 TEXT,
  notes                 TEXT,
  allergies             TEXT,
  "dietaryRestrictions" TEXT,
  "favoriteItems"       TEXT,
  "seatingPreferences"  TEXT,
  "visitCount"          INTEGER NOT NULL DEFAULT 0,
  "lastVisit"           TIMESTAMPTZ,
  "totalSpent"          NUMERIC(12,2) NOT NULL DEFAULT 0,
  "userId"              TEXT REFERENCES "User"(id) ON DELETE SET NULL,
  "createdAt"           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS customer_name_idx ON "Customer" (LOWER(name));
CREATE INDEX IF NOT EXISTS customer_phone_idx ON "Customer" (phone);

CREATE TABLE IF NOT EXISTS "LoyaltyCustomer" (
  id             TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  email          TEXT NOT NULL,
  phone          TEXT,
  name           TEXT NOT NULL,
  points         INTEGER NOT NULL DEFAULT 0,
  tier           "LoyaltyTier" NOT NULL DEFAULT 'bronze',
  "joinDate"     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "lastActivity" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "totalSpent"   NUMERIC(12,2) NOT NULL DEFAULT 0,
  "visitsCount"  INTEGER NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX IF NOT EXISTS loyalty_email_key ON "LoyaltyCustomer" (LOWER(email));
CREATE INDEX IF NOT EXISTS loyalty_phone_idx ON "LoyaltyCustomer" (phone);

CREATE TABLE IF NOT EXISTS "LoyaltyReward" (
  id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name         TEXT NOT NULL,
  description  TEXT NOT NULL DEFAULT '',
  "pointsCost" INTEGER NOT NULL CHECK ("pointsCost" > 0),
  available    BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt"  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "LoyaltyActivity" (
  id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "customerId" TEXT NOT NULL REFERENCES "LoyaltyCustomer"(id) ON DELETE CASCADE,
  type         TEXT NOT NULL,
  points       INTEGER NOT NULL,
  description  TEXT NOT NULL DEFAULT '',
  timestamp    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS loyaltyactivity_customer_idx
  ON "LoyaltyActivity" ("customerId", timestamp DESC);

CREATE TABLE IF NOT EXISTS "LoyaltyRedemption" (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "customerId"  TEXT NOT NULL REFERENCES "LoyaltyCustomer"(id) ON DELETE CASCADE,
  "rewardId"    TEXT NOT NULL REFERENCES "LoyaltyReward"(id) ON DELETE RESTRICT,
  "pointsCost"  INTEGER NOT NULL,
  "tableNumber" TEXT,
  timestamp     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS loyaltyredemption_customer_idx
  ON "LoyaltyRedemption" ("customerId", timestamp DESC);
CREATE TABLE IF NOT EXISTS "Feedback" (
  id               TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "orderId"        TEXT REFERENCES "Order"(id) ON DELETE SET NULL,
  "tableId"        TEXT,
  rating           INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  "foodQuality"    INTEGER CHECK ("foodQuality" BETWEEN 1 AND 5),
  "serviceQuality" INTEGER CHECK ("serviceQuality" BETWEEN 1 AND 5),
  ambience         INTEGER CHECK (ambience BETWEEN 1 AND 5),
  comments         TEXT,
  timestamp        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS feedback_timestamp_idx ON "Feedback" (timestamp DESC);

-- ---------------------------------------------------------------------------
-- Host stand
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "Reservation" (
  id             TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "customerName" TEXT NOT NULL,
  phone          TEXT,
  email          TEXT,
  "partySize"    INTEGER NOT NULL DEFAULT 2 CHECK ("partySize" > 0),
  "tableId"      TEXT REFERENCES "Table"(id) ON DELETE SET NULL,
  date           DATE NOT NULL,
  time           TIME NOT NULL,
  status         "ReservationStatus" NOT NULL DEFAULT 'pending',
  notes          TEXT,
  "createdAt"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS reservation_date_idx ON "Reservation" (date, time);

CREATE TABLE IF NOT EXISTS "WaitlistEntry" (
  id                  TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "customerName"      TEXT NOT NULL,
  "phoneNumber"       TEXT,
  "partySize"         INTEGER NOT NULL CHECK ("partySize" > 0),
  "estimatedWaitTime" INTEGER NOT NULL DEFAULT 0,
  notes               TEXT,
  notified            BOOLEAN NOT NULL DEFAULT FALSE,
  "createdAt"         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS waitlist_created_idx ON "WaitlistEntry" ("createdAt");

-- ---------------------------------------------------------------------------
-- Inventory & kitchen staffing
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "Ingredient" (
  id             TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name           TEXT NOT NULL,
  category       TEXT NOT NULL DEFAULT 'general',
  unit           TEXT NOT NULL DEFAULT 'ea',
  "currentStock" NUMERIC(12,2) NOT NULL DEFAULT 0,
  "reorderLevel" NUMERIC(12,2) NOT NULL DEFAULT 0,
  "unitCost"     NUMERIC(12,2) NOT NULL DEFAULT 0,
  "isActive"     BOOLEAN NOT NULL DEFAULT TRUE,
  "updatedAt"    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ingredient_name_idx ON "Ingredient" (name);

CREATE TABLE IF NOT EXISTS "KitchenStaffAssignment" (
  "userId"    TEXT PRIMARY KEY REFERENCES "User"(id) ON DELETE CASCADE,
  "userName"  TEXT NOT NULL,
  station     TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "AssignedOrder" (
  "userId"  TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  "orderId" TEXT NOT NULL REFERENCES "Order"(id) ON DELETE CASCADE,
  PRIMARY KEY ("userId", "orderId")
);

-- ---------------------------------------------------------------------------
-- Audit
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "AuditLog" (
  id         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "userId"   TEXT,
  action     TEXT NOT NULL,
  entity     TEXT NOT NULL,
  "entityId" TEXT,
  details    JSONB NOT NULL DEFAULT '{}'::jsonb,
  timestamp  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS auditlog_entity_idx ON "AuditLog" (entity, "entityId");
CREATE INDEX IF NOT EXISTS auditlog_timestamp_idx ON "AuditLog" (timestamp DESC);

-- ---------------------------------------------------------------------------
-- Kernel idempotency store
-- Stores CommandResult keyed by requestId to survive multi-instance deploys
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "kernel_idempotency" (
  request_id TEXT PRIMARY KEY,
  result JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS kernel_idempotency_created_idx ON "kernel_idempotency" (created_at DESC);

-- ---------------------------------------------------------------------------
-- Device fleet heartbeat
-- Every signed-in tablet/phone reports its build + role every few minutes so
-- a manager can see stale versions in Settings → Devices instead of
-- discovering them during a failed service.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "DeviceHeartbeat" (
  device_id   TEXT PRIMARY KEY,
  label       TEXT,
  app_version TEXT NOT NULL DEFAULT 'dev',
  role        TEXT,
  user_id     TEXT,
  last_seen   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS device_heartbeat_seen_idx ON "DeviceHeartbeat" (last_seen DESC);
