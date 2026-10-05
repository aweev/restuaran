import { randomUUID } from "crypto"
import { AttributeBag, TenantContext } from "@/kernel/types"

export type OutboundStatus = "pending" | "delivered" | "dead"

export interface OutboundMessage {
  /** Delivery id — echoed back in X-ROS-Delivery so receivers can dedupe. */
  id: string
  channel: string
  /** Webhook URL or connector id. */
  target: string
  eventType: string
  tenant: TenantContext
  eventId: string
  position: number
  body: AttributeBag
  headers: Record<string, string>
  attempts: number
  maxAttempts: number
  status: OutboundStatus
  /** Epoch ms before which the message must not be retried. */
  nextAttemptAt: number
  createdAt: number
  updatedAt: number
  deliveredAt?: number
  lastError?: string
}

export interface EnqueueInput {
  channel: string
  target: string
  eventType: string
  tenant: TenantContext
  eventId: string
  position: number
  body: AttributeBag
  headers?: Record<string, string>
  maxAttempts?: number
}

/** Transport seam: HTTP POST in production, recording/logging in tests & dev. */
export interface OutboundTransport {
  deliver(message: OutboundMessage): Promise<void>
}

export interface RetryPolicy {
  maxAttempts: number
  baseDelayMs: number
  factor: number
  maxDelayMs: number
}

export const defaultRetryPolicy: RetryPolicy = {
  maxAttempts: 5,
  baseDelayMs: 1000,
  factor: 2,
  maxDelayMs: 60000,
}

export interface ProcessReport {
  attempted: number
  delivered: number
  retried: number
  dead: number
}

/**
 * Infrastructure events (subscription management, delivery bookkeeping) are
 * never forwarded to external subscribers — this is what keeps webhook
 * endpoints from reacting to their own churn.
 */
export function isInfraEvent(eventType: string): boolean {
  return eventType.startsWith("webhook.") || eventType.startsWith("outbound.")
}

export interface OutboundQueueOptions {
  transport: OutboundTransport
  retry?: Partial<RetryPolicy>
  now?: () => number
}

/**
 * The Phase 3 delivery engine shared by webhooks and connectors:
 *
 *   pending ──attempt ok──▶ delivered
 *      │
 *      └──attempt fails──▶ exponential backoff ──(maxAttempts exhausted)──▶ dead (DLQ)
 *
 * Dead messages can be requeued with replay() for operator-driven retries.
 * The queue is process-local by design (Phase 3): domain state stays in the
 * event store, delivery state is operational and rebuilt per process.
 */
export class OutboundQueue {
  private messages = new Map<string, OutboundMessage>()
  private retry: RetryPolicy
  private nowFn: () => number
  private processing = false

  constructor(private opts: OutboundQueueOptions) {
    this.retry = { ...defaultRetryPolicy, ...opts.retry }
    this.nowFn = opts.now ?? Date.now
  }

  enqueue(input: EnqueueInput): OutboundMessage {
    const now = this.nowFn()
    const message: OutboundMessage = {
      id: randomUUID(),
      channel: input.channel,
      target: input.target,
      eventType: input.eventType,
      tenant: input.tenant,
      eventId: input.eventId,
      position: input.position,
      body: input.body,
      headers: { ...input.headers },
      attempts: 0,
      maxAttempts: input.maxAttempts ?? this.retry.maxAttempts,
      status: "pending",
      nextAttemptAt: now,
      createdAt: now,
      updatedAt: now,
    }
    this.messages.set(message.id, message)
    return message
  }

  get(deliveryId: string): OutboundMessage | null {
    return this.messages.get(deliveryId) ?? null
  }

  list(status?: OutboundStatus): OutboundMessage[] {
    return [...this.messages.values()]
      .filter((m) => !status || m.status === status)
      .sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id))
  }

  stats(): { pending: number; delivered: number; dead: number; total: number } {
    let pending = 0
    let delivered = 0
    let dead = 0
    for (const m of this.messages.values()) {
      if (m.status === "pending") pending++
      else if (m.status === "delivered") delivered++
      else dead++
    }
    return { pending, delivered, dead, total: this.messages.size }
  }

  /** Exponential backoff for the n-th failed attempt: base * factor^(n-1), capped. */
  backoffFor(attempts: number): number {
    return Math.min(
      this.retry.maxDelayMs,
      this.retry.baseDelayMs * Math.pow(this.retry.factor, Math.max(0, attempts - 1))
    )
  }

  /**
   * Deliver every pending message that is due at `now`. Retries back off
   * exponentially; once maxAttempts is exhausted the message lands in the DLQ
   * (status "dead"). Re-entrant calls are no-ops so a fanout-triggered drain
   * never races the interval sweeper.
   */
  async process(now = this.nowFn()): Promise<ProcessReport> {
    const report: ProcessReport = { attempted: 0, delivered: 0, retried: 0, dead: 0 }
    if (this.processing) return report
    this.processing = true
    try {
      const due = this.list("pending").filter((m) => m.nextAttemptAt <= now)
      for (const message of due) {
        report.attempted++
        message.attempts++
        try {
          await this.opts.transport.deliver(message)
          message.status = "delivered"
          message.deliveredAt = now
          delete message.lastError
          report.delivered++
        } catch (err) {
          message.lastError = err instanceof Error ? err.message : String(err)
          if (message.attempts >= message.maxAttempts) {
            message.status = "dead"
            report.dead++
          } else {
            message.nextAttemptAt = now + this.backoffFor(message.attempts)
            report.retried++
          }
        }
        message.updatedAt = now
      }
    } finally {
      this.processing = false
    }
    return report
  }

  /** Move a dead message back to pending with a fresh attempt budget. */
  replay(deliveryId: string): OutboundMessage | null {
    const message = this.messages.get(deliveryId)
    if (!message || message.status !== "dead") return null
    const now = this.nowFn()
    message.status = "pending"
    message.attempts = 0
    message.nextAttemptAt = now
    message.updatedAt = now
    return message
  }
}

/** Transport that records deliveries in-process — tests, offline mode, embedded deployments. */
export class RecordingOutboundTransport implements OutboundTransport {
  readonly delivered: OutboundMessage[] = []
  failAlways = false
  failNext = 0

  async deliver(message: OutboundMessage): Promise<void> {
    if (this.failAlways || this.failNext > 0) {
      if (this.failNext > 0) this.failNext--
      throw new Error("recording transport: forced failure")
    }
    this.delivered.push(message)
  }

  sentTo(target: string): OutboundMessage[] {
    return this.delivered.filter((m) => m.target === target)
  }
}

/**
 * Default connector transport: acknowledges and logs. Used until a real
 * accounting/delivery provider endpoint is configured, so queues always drain.
 */
export class LoggingOutboundTransport implements OutboundTransport {
  async deliver(message: OutboundMessage): Promise<void> {
    console.info(`[kernel:outbound] ${message.channel} -> ${message.target} (${message.eventType})`)
  }
}
