/**
 * @file Defines backend runtime configuration and environment helpers.
 */
import type { ApiEnv } from "./env.js";

export interface SchedulerConfig {
  readonly cronExpression: string;
  readonly timezone: string;
  readonly reminderLookaheadMinutes: number;
}

/**
 * @description Executes the create scheduler config operation used by the application workflow.
 * @param {ApiEnv} env - Input value for env.
 * @returns {SchedulerConfig} Result of the create scheduler config operation.
 */
export function createSchedulerConfig(env: ApiEnv): SchedulerConfig {
  return {
    cronExpression: env.SCHEDULER_CRON,
    timezone: env.REMINDER_CRON_TIMEZONE,
    reminderLookaheadMinutes: env.REMINDER_LOOKAHEAD_MINUTES,
  };
}
