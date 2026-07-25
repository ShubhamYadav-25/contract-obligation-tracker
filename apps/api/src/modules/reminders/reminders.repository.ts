/**
 * @file Defines backend reminders module contracts, services, routes, or persistence logic.
 */
import type { ReminderRecord, ReminderStatus } from "./reminders.types.js";

export interface ReminderReadRepository {
  listByOrganization(input: {
    readonly organizationId: string;
    readonly obligationId?: string;
    readonly limit: number;
    readonly offset: number;
  }): Promise<readonly ReminderRecord[]>;
}

export interface ReminderRepository {
  createScheduled(input: {
    readonly obligationId: string;
    readonly scheduledFor: Date;
    readonly occurrenceKey: string;
  }): Promise<ReminderRecord>;
  claimDue(input: {
    readonly now: Date;
    readonly leaseUntil: Date;
    readonly limit: number;
  }): Promise<readonly ReminderRecord[]>;
  markStatus(input: {
    readonly reminderId: string;
    readonly status: ReminderStatus;
    readonly expectedVersion: number;
  }): Promise<ReminderRecord>;
  recoverExpiredLeases(now: Date): Promise<number>;
}

export interface ReminderSchedulerRepository {
  enqueueDueReminders(input: {
    readonly now: Date;
    readonly lookaheadUntil: Date;
    readonly limit: number;
  }): Promise<{
    readonly remindersClaimed: number;
    readonly jobsCreated: number;
  }>;
}
