import { AttributeBag, Id, StoredEvent, TenantContext } from "@/kernel/types"
import { EventStore } from "@/kernel/event-store/event-store"
import { Projection, defineProjection } from "./projection"

/**
 * The orders read model.
 *
 * The kernel had eight projections but none for the *central* entity. Orders
 * existed only as `kitchen.queue` rows, and only once their lines had been
 * fired — so the Orders screen, order detail, checkout and every dashboard KPI
 * were impossible to build on the event store, because they all needed ticket
 * state they did not care about.
 *
 * This board is deliberately kitchen-free. It carries what the floor, the till
 * and the manager need, and precomputes every figure the checkout screen would
 * otherwise have to re-derive.
 */

export interface OrderBoardLine {
  lineId: Id
  menuItemId: Id
  name: string
  quantity: number
  unitPrice: number
  /** Priced once with modifiers folded in, so the cart never re-derives it. */
  lineTotal: number
  /** Human-readable modifier names — the kitchen and the receipt both want these. */
  modifiers: string[]
  course: number
  status: "open" | "sent" | "preparing" | "ready" | "served" | "voided"
  /** Comped: still on the check, but worth nothing. Distinct from `voided`. */
  comped?: boolean
}

export interface OrderBoardRow {
  orderId: Id
  status: "draft" | "open" | "closed" | "voided"
  channel: string
  tableId: Id | null
  serverId: Id | null
  dinerName: string | null
  customerId: Id | null
  /** Free-text ticket notes; null until `order.setNotes` runs. */
  notes: string | null
  lines: OrderBoardLine[]
  discountTotal: number
  taxTotal: number
  taxRate: number | null
  /** Tips are extra, not part of what the guest owes. */
  tipTotal: number
  /** Ways the check is split, or 1 when it is not split. */
  ways: number
  subtotal: number
  total: number
  paid: number
  balanceDue: number
  openedAt: string
  updatedAt: string
  /** Stamped on close so reports need no replay. */
  closedAt: string | null
  /** Courses the kitchen has parked (held). Shared read model, not terminal state. */
  heldCourses: number[]
}

export interface OrderBoardState extends AttributeBag {
  rows: OrderBoardRow[]
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function lineTotal(line: {
  unitPrice: number
  quantity: number
  modifiers?: Array<{ price: number }>
}): number {
  const extras = (line.modifiers ?? []).reduce((s, m) => s + m.price, 0)
  return round2((line.unitPrice + extras) * line.quantity)
}

function recompute(row: OrderBoardRow): OrderBoardRow {
  const subtotal = round2(
    row.lines.filter((l) => l.status !== "voided" && !l.comped).reduce((s, l) => s + l.lineTotal, 0),
  )
  const total = round2(Math.max(0, subtotal - row.discountTotal + row.taxTotal))
  const paid = round2(row.paid)
  return { ...row, subtotal, total, paid, balanceDue: round2(Math.max(0, total - paid)) }
}

const WATCHED = [
  "order.created",
  "order.lineAdded",
  "order.lineVoided",
  "order.sentToKitchen",
  "kitchen.lineBegan",
  "kitchen.lineReady",
  "kitchen.lineServed",
  "order.discountApplied",
  "order.taxApplied",
  "order.tipAdded",
  "order.comped",
  "order.lineComped",
  "order.splitCreated",
  "order.linesTransferredIn",
  "order.linesTransferredOut",
  "order.paymentRecorded",
  "order.closed",
  "order.voided",
  "order.notesSet",
  "order.courseHeld",
  "order.courseReleased",
]
export function orderBoardProjection(
  store: EventStore,
  tenant: TenantContext,
): Projection<OrderBoardState> {
  return defineProjection<OrderBoardState>(
    {
      name: "orders.board",
      initial: { rows: [] },
      watchedEventTypes: WATCHED,
      reduce: (state: OrderBoardState, event: StoredEvent): OrderBoardState => {
        const rows = [...state.rows];
        let idx = rows.findIndex((r) => r.orderId === event.aggregateId);
        const p = event.payload as Record<string, any>;
        const at = event.occurredAt;

        if (idx < 0) {
          // Only order.created may open a row; any other event type would be
          // acting on an order this board has never seen.
          if (event.eventType !== "order.created") return state;
          idx = rows.length;
          rows.push({
            orderId: event.aggregateId,
            // `order.created` is stamped with the pre-raise state, which is
            // "draft"; the aggregate flips to "open" on the first line.
            status: (p.status as OrderBoardRow["status"]) ?? "draft",
            channel: String(p.channel ?? "pos"),
            tableId: p.tableId ?? null,
            serverId: p.serverId ?? null,
            dinerName: p.dinerName ?? null,
            customerId: p.customerId ?? null,
            notes: null,
            lines: [],
            discountTotal: 0,
            taxTotal: 0,
            taxRate: null,
            tipTotal: 0,
            ways: 1,
            subtotal: 0,
            total: 0,
            paid: 0,
            balanceDue: 0,
            openedAt: at,
            updatedAt: at,
            closedAt: null,
            heldCourses: [],
          });
        }

        const row = { ...rows[idx] };
        const setLine = (lineId: Id, status: OrderBoardLine["status"]) => {
          row.lines = row.lines.map((l) => (l.lineId === lineId ? { ...l, status } : l));
        };

        switch (event.eventType) {
          case "order.created":
            row.channel = String(p.channel ?? row.channel);
            row.tableId = p.tableId ?? row.tableId;
            row.serverId = p.serverId ?? row.serverId;
            row.dinerName = p.dinerName ?? row.dinerName;
            row.customerId = p.customerId ?? row.customerId;
            break;

          case "order.lineAdded": {
            // The stored line carries priced modifier objects; the board keeps
            // only their labels, which is why its own `modifiers` is
            // `string[]` and cannot be intersected with the payload shape.
            const line = p.line as {
              lineId: Id
              menuItemId: Id
              name: string
              quantity: number
              unitPrice: number
              course?: number
              modifiers?: Array<{ name: string; price: number }>
            };
            row.lines = [
              ...row.lines,
              {
                lineId: line.lineId,
                menuItemId: line.menuItemId,
                name: line.name,
                quantity: line.quantity,
                unitPrice: line.unitPrice,
                lineTotal: lineTotal(line),
                modifiers: (line.modifiers ?? []).map((m) => m.name).filter(Boolean),
                course: line.course ?? 1,
                status: "open",
              },
            ];
            // Adding a line to a draft implicitly opens the ticket.
            if (row.status === "draft") row.status = "open";
            break;
          }

          case "order.lineVoided":
            // A voided line is retained at zero value rather than dropped, so a
            // manager can still see what came off a check.
            setLine(p.lineId as Id, "voided");
            break;

          case "order.sentToKitchen": {
            const ids = new Set((p.lineIds ?? []) as Id[]);
            row.lines = row.lines.map((l) =>
              ids.has(l.lineId) ? { ...l, status: "sent" as const } : l,
            );
            break;
          }

          case "kitchen.lineBegan": setLine(p.lineId as Id, "preparing"); break;
          case "kitchen.lineReady": setLine(p.lineId as Id, "ready"); break;
          case "kitchen.lineServed": setLine(p.lineId as Id, "served"); break;

          case "order.discountApplied":
            row.discountTotal = Number(p.discountTotal ?? row.discountTotal);
            break;
          case "order.taxApplied":
            row.taxTotal = Number(p.taxTotal ?? row.taxTotal);
            row.taxRate = p.taxRate == null ? null : Number(p.taxRate);
            break;
          case "order.tipAdded":
            row.tipTotal = round2(row.tipTotal + Number(p.tip?.amount ?? 0));
            break;
          case "order.lineComped":
            // A comped line stays visible but stops counting toward the check.
            row.lines = row.lines.map((l) => (l.lineId === p.lineId ? { ...l, comped: true } : l));
            break;
          case "order.comped":
            row.lines = row.lines.map((l) => ({ ...l, comped: true }));
            break;
          case "order.splitCreated":
            row.ways = Number(p.split?.ways ?? row.ways);
            break;
          case "order.linesTransferredOut": {
            // The source must stop charging for what left, or the two checks
            // double-count the same food. Kept listed as `voided` for audit.
            const moved = new Set(((p.lines ?? []) as OrderBoardLine[]).map((l) => l.lineId))
            row.lines = row.lines.map((l) =>
              moved.has(l.lineId) ? { ...l, status: "voided" as const } : l,
            )
            break
          }
          case "order.linesTransferredIn": {
            // Incoming lines come straight off the aggregate, so they carry no
            // projection-computed fields (notably `lineTotal`). Normalise them
            // here or the destination's money totals become NaN.
            const incoming = ((p.lines ?? []) as Array<{
              lineId: Id
              menuItemId: Id
              name: string
              quantity: number
              unitPrice: number
              course?: number
              modifiers?: Array<{ name: string; price: number }>
            }>).map((l) => ({
              lineId: l.lineId,
              menuItemId: l.menuItemId,
              name: l.name,
              quantity: l.quantity,
              unitPrice: l.unitPrice,
              lineTotal: lineTotal(l),
              modifiers: (l.modifiers ?? []).map((m) => m.name).filter(Boolean),
              course: l.course ?? 1,
              status: "open" as const,
            }))
            row.lines = [...row.lines, ...incoming]
            // Receiving lines opens a draft, matching the aggregate.
            if (row.status === "draft") row.status = "open"
            break
          }
          case "order.paymentRecorded": {
            const payment = p.payment as { amount?: number };
            row.paid = round2(row.paid + Number(payment?.amount ?? 0));
            break;
          }

          case "order.closed":
          case "order.voided":
            row.status = event.eventType === "order.closed" ? "closed" : "voided";
            row.closedAt = at;
            break;
          case "order.notesSet":
            row.notes = String(p.notes ?? "");
            break;
          case "order.courseHeld":
            row.heldCourses = [...new Set([...row.heldCourses, Number(p.course)])];
            break;
          case "order.courseReleased":
            row.heldCourses = row.heldCourses.filter((c) => c !== Number(p.course));
            break;
        }

        row.updatedAt = at;
        rows[idx] = recompute(row);
        return { rows: evictOrdersBoard(rows) };
      },
    },
    store,
    tenant,
  );
}

const ORDERS_BOARD_MAX_ROWS = 2000;

/** Keep only the last 2000 rows, dropping oldest closed/voided first. */
function evictOrdersBoard(rows: OrderBoardRow[]): OrderBoardRow[] {
  if (rows.length <= ORDERS_BOARD_MAX_ROWS) return rows;
  const overflow = rows.length - ORDERS_BOARD_MAX_ROWS;
  const closedIdx: number[] = [];
  const openIdx: number[] = [];
  rows.forEach((r, i) => {
    if (r.status === "closed" || r.status === "voided") closedIdx.push(i);
    else openIdx.push(i);
  });
  // Oldest first by closedAt/updatedAt.
  const byAge = (a: number, b: number) => {
    const ta = rows[a].closedAt ?? rows[a].updatedAt;
    const tb = rows[b].closedAt ?? rows[b].updatedAt;
    return ta < tb ? -1 : ta > tb ? 1 : a - b;
  };
  closedIdx.sort(byAge);
  openIdx.sort(byAge);
  const drop = new Set<number>();
  for (const i of closedIdx) {
    if (drop.size >= overflow) break;
    drop.add(i);
  }
  for (const i of openIdx) {
    if (drop.size >= overflow) break;
    drop.add(i);
  }
  return rows.filter((_, i) => !drop.has(i));
}

export function listOrdersBoard(
  state: OrderBoardState,
  opts: { cursor?: number; limit?: number } = {},
): OrderBoardRow[] {
  const limit = opts.limit != null ? Math.min(Math.max(Math.floor(opts.limit) || 50, 1), 500) : 50;
  const cursor = opts.cursor != null ? Math.max(Math.floor(opts.cursor) || 0, 0) : 0;
  return state.rows.slice(cursor, cursor + limit);
}
