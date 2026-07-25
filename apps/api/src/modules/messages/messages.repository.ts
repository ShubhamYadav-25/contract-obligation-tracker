/**
 * @file Defines backend messages module contracts, services, routes, or persistence logic.
 */
import type { MessageRecord } from "./messages.types.js";

export interface MessageReadRepository {
  listByOrganization(input: {
    readonly organizationId: string;
    readonly obligationId?: string;
    readonly reminderId?: string;
    readonly limit: number;
    readonly offset: number;
  }): Promise<readonly MessageRecord[]>;
}
