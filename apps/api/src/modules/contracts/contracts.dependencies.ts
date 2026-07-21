import { createDatabaseConfig } from "../../config/database.js";
import { loadEnv } from "../../config/env.js";
import { createLogger } from "../../config/logger.js";
import { createStorageConfig } from "../../config/storage.js";
import { PgPoolClient } from "../../infrastructure/database/postgres-client.js";
import { PgTransactionManager } from "../../infrastructure/database/transaction-manager.js";
import { SupabaseStorageProvider } from "../../infrastructure/storage/supabase-storage.provider.js";
import { JobRepository, PostgresJobRepository } from "../../jobs/job.repository.js";
import { ContractProcessingProducer } from "../../jobs/producers/contract-processing.producer.js";
import { PostgresAuditRepository } from "../audit/postgres-audit.repository.js";
import { ContractIngestionService } from "./contract-ingestion.service.js";
import { FileHashService } from "./file-hash.service.js";
import {
  PostgresContractDocumentRepository,
  PostgresContractProcessingRepository,
  PostgresContractRepository,
} from "./postgres-contract.repository.js";

let cachedService: ContractIngestionService | null = null;

export function createContractIngestionService(): ContractIngestionService {
  if (cachedService) {
    return cachedService;
  }

  const env = loadEnv();
  const logger = createLogger(env);
  const database = new PgPoolClient(createDatabaseConfig(env));
  const transactions = new PgTransactionManager(database.pool);
  const jobs: JobRepository = new PostgresJobRepository(database, transactions);

  cachedService = new ContractIngestionService({
    contracts: new PostgresContractRepository(database),
    documents: new PostgresContractDocumentRepository(database),
    processingRuns: new PostgresContractProcessingRepository(database),
    audit: new PostgresAuditRepository(database),
    storage: new SupabaseStorageProvider(createStorageConfig(env)),
    fileHash: new FileHashService(),
    queue: new ContractProcessingProducer(jobs),
    transactions,
    validation: {
      maxFileSizeBytes: env.CONTRACT_MAX_FILE_SIZE_MB * 1024 * 1024,
      maxPageCount: env.CONTRACT_MAX_PAGE_COUNT,
    },
    logger,
  });

  return cachedService;
}
