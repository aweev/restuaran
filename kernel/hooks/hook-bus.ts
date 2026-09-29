import { AttributeBag } from "@/kernel/types"

export interface HookPayloadMap extends Record<string, AttributeBag> {
  "command:before": { command: unknown }
  "command:after": { command: unknown; result: unknown }
  "command:failed": { command: unknown; result: unknown }
  "event:projected": { eventName: string; data: unknown }
  "event:published": { event: unknown }
}

type HookName = keyof HookPayloadMap
type Listener<K extends HookName> = (payload: HookPayloadMap[K]) => void | Promise<void>

export class HookBus {
  private listeners = new Map<HookName, Set<Listener<HookName>>>()

  on<K extends HookName>(hook: K, listener: Listener<K>): () => void {
    const set = this.listeners.get(hook) ?? new Set()
    set.add(listener as Listener<HookName>)
    this.listeners.set(hook, set)
    return () => set.delete(listener as Listener<HookName>)
  }

  async emit<K extends HookName>(hook: K, payload: HookPayloadMap[K]): Promise<void> {
    const set = this.listeners.get(hook)
    if (!set) return
    for (const listener of set) {
      try {
        await listener(payload)
      } catch (err) {
        // A misbehaving hook must never break the kernel write path.
        console.error(`[kernel:hooks] listener for "${hook}" failed:`, err)
      }
    }
  }

  clear(): void {
    this.listeners.clear()
  }
}