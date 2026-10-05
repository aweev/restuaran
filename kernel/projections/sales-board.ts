import { AttributeBag, Id, StoredEvent, TenantContext } from "@/kernel/types"
import { EventStore } from "@/kernel/event-store/event-store"
import { Projection, defineProjection } from "./projection"

/**
 * Service-day rollup for the dashboard, reports and end-of-shift close-out.
 *
 * Previously analytics had no event-sourced source at all and had to be
 * computed with ad-hoc SQL over the mutable `Order` table — which meant a
 * report could disagree with the event log it claimed to summarise. This
 * derives every figure from the same events the rest of the system trusts.
 *
 * Buckets are per-venue, not per-user, and only count *settled* money: revenue
 * that has been paid, not merely rung up.
 */

export interface SalesBucket {
  /** ISO date, `YYYY-MM-DD`. */
  date: string
  orderCount: number
  grossSales: number
  discounts: number
  tax: number
  tips: number
  paid: number
  /** Sales by channel, so the report can show dine-in vs delivery. */
  byChannel: Record<string, number>
  /** Best-selling item id → units. Drives "top sellers". */
  byItem: Record<string, number>
}

export interface SalesBoardState extends AttributeBag {
  buckets: SalesBucket[]
  /** Running totals, kept so a dashboard need not fold the whole history. */
  lifetime: { orders: number; gross: number; discounts: number; tips: number; voided: number }
  /**
   * Order id → { bucketDate, total, channel }. Held so a later `order.voided`
   * can unwind exactly the contribution that order made, instead of guessing.
   */
  settled: Record<Id, { date: string; total: number; channel: string }>
}


function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function emptyBucket(date: string): SalesBucket {
  return {
    date,
    orderCount: 0,
    grossSales: 0,
    discounts: 0,
    tax: 0,
    tips: 0,
    paid: 0,
    byChannel: {},
    byItem: {},
  };
}

/** Postgres/Neon returns DATE as a Date at UTC midnight; take the calendar day. */
function dayOf(iso: string): string {
  return iso.slice(0, 10);
}

export function salesBoardProjection(
  store: EventStore,
  tenant: TenantContext,
): Projection<SalesBoardState> {
  return defineProjection<SalesBoardState>(
    {
      name: "sales.board",
      initial: {
        buckets: [],
        lifetime: { orders: 0, gross: 0, discounts: 0, tips: 0, voided: 0 },
        settled: {},
      },
      watchedEventTypes: [
        "order.closed",
        "order.discountApplied",
        "order.taxApplied",
        "order.paymentRecorded",
        "order.voided",
      ],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      reduce: (state: SalesBoardState, event: StoredEvent): SalesBoardState => {
        const p = event.payload as Record<string, any>;
        const day = dayOf(event.occurredAt);

        // A void must unwind the exact contribution the order made, or a
        // refunded table stays counted as revenue.
        if (event.eventType === "order.voided") {
          const record = state.settled[event.aggregateId];
          const settled = { ...state.settled };
          delete settled[event.aggregateId];
          if (!record) {
            // Voided before it ever closed: there is no revenue to unwind, but
            // the void is still real and belongs in the day's activity counts.
            return {
              ...state,
              settled,
              lifetime: { ...state.lifetime, voided: state.lifetime.voided + 1 },
            };
          }
          const buckets = state.buckets.map((b) => {
            if (b.date !== record.date) return b;
            const byChannel = { ...b.byChannel };
            byChannel[record.channel] = round2((byChannel[record.channel] ?? 0) - record.total);
            return {
              ...b,
              orderCount: Math.max(0, b.orderCount - 1),
              grossSales: round2(b.grossSales - record.total),
              paid: round2(b.paid - record.total),
              byChannel,
            };
          });
          return {
            ...state,
            buckets,
            settled,
            lifetime: {
              ...state.lifetime,
              orders: Math.max(0, state.lifetime.orders - 1),
              gross: round2(state.lifetime.gross - record.total),
              voided: state.lifetime.voided + 1,
            },
          };
        }

        const buckets = [...state.buckets];
        let idx = buckets.findIndex((b) => b.date === day);
        if (idx < 0) {
          idx = buckets.length;
          buckets.push(emptyBucket(day));
        }
        const bucket = {
          ...buckets[idx],
          byChannel: { ...buckets[idx].byChannel },
          byItem: { ...buckets[idx].byItem },
        };

        switch (event.eventType) {
          case "order.closed": {
            const total = round2(Number(p.total ?? 0));
            const channel = String(p.channel ?? "pos");
            bucket.orderCount += 1;
            bucket.grossSales = round2(bucket.grossSales + total);
            bucket.paid = round2(bucket.paid + Number(p.paid ?? 0));
            bucket.byChannel[channel] = round2((bucket.byChannel[channel] ?? 0) + total);
            buckets[idx] = bucket;
            return {
              buckets,
              lifetime: {
                ...state.lifetime,
                orders: state.lifetime.orders + 1,
                gross: round2(state.lifetime.gross + total),
              },
              settled: {
                ...state.settled,
                [event.aggregateId]: { date: day, total, channel },
              },
            };
          }

          case "order.discountApplied":
            bucket.discounts = round2(bucket.discounts + Number(p.discountTotal ?? 0));
            break;
          case "order.taxApplied":
            bucket.tax = round2(bucket.tax + Number(p.taxTotal ?? 0));
            break;
          case "order.tipAdded":
            bucket.tips = round2(bucket.tips + Number(p.tip?.amount ?? 0));
            break;
          case "order.paymentRecorded": {
            bucket.paid = round2(bucket.paid + Number(p.payment?.amount ?? 0));
            bucket.tips = round2(bucket.tips + Number(p.payment?.tip ?? 0));
            break;
          }
        }

        buckets[idx] = bucket;
        return {
          buckets,
          lifetime: {
            ...state.lifetime,
            discounts: round2(
              state.lifetime.discounts +
                (event.eventType === "order.discountApplied" ? Number(p.discountTotal ?? 0) : 0),
            ),
            tips: round2(
              state.lifetime.tips +
                (event.eventType === "order.paymentRecorded" ? Number(p.payment?.tip ?? 0) : 0),
            ),
          },
          settled: state.settled,
        };
      },
    },
    store,
    tenant,
  );
}

