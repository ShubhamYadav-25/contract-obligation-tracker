/**
 * @file Defines backend audit module contracts, services, routes, or persistence logic.
 */
import type { Clock } from "../../infrastructure/clock/clock.js";
import type { AuditRepository } from "./audit.repository.js";
import type { AuditActor } from "./audit.types.js";

export class AuditService {
  /**
   * @description Implements the constructor method for this service or adapter.
   * @param {AuditRepository} auditRepository - Input value for audit repository.
   * @param {Clock} clock - Input value for clock.
   * @returns {unknown} Result of the constructor operation.
   */
  constructor(
    private readonly auditRepository: AuditRepository,
    private readonly clock: Clock,
  ) {}

  /**
   * @description Implements the append method for this service or adapter.
   * @param {{ readonly actor: AuditActor; readonly action: string; readonly entityType: string; readonly entityId: string; readonly previousData?: unknown; readonly newData?: unknown; readonly correlationId: string; }} input - Input value for input.
   * @returns {Promise<void>} Result of the append operation.
   */
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
