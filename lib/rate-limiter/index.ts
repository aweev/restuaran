import { Redis } from "@upstash/redis"

const redis = process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    })
  : null

const LOCAL_STORE = new Map<string, { count: number; resetAt: number }>()

interface RateLimitConfig {
  maxAttempts: number
  windowMs: number
  keyPrefix?: string
}

interface RateLimitResult {
  blocked: boolean
  retryInMinutes: number
  remaining: number
}

export async function rateLimit(
  key: string,
  config: RateLimitConfig = { maxAttempts: 8, windowMs: 15 * 60 * 1000 }
): Promise<RateLimitResult> {
  const prefix = config.keyPrefix ?? "ratelimit:"
  const fullKey = `${prefix}${key}`

  if (redis) {
    const windowSec = Math.ceil(config.windowMs / 1000)

    const count = await redis.incr(fullKey)
    if (count === 1) {
      await redis.expire(fullKey, windowSec)
    }

    const ttl = await redis.ttl(fullKey)
    const retryInMinutes = ttl > 0 ? Math.ceil(ttl / 60) : 0

    if (count > config.maxAttempts) {
      return { blocked: true, retryInMinutes, remaining: 0 }
    }

    return { blocked: false, retryInMinutes: 0, remaining: config.maxAttempts - count }
  }

  const now = Date.now()
  const entry = LOCAL_STORE.get(fullKey)
  if (!entry || entry.resetAt < now) {
    LOCAL_STORE.set(fullKey, { count: 1, resetAt: now + config.windowMs })
    return { blocked: false, retryInMinutes: 0, remaining: config.maxAttempts - 1 }
  }
  entry.count += 1
  const retryInMinutes = entry.resetAt > now ? Math.ceil((entry.resetAt - now) / 60000) : 0
  if (entry.count > config.maxAttempts) {
    return { blocked: true, retryInMinutes, remaining: 0 }
  }
  return { blocked: false, retryInMinutes, remaining: config.maxAttempts - entry.count }
}

export async function clearRateLimit(key: string, keyPrefix = "ratelimit:"): Promise<void> {
  const fullKey = `${keyPrefix}${key}`
  if (redis) {
    await redis.del(fullKey)
  } else {
    LOCAL_STORE.delete(fullKey)
  }
}

export function getClientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for")
  if (fwd) return fwd.split(",")[0]!.trim()
  return req.headers.get("x-real-ip") ?? "unknown"
}