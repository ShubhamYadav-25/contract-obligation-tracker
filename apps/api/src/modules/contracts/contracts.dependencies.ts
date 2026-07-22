import { createDatabaseConfig } from "../../config/database.js";
import { loadEnv } from "../../config/env.js";
import { createLogger } from "../../config/logger.js";
import { createStorageConfig } from "../../config/storage.js";
import { PgPoolClient } from "../../infrastructure/database/postgres-client.js";
import { PgTransactionManager } from "../../infrastructure/database/transaction-manager.js";
import { SupabaseStorageProvider } from "../../infrastructure/storage/supabase-storage.provider.js";
import { PostgresJobRepository } from "../../jobs/job.repository.js";
import { ContractProcessingProducer } from "../../jobs/producers/contract-processing.producer.js";
import { PostgresAuditRepository } from "../audit/postgres-audit.repository.js";
import { ContractIngestionService } from "./contract-ingestion.service.js";
import { FileHashService } from "./file-hash.service.js";
import {
  PostgresContractDocumentRepository,
  PostgresContractProcessingRepository,
  PostgresContractRepository,
  PostgresDocumentTextPageRepository,
} from "./postgres-contract.repository.js";

let cachedService: ContractIngestionService | null = null;

export function createContractIngestionService(): ContractIngestionService {
  if (cachedService) {
    return cachedService;
  }

  const env = loadEnv();
  const logger = createLogger(env);
  const storageConfig = createStorageConfig(env);
  const database = new PgPoolClient(createDatabaseConfig(env));
  const transactions = new PgTransactionManager(database.pool);
  const jobs = new PostgresJobRepository(database, transactions);
  const contracts = new PostgresContractRepository(database);
  const documentTextPages = new PostgresDocumentTextPageRepository(database);

  cachedService = new ContractIngestionService({
    contracts,
    contractReads: contracts,
    documents: new PostgresContractDocumentRepository(database),
    documentTextPages,
    processingRuns: new PostgresContractProcessingRepository(database),
    processingQueue: new ContractProcessingProducer(jobs),
    audit: new PostgresAuditRepository(database),
    storage: new SupabaseStorageProvider(storageConfig),
    storageMetadata: {
      provider: "supabase",
      bucket: storageConfig.bucket,
    },
    fileHash: new FileHashService(),
    transactions,
    validation: {
      maxFileSizeBytes: env.CONTRACT_MAX_FILE_SIZE_MB * 1024 * 1024,
      maxPageCount: env.CONTRACT_MAX_PAGE_COUNT,
    },
    logger,
  });

  return cachedService;
}
