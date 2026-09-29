-- Restaurant OS kernel: event store schema
-- Idempotent migration; run with: npx prisma db execute or any SQL runner against DATABASE_URL

CREATE TABLE IF NOT EXISTS ros_events (
  global_position BIGSERIAL PRIMARY KEY,
  event_id        UUID NOT NULL UNIQUE,
  org_id          TEXT NOT NULL,
  venue_id        TEXT NOT NULL,
  zone_id         TEXT,
  aggregate_type  TEXT NOT NULL,
  aggregate_id    TEXT NOT NULL,
  aggregate_version INT NOT NULL,
  event_type      TEXT NOT NULL,
  occurred_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  actor           JSONB,
  payload         JSONB NOT NULL,
  metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (org_id, venue_id, aggregate_type, aggregate_id, aggregate_version)
);

CREATE INDEX IF NOT EXISTS ros_events_aggregate_idx
  ON ros_events (org_id, venue_id, aggregate_type, aggregate_id, aggregate_version);

CREATE INDEX IF NOT EXISTS ros_events_type_idx
  ON ros_events (org_id, venue_id, event_type, global_position);

CREATE TABLE IF NOT EXISTS ros_snapshots (
  org_id          TEXT NOT NULL,
  venue_id        TEXT NOT NULL,
  aggregate_type  TEXT NOT NULL,
  aggregate_id    TEXT NOT NULL,
  version         INT NOT NULL,
  snapshot_schema_version INT NOT NULL DEFAULT 1,
  state           JSONB NOT NULL,
  taken_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, venue_id, aggregate_type, aggregate_id)
);

CREATE TABLE IF NOT EXISTS ros_projections_state (
  projection_name TEXT NOT NULL,
  org_id          TEXT NOT NULL,
  venue_id        TEXT NOT NULL,
  cursor_position BIGINT NOT NULL DEFAULT 0,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (projection_name, org_id, venue_id)
);

-- Phase 3 compaction: cold tier for events at/below an aggregate's snapshot
-- version. Rows keep their original global_position/event_id, and all reads
-- (query/readAggregate) UNION hot + cold so replay, projections and audit stay
-- unchanged — only ros_events (the hot table) shrinks.
CREATE TABLE IF NOT EXISTS ros_events_archive (
  global_position BIGINT PRIMARY KEY,
  event_id        UUID NOT NULL UNIQUE,
  org_id          TEXT NOT NULL,
  venue_id        TEXT NOT NULL,
  zone_id         TEXT,
  aggregate_type  TEXT NOT NULL,
  aggregate_id    TEXT NOT NULL,
  aggregate_version INT NOT NULL,
  event_type      TEXT NOT NULL,
  occurred_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  actor           JSONB,
  payload         JSONB NOT NULL,
  metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
  archived_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ros_events_archive_aggregate_idx
  ON ros_events_archive (org_id, venue_id, aggregate_type, aggregate_id, aggregate_version);
