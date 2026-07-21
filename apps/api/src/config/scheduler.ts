import type { ApiEnv } from "./env.js";

export interface SchedulerConfig {
  readonly cronExpression: string;
  readonly timezone: string;
  readonly reminderLookaheadMinutes: number;
}

export function createSchedulerConfig(env: ApiEnv): SchedulerConfig {
  return {
    cronExpression: env.SCHEDULER_CRON,
    timezone: env.REMINDER_CRON_TIMEZONE,
    reminderLookaheadMinutes: env.REMINDER_LOOKAHEAD_MINUTES,
  };
}
