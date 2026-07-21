import type { Clock } from "../../infrastructure/clock/clock.js";
import type { AuditRepository } from "./audit.repository.js";
import type { AuditActor } from "./audit.types.js";

export class AuditService {
  constructor(
    private readonly auditRepository: AuditRepository,
    private readonly clock: Clock,
  ) {}

  append(input: {
    readonly actor: AuditActor;
    readonly action: string;
    readonly entityType: string;
    readonly entityId: string;
    readonly previousData?: unknown;
    readonly newData?: unknown;
    readonly correlationId: string;
  }): Promise<void> {
    return this.auditRepository.append({ ...input, timestamp: this.clock.now() });
  }
}
