"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LoggingOutboundTransport = exports.RecordingOutboundTransport = exports.OutboundQueue = exports.defaultRetryPolicy = void 0;
exports.isInfraEvent = isInfraEvent;
const crypto_1 = require("crypto");
exports.defaultRetryPolicy = {
    maxAttempts: 5,
    baseDelayMs: 1000,
    factor: 2,
    maxDelayMs: 60000,
};
/**
 * Infrastructure events (subscription management, delivery bookkeeping) are
 * never forwarded to external subscribers — this is what keeps webhook
 * endpoints from reacting to their own churn.
 */
function isInfraEvent(eventType) {
    return eventType.startsWith("webhook.") || eventType.startsWith("outbound.");
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
class OutboundQueue {
    constructor(opts) {
        var _a;
        this.opts = opts;
        this.messages = new Map();
        this.processing = false;
        this.retry = Object.assign(Object.assign({}, exports.defaultRetryPolicy), opts.retry);
        this.nowFn = (_a = opts.now) !== null && _a !== void 0 ? _a : Date.now;
    }
    enqueue(input) {
        var _a;
        const now = this.nowFn();
        const message = {
            id: (0, crypto_1.randomUUID)(),
            channel: input.channel,
            target: input.target,
            eventType: input.eventType,
            tenant: input.tenant,
            eventId: input.eventId,
            position: input.position,
            body: input.body,
            headers: Object.assign({}, input.headers),
            attempts: 0,
            maxAttempts: (_a = input.maxAttempts) !== null && _a !== void 0 ? _a : this.retry.maxAttempts,
            status: "pending",
            nextAttemptAt: now,
            createdAt: now,
            updatedAt: now,
        };
        this.messages.set(message.id, message);
        return message;
    }
    get(deliveryId) {
        var _a;
        return (_a = this.messages.get(deliveryId)) !== null && _a !== void 0 ? _a : null;
    }
    list(status) {
        return [...this.messages.values()]
            .filter((m) => !status || m.status === status)
            .sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id));
    }
    stats() {
        let pending = 0;
        let delivered = 0;
        let dead = 0;
        for (const m of this.messages.values()) {
            if (m.status === "pending")
                pending++;
            else if (m.status === "delivered")
                delivered++;
            else
                dead++;
        }
        return { pending, delivered, dead, total: this.messages.size };
    }
    /** Exponential backoff for the n-th failed attempt: base * factor^(n-1), capped. */
    backoffFor(attempts) {
        return Math.min(this.retry.maxDelayMs, this.retry.baseDelayMs * Math.pow(this.retry.factor, Math.max(0, attempts - 1)));
    }
    /**
     * Deliver every pending message that is due at `now`. Retries back off
     * exponentially; once maxAttempts is exhausted the message lands in the DLQ
     * (status "dead"). Re-entrant calls are no-ops so a fanout-triggered drain
     * never races the interval sweeper.
     */
    async process(now = this.nowFn()) {
        const report = { attempted: 0, delivered: 0, retried: 0, dead: 0 };
        if (this.processing)
            return report;
        this.processing = true;
        try {
            const due = this.list("pending").filter((m) => m.nextAttemptAt <= now);
            for (const message of due) {
                report.attempted++;
                message.attempts++;
                try {
                    await this.opts.transport.deliver(message);
                    message.status = "delivered";
                    message.deliveredAt = now;
                    delete message.lastError;
                    report.delivered++;
                }
                catch (err) {
                    message.lastError = err instanceof Error ? err.message : String(err);
                    if (message.attempts >= message.maxAttempts) {
                        message.status = "dead";
                        report.dead++;
                    }
                    else {
                        message.nextAttemptAt = now + this.backoffFor(message.attempts);
                        report.retried++;
                    }
                }
                message.updatedAt = now;
            }
        }
        finally {
            this.processing = false;
        }
        return report;
    }
    /** Move a dead message back to pending with a fresh attempt budget. */
    replay(deliveryId) {
        const message = this.messages.get(deliveryId);
        if (!message || message.status !== "dead")
            return null;
        const now = this.nowFn();
        message.status = "pending";
        message.attempts = 0;
        message.nextAttemptAt = now;
        message.updatedAt = now;
        return message;
    }
}
exports.OutboundQueue = OutboundQueue;
/** Transport that records deliveries in-process — tests, offline mode, embedded deployments. */
class RecordingOutboundTransport {
    constructor() {
        this.delivered = [];
        this.failAlways = false;
        this.failNext = 0;
    }
    async deliver(message) {
        if (this.failAlways || this.failNext > 0) {
            if (this.failNext > 0)
                this.failNext--;
            throw new Error("recording transport: forced failure");
        }
        this.delivered.push(message);
    }
    sentTo(target) {
        return this.delivered.filter((m) => m.target === target);
    }
}
exports.RecordingOutboundTransport = RecordingOutboundTransport;
/**
 * Default connector transport: acknowledges and logs. Used until a real
 * accounting/delivery provider endpoint is configured, so queues always drain.
 */
class LoggingOutboundTransport {
    async deliver(message) {
        console.info(`[kernel:outbound] ${message.channel} -> ${message.target} (${message.eventType})`);
    }
}
exports.LoggingOutboundTransport = LoggingOutboundTransport;
