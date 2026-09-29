export type Id = string
export type ISODate = string
export type AttributeBag = Record<string, unknown>

export interface TenantContext {
  orgId: Id
  venueId: Id
  zoneId?: Id
}

export interface ActorContext {
  userId: Id
  roles: string[]
  permissions: string[]
  device?: {
    id: Id
    type: "pos" | "kds" | "handheld" | "kiosk" | "web"
  }
}

export interface DomainEventMetadata extends AttributeBag {
  commandId?: Id
  requestId?: Id
  source?: "ui" | "platform" | "integration" | "system" | "migration"
  schemaVersion?: number
}

export interface DomainEvent<TPayload extends AttributeBag = AttributeBag> {
  eventId: Id
  eventType: string
  aggregateType: string
  aggregateId: Id
  aggregateVersion: number
  tenant: TenantContext
  actor?: ActorContext
  occurredAt: ISODate
  payload: TPayload
  metadata: DomainEventMetadata
}

export interface StoredEvent<TPayload extends AttributeBag = AttributeBag>
  extends DomainEvent<TPayload> {
  globalPosition: number
}

export interface AggregateSnapshot<TState extends AttributeBag = AttributeBag> {
  aggregateType: string
  aggregateId: Id
  tenant: TenantContext
  version: number
  state: TState
  takenAt: ISODate
  snapshotSchemaVersion?: number
}

export interface Command<TPayload extends AttributeBag = AttributeBag> {
  commandId: Id
  commandType: string
  payload: TPayload
  tenant: TenantContext
  actor: ActorContext
  requestId?: Id
  issuedAt: ISODate
  metadata?: AttributeBag
}

export interface KernelError {
  code: string
  message: string
  details?: AttributeBag
}

export type CommandResult =
  | {
      success: true
      commandId: Id
      aggregateId?: Id
      events: DomainEvent[]
    }
  | { success: false; commandId: Id; error: KernelError }

export interface Query<TParams extends AttributeBag = AttributeBag> {
  queryType: string
  params: TParams
  tenant: TenantContext
  actor?: ActorContext
}

export type QueryResult<T> =
  | { success: true; data: T }
  | { success: false; error: KernelError }

export function kernelError(code: string, message: string, details?: AttributeBag): KernelError {
  return { code, message, ...(details ? { details } : {}) }
}

export function isCommandOk(result: CommandResult): result is Extract<CommandResult, { success: true }> {
  return result.success === true
}
