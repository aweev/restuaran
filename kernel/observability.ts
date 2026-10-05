import { randomUUID } from "crypto"

export type KLogLevel = "debug" | "info" | "warn" | "error"

export function traceId(): string {
  return randomUUID()
}

export function klog(level: KLogLevel, msg: string, fields: Record<string, unknown> = {}): void {
  const line = JSON.stringify({ ts: new Date().toISOString(), level, msg, ...fields })
  if (level === "error") console.error(line)
  else if (level === "warn") console.warn(line)
  else console.info(line)
}

export class Metrics {
  private counters = new Map<string, number>()
  private latencies = new Map<string, number[]>()
  private timings = new Map<string, number>()

  increment(name: string, by = 1): void {
    this.counters.set(name, (this.counters.get(name) ?? 0) + by)
  }

  startTimer(name: string): () => number {
    const start = Date.now()
    this.timings.set(name, start)
    return () => this.endTimer(name, start)
  }

  endTimer(name: string, start?: number): number {
    const s = start ?? this.timings.get(name) ?? Date.now()
    const ms = Date.now() - s
    const arr = this.latencies.get(name) ?? []
    arr.push(ms)
    this.latencies.set(name, arr)
    return ms
  }

  recordLatency(name: string, ms: number): void {
    const arr = this.latencies.get(name) ?? []
    arr.push(ms)
    this.latencies.set(name, arr)
  }

  snapshot(): { counters: Record<string, number>; latency: Record<string, { count: number; p50: number; p95: number; avg: number }> } {
    const latency: Record<string, { count: number; p50: number; p95: number; avg: number }> = {}
    for (const [k, arr] of this.latencies) {
      const sorted = [...arr].sort((a, b) => a - b)
      const avg = sorted.length ? sorted.reduce((s, v) => s + v, 0) / sorted.length : 0
      latency[k] = {
        count: sorted.length,
        p50: sorted.length ? sorted[Math.floor(sorted.length * 0.5)] : 0,
        p95: sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))] : 0,
        avg,
      }
    }
    return { counters: Object.fromEntries(this.counters), latency }
  }
}

export const kernelMetrics = new Metrics()
