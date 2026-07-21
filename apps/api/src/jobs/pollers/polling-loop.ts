import type { Logger } from "../../config/logger.js";
import type { CloseableResource } from "../../bootstrap/graceful-shutdown.js";
import type { JobPoller } from "./job-poller.js";

export class PollingLoop implements CloseableResource {
  private timer: NodeJS.Timeout | undefined;
  private stopped = true;

  constructor(
    private readonly poller: JobPoller,
    private readonly intervalMilliseconds: number,
    private readonly logger: Logger,
  ) {}

  start(): void {
    if (!this.stopped) {
      return;
    }
    this.stopped = false;
    this.scheduleNext();
  }

  close(): void {
    this.stopped = true;
    if (this.timer) {
      clearTimeout(this.timer);
    }
  }

  private scheduleNext(): void {
    this.timer = setTimeout(() => {
      void this.tick();
    }, this.intervalMilliseconds);
  }

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
