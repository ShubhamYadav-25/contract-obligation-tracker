/**
 * @file Defines a backend operational script for local maintenance or diagnostics.
 */
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";

import { loadEnv } from "../config/env.js";
import { createLogger } from "../config/logger.js";
import { ContractIngestionService } from "../modules/contracts/contract-ingestion.service.js";
import { FileHashService } from "../modules/contracts/file-hash.service.js";
import { parseCuadManifest, resolveWorkingSubsetPath } from "../modules/contracts/cuad-manifest.js";
import { createContractIngestionService } from "../modules/contracts/contracts.dependencies.js";

interface ImportSummary {
  manifestEntries: number;
  validatedFiles: number;
  created: number;
  duplicatesSkipped: number;
  failed: number;
  stored: number;
}

/**
 * @description Runs the main script step for local operations.
 * @returns {Promise<void>} Result of the main operation.
 * @throws {Error} When validation, I/O, or downstream service operations fail.
 */
async function main(): Promise<void> {
  const env = loadEnv();
  const logger = createLogger(env);
  const service: ContractIngestionService = createContractIngestionService();
  const fileHash = new FileHashService();
  const repositoryRoot = resolve(process.cwd(), "../..");
  const workingSubsetRoot = join(repositoryRoot, "working-subset");
  const manifestPath = join(workingSubsetRoot, "manifest.json");
  const manifest = parseCuadManifest(JSON.parse(await readFile(manifestPath, "utf8")));
  const summary: ImportSummary = {
    manifestEntries: manifest.contracts.length,
    validatedFiles: 0,
    created: 0,
    duplicatesSkipped: 0,
    failed: 0,
    stored: 0,
  };

  logger.info("cuad_subset_import_started", {
    manifestEntries: manifest.contracts.length,
    concurrency: env.CUAD_IMPORT_CONCURRENCY,
  });

  for (const entry of manifest.contracts) {
    try {
      const filePath = resolveWorkingSubsetPath({
        workingSubsetRoot,
        relativePath: entry.relativePath,
      });

      if (!existsSync(filePath)) {
        throw new Error(`Referenced PDF does not exist for ${entry.datasetId}`);
      }

      const body = await readFile(filePath);
      const sha256 = fileHash.sha256(body);
      if (sha256 !== entry.sha256) {
        throw new Error(`SHA-256 mismatch for ${entry.datasetId}`);
      }
      summary.validatedFiles += 1;

      const result = await service.ingest({
        file: {
          originalFilename: entry.filename,
          mimeType: "application/pdf",
          sizeBytes: body.byteLength,
          body,
        },
        displayName: entry.originalDocumentName,
        externalRef: entry.datasetId,
        organizationId: env.INGESTION_DEFAULT_ORGANIZATION_ID,
        uploadedBy: env.INGESTION_DEFAULT_USER_ID,
        sourceType: "CUAD_SEED",
        sourceReference: JSON.stringify({
          source: entry.source,
          datasetId: entry.datasetId,
          originalDocumentName: entry.originalDocumentName,
        }),
        correlationId: `cuad-import:${entry.datasetId}`,
      });

      if (result.duplicate) {
        summary.duplicatesSkipped += 1;
      } else {
        summary.created += 1;
      }
      if (result.status === "STORED") {
        summary.stored += 1;
      }
    } catch (error) {
      summary.failed += 1;
      logger.error("cuad_subset_contract_import_failed", {
        datasetId: entry.datasetId,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  console.log("CUAD subset import summary");
  console.log(`Manifest entries: ${summary.manifestEntries}`);
  console.log(`Validated files: ${summary.validatedFiles}`);
  console.log(`Created: ${summary.created}`);
  console.log(`Duplicates skipped: ${summary.duplicatesSkipped}`);
  console.log(`Failed: ${summary.failed}`);
  console.log(`Stored: ${summary.stored}`);

  if (summary.failed > 0) {
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
