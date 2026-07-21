import type { BackgroundJob, SupportedJobType } from "../job.types.js";
import { PermanentJobError } from "../retry-policy.js";

export type JobProcessor = (job: BackgroundJob) => Promise<void>;

export class ProcessorRegistry {
  constructor(private readonly processors: ReadonlyMap<SupportedJobType, JobProcessor>) {}

  get(jobType: string): JobProcessor {
    const processor = this.processors.get(jobType as SupportedJobType);
    if (!processor) {
      throw new PermanentJobError(`Unsupported job type: ${jobType}`);
    }
    return processor;
  }
}
