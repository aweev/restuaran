"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PostgresEventStore = void 0;
const types_1 = require("@/kernel/types");
const EVENT_COLUMNS = `global_position, event_id, org_id, venue_id, zone_id, aggregate_type,
            aggregate_id, aggregate_version, event_type, occurred_at, actor, payload, metadata`;
function rowToEvent(row) {
    var _a, _b;
    const tenant = (_a = row.tenant) !== null && _a !== void 0 ? _a : Object.assign({ orgId: String(row.org_id), venueId: String(row.venue_id) }, (row.zone_id ? { zoneId: String(row.zone_id) } : {}));
    return {
        eventId: String(row.event_id),
        eventType: String(row.event_type),
        aggregateType: String(row.aggregate_type),
        aggregateId: String(row.aggregate_id),
        aggregateVersion: Number(row.aggregate_version),
        tenant,
        actor: (_b = row.actor) !== null && _b !== void 0 ? _b : undefined,
        occurredAt: String(row.occurred_at),
        payload: row.payload,
        metadata: row.metadata,
        globalPosition: Number(row.global_position),
    };
}
class PostgresEventStore {
    constructor(db) {
        this.db = db;
        this.listeners = new Set();
    }
    async append(event, options) {
        const [stored] = await this.appendMany([event], options);
        return stored;
    }
    /**
     * Guard + inserts run as ONE statement (CTE), so a batch commits fully or not
     * at all — no partial streams, no version gaps, one round trip. The UNIQUE
     * (org, venue, type, id, version) constraint closes the race window between
     * concurrent writers: the loser gets 23505, mapped to VERSION_CONFLICT.
     */
    async appendMany(events, options) {
        var _a, _b, _c;
        if (events.length === 0)
            return [];
        const first = events[0];
        // expected < 0 only happens for "must be empty" callers; current_version of
        // an empty stream is 0, so clamp for the guard comparison.
        const expected = Math.max((_a = options === null || options === void 0 ? void 0 : options.expectedVersion) !== null && _a !== void 0 ? _a : first.aggregateVersion - 1, 0);
        const placeholders = [];
        const params = [first.tenant.orgId, first.tenant.venueId, first.aggregateType, first.aggregateId, expected];
        for (const e of events) {
            const base = params.length + 1;
            params.push(e.eventId, e.tenant.orgId, e.tenant.venueId, (_b = e.tenant.zoneId) !== null && _b !== void 0 ? _b : null, e.aggregateType, e.aggregateId, e.aggregateVersion, e.eventType, e.occurredAt, JSON.stringify((_c = e.actor) !== null && _c !== void 0 ? _c : null), JSON.stringify(e.payload), JSON.stringify(e.metadata));
            placeholders.push(`($${base},${base + 1},${base + 2},${base + 3},${base + 4},${base + 5},${base + 6},${base + 7},${base + 8},${base + 9},${base + 10},${base + 11})`);
        }
        const sql = `WITH guard AS (
  SELECT GREATEST(
    COALESCE((SELECT MAX(aggregate_version) FROM ros_events
              WHERE org_id = $1 AND venue_id = $2 AND aggregate_type = $3 AND aggregate_id = $4), 0),
    COALESCE((SELECT MAX(aggregate_version) FROM ros_events_archive
              WHERE org_id = $1 AND venue_id = $2 AND aggregate_type = $3 AND aggregate_id = $4), 0)
  ) AS current_version
),
ins AS (
  INSERT INTO ros_events
    (event_id, org_id, venue_id, zone_id, aggregate_type, aggregate_id, aggregate_version,
     event_type, occurred_at, actor, payload, metadata)
  SELECT v.* FROM (VALUES ${placeholders.join(", ")}) AS v(
    event_id, org_id, venue_id, zone_id, aggregate_type, aggregate_id, aggregate_version,
    event_type, occurred_at, actor, payload, metadata)
  WHERE (SELECT current_version FROM guard) = $5
  RETURNING global_position, aggregate_version
)
SELECT global_position, aggregate_version FROM ins`;
        let rows;
        try {
            rows = await this.db.unsafe(sql, params);
        }
        catch (err) {
            if (isUniqueViolation(err)) {
                throw (0, types_1.kernelError)("VERSION_CONFLICT", `Concurrent append conflict on ${first.aggregateType}/${first.aggregateId} expected v${expected}`);
            }
            throw err;
        }
        if (rows.length !== events.length) {
            throw (0, types_1.kernelError)("VERSION_CONFLICT", `Optimistic concurrency conflict on ${first.aggregateType}/${first.aggregateId} expected v${expected}`);
        }
        const positionByVersion = new Map();
        for (const r of rows)
            positionByVersion.set(Number(r.aggregate_version), Number(r.global_position));
        const stored = events.map((e) => {
            var _a;
            return (Object.assign(Object.assign({}, e), { globalPosition: (_a = positionByVersion.get(e.aggregateVersion)) !== null && _a !== void 0 ? _a : 0 }));
        });
        for (const s of stored) {
            for (const listener of this.listeners) {
                try {
                    listener(s);
                }
                catch (_d) {
                    // listener failures must not break the append
                }
            }
        }
        return stored;
    }
    async query(q) {
        var _a;
        const where = ["org_id = $1", "venue_id = $2"];
        const params = [q.tenant.orgId, q.tenant.venueId];
        let i = 3;
        if (q.aggregateType) {
            where.push(`aggregate_type = $${i++}`);
            params.push(q.aggregateType);
        }
        if (q.aggregateId) {
            where.push(`aggregate_id = $${i++}`);
            params.push(q.aggregateId);
        }
        if ((_a = q.eventTypes) === null || _a === void 0 ? void 0 : _a.length) {
            where.push(`event_type = ANY($${i++})`);
            params.push(q.eventTypes);
        }
        if (q.fromGlobalPosition !== undefined) {
            where.push(`global_position > $${i++}`);
            params.push(q.fromGlobalPosition);
        }
        const filter = where.join(" AND ");
        // Hot ∪ cold: archived events keep their positions and merge back transparently.
        let sql = `(SELECT ${EVENT_COLUMNS} FROM ros_events WHERE ${filter}
                UNION ALL
                SELECT ${EVENT_COLUMNS} FROM ros_events_archive WHERE ${filter})
               ORDER BY global_position ASC`;
        if (q.limit) {
            sql += ` LIMIT $${i++}`;
            params.push(q.limit);
        }
        const rows = await this.db.unsafe(sql, params);
        return rows.map(rowToEvent);
    }
    async readAggregate(tenant, aggregateType, aggregateId, fromVersion, limit) {
        const params = [tenant.orgId, tenant.venueId, aggregateType, aggregateId, fromVersion !== null && fromVersion !== void 0 ? fromVersion : 0];
        let sql = `(SELECT ${EVENT_COLUMNS} FROM ros_events
         WHERE org_id = $1 AND venue_id = $2 AND aggregate_type = $3 AND aggregate_id = $4
           AND aggregate_version > $5
        UNION ALL
        SELECT ${EVENT_COLUMNS} FROM ros_events_archive
         WHERE org_id = $1 AND venue_id = $2 AND aggregate_type = $3 AND aggregate_id = $4
           AND aggregate_version > $5)
       ORDER BY aggregate_version ASC`;
        if (limit) {
            sql += ` LIMIT $6`;
            params.push(limit);
        }
        const rows = await this.db.unsafe(sql, params);
        return rows.map(rowToEvent);
    }
    /** Atomic hot→cold move: DELETE + archive INSERT in one data-modifying CTE. */
    async compactAggregate(tenant, aggregateType, aggregateId, throughVersion) {
        const rows = await this.db.unsafe(`WITH moved AS (
         DELETE FROM ros_events
          WHERE org_id = $1 AND venue_id = $2 AND aggregate_type = $3 AND aggregate_id = $4
            AND aggregate_version <= $5
          RETURNING ${EVENT_COLUMNS}
       )
       INSERT INTO ros_events_archive (${EVENT_COLUMNS})
       SELECT ${EVENT_COLUMNS} FROM moved
       ON CONFLICT (global_position) DO NOTHING
       RETURNING ${EVENT_COLUMNS}`, [tenant.orgId, tenant.venueId, aggregateType, aggregateId, throughVersion]);
        return rows.map(rowToEvent);
    }
    async archivedEvents(q) {
        var _a;
        const where = ["org_id = $1", "venue_id = $2"];
        const params = [q.tenant.orgId, q.tenant.venueId];
        let i = 3;
        if (q.aggregateType) {
            where.push(`aggregate_type = $${i++}`);
            params.push(q.aggregateType);
        }
        if (q.aggregateId) {
            where.push(`aggregate_id = $${i++}`);
            params.push(q.aggregateId);
        }
        if ((_a = q.eventTypes) === null || _a === void 0 ? void 0 : _a.length) {
            where.push(`event_type = ANY($${i++})`);
            params.push(q.eventTypes);
        }
        if (q.fromGlobalPosition !== undefined) {
            where.push(`global_position > $${i++}`);
            params.push(q.fromGlobalPosition);
        }
        let sql = `SELECT ${EVENT_COLUMNS} FROM ros_events_archive WHERE ${where.join(" AND ")}
               ORDER BY global_position ASC`;
        if (q.limit) {
            sql += ` LIMIT $${i++}`;
            params.push(q.limit);
        }
        const rows = await this.db.unsafe(sql, params);
        return rows.map(rowToEvent);
    }
    async saveSnapshot(snapshot) {
        var _a;
        await this.db.unsafe(`INSERT INTO ros_snapshots
         (org_id, venue_id, aggregate_type, aggregate_id, version, snapshot_schema_version, state, taken_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (org_id, venue_id, aggregate_type, aggregate_id)
       DO UPDATE SET version = EXCLUDED.version, snapshot_schema_version = EXCLUDED.snapshot_schema_version,
                     state = EXCLUDED.state, taken_at = EXCLUDED.taken_at`, [
            snapshot.tenant.orgId,
            snapshot.tenant.venueId,
            snapshot.aggregateType,
            snapshot.aggregateId,
            snapshot.version,
            (_a = snapshot.snapshotSchemaVersion) !== null && _a !== void 0 ? _a : 1,
            JSON.stringify(snapshot.state),
            snapshot.takenAt,
        ]);
    }
    async loadSnapshot(tenant, aggregateType, aggregateId) {
        var _a;
        const rows = await this.db.unsafe(`SELECT * FROM ros_snapshots
       WHERE org_id = $1 AND venue_id = $2 AND aggregate_type = $3 AND aggregate_id = $4`, [tenant.orgId, tenant.venueId, aggregateType, aggregateId]);
        if (rows.length === 0)
            return null;
        const row = rows[0];
        return {
            aggregateType,
            aggregateId,
            tenant,
            version: Number(row.version),
            snapshotSchemaVersion: Number((_a = row.snapshot_schema_version) !== null && _a !== void 0 ? _a : 1),
            state: row.state,
            takenAt: String(row.taken_at),
        };
    }
    subscribe(listener) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }
}
exports.PostgresEventStore = PostgresEventStore;
function isUniqueViolation(err) {
    var _a, _b;
    if (!err || typeof err !== "object")
        return false;
    const e = err;
    const code = ((_a = e.code) !== null && _a !== void 0 ? _a : (_b = e.sourceError) === null || _b === void 0 ? void 0 : _b.code);
    return code === "23505";
}
