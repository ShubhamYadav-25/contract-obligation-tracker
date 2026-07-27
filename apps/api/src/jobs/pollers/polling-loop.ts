/**
 * @file Defines background job scheduling, processing, recovery, or producer logic.
 */
import type { Logger } from "../../config/logger.js";
import type { CloseableResource } from "../../bootstrap/graceful-shutdown.js";
interface Poller {
  poll(): Promise<number>;
}

export class PollingLoop implements CloseableResource {
  private timer: NodeJS.Timeout | undefined;
  private stopped = true;

  /**
   * @description Implements the constructor method for this service or adapter.
   * @param {JobPoller} poller - Input value for poller.
   * @param {number} intervalMilliseconds - Input value for interval milliseconds.
   * @param {Logger} logger - Input value for logger.
   * @returns {unknown} Result of the constructor operation.
   */
  constructor(
    private readonly poller: Poller,
    private readonly intervalMilliseconds: number,
    private readonly logger: Logger,
  ) {}

  /**
   * @description Implements the start method for this service or adapter.
   * @returns {void} Result of the start operation.
   */
  start(): void {
    if (!this.stopped) {
      return;
    }
    this.stopped = false;
    this.scheduleNext();
  }

  /**
   * @description Implements the close method for this service or adapter.
   * @returns {void} Result of the close operation.
   */
  close(): void {
    this.stopped = true;
    if (this.timer) {
      clearTimeout(this.timer);
    }
  }

  /**
   * @description Implements the schedule next method for this service or adapter.
   * @returns {void} Result of the schedule next operation.
   */
  private scheduleNext(): void {
    this.timer = setTimeout(() => {
      void this.tick();
    }, this.intervalMilliseconds);
  }

  /**
   * @description Implements the tick method for this service or adapter.
   * @returns {Promise<void>} Result of the tick operation.
   */
  private async tick(): Promise<void> {
    if (this.stopped) {
      return;
    }

    try {
      await this.poller.poll();
    } catch (error) {
      this.logger.error("job_poll_failed", {
        message: error instanceof Error ? error.message : String(error),
      });
    } finally {
      if (!this.stopped) {
        this.scheduleNext();
      }
    }
  }
}
