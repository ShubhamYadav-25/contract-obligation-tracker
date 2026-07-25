/**
 * @file Defines backend infrastructure adapters used by application modules.
 */
export interface Clock {
  now(): Date;
}

export class SystemClock implements Clock {
  /**
   * @description Implements the now method for this service or adapter.
   * @returns {Date} Result of the now operation.
   */
  now(): Date {
    return new Date();
  }
}
