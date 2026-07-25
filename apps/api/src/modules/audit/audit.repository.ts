/**
 * @file Defines backend audit module contracts, services, routes, or persistence logic.
 */
import type { AuditRecordInput } from "./audit.types.js";
import type { TransactionContext } from "../../infrastructure/database/transaction-manager.js";

export interface AuditRepository {
  append(input: AuditRecordInput, transaction?: TransactionContext): Promise<void>;
}
