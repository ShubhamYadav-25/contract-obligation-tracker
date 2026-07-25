/**
 * @file Defines a backend operational script for local maintenance or diagnostics.
 */
import { loadEnv } from "../config/env.js";
import { createLogger } from "../config/logger.js";
import { createWorkerRuntime } from "../bootstrap/register-workers.js";

/**
 * @description Runs the read run limit script step for local operations.
 * @returns {number} Result of the read run limit operation.
 * @throws {Error} When validation, I/O, or downstream service operations fail.
 */
function readRunLimit(): number {
  const value = process.env.PROCESS_CONTRACT_JOB_RUN_LIMIT;
  if (!value) return 3;

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error("PROCESS_CONTRACT_JOB_RUN_LIMIT must be a positive integer");
  }
  return parsed;
}

/**
 * @description Runs the main script step for local operations.
 * @returns {Promise<void>} Result of the main operation.
 */
async function main(): Promise<void> {
  const env = loadEnv();
  const logger = createLogger(env);
  const runtime = createWorkerRuntime({ logger });
  const runLimit = readRunLimit();
  let claimed = 0;

  try {
    for (let index = 0; index < runLimit; index += 1) {
      const count = await runtime.runOnce();
      claimed += count;
      console.log("contract_job_batch_processed", {
        batch: index + 1,
        claimed: count,
      });
      if (count === 0) break;
    }

    console.log("contract_job_processing_complete", {
      claimed,
      runLimit,
    });
  } finally {
    await runtime.close();
  }
}

main().catch((error) => {
  console.error("contract_job_processing_failed", error);
  process.exitCode = 1;
});
