/**
 * @file Defines backend audit module contracts, services, routes, or persistence logic.
 */
export interface AuditActor {
  readonly id: string;
  readonly type: "USER" | "SYSTEM";
}

export interface AuditRecordInput {
  readonly actor: AuditActor;
  readonly action: string;
  readonly entityType: string;
  readonly entityId: string;
  readonly previousData?: unknown;
  readonly newData?: unknown;
  readonly correlationId: string;
  readonly timestamp: Date;
}
