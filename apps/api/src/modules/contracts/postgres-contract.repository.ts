import type { PostgreSqlClient } from "../../infrastructure/database/postgres-client.js";
import type { TransactionContext } from "../../infrastructure/database/transaction-manager.js";
import type {
  ContractDocumentRepository,
  ContractProcessingRepository,
  ContractRepository,
  CreateContractDocumentInput,
  CreateContractInput,
  CreateContractProcessingRunInput,
  ExistingContractDocument,
} from "./contracts.repository.js";
import type {
  ContractDocumentRecord,
  ContractDocumentSourceType,
  ContractProcessingRunRecord,
  ContractProcessingRunStatus,
  ContractRecord,
  ContractStatus,
} from "./contracts.types.js";

interface ContractRow {
  readonly id: string;
  readonly organization_id: string;
  readonly uploaded_by: string;
  readonly display_name: string;
  readonly external_ref: string | null;
  readonly status: ContractStatus;
  readonly current_document_id: string | null;
  readonly created_at: Date;
  readonly updated_at: Date;
}

interface ContractDocumentRow {
  readonly id: string;
  readonly organization_id: string;
  readonly contract_id: string;
  readonly version_number: number;
  readonly original_filename: string;
  readonly storage_provider: string;
  readonly storage_bucket: string;
  readonly storage_key: string;
  readonly mime_type: "application/pdf";
  readonly file_size_bytes: number;
  readonly file_hash_sha256: string;
  readonly source_type: ContractDocumentSourceType;
  readonly source_reference: string | null;
  readonly uploaded_by: string;
  readonly uploaded_at: Date;
}

interface ContractProcessingRunRow {
  readonly id: string;
  readonly contract_id: string;
  readonly document_id: string;
  readonly status: ContractProcessingRunStatus;
  readonly attempt_number: number;
  readonly queue_job_id: string | null;
  readonly error_code: string | null;
  readonly error_message: string | null;
  readonly started_at: Date | null;
  readonly completed_at: Date | null;
  readonly created_at: Date;
  readonly updated_at: Date;
}

function mapContract(row: ContractRow): ContractRecord {
  return {
    id: row.id,
    organizationId: row.organization_id,
    uploadedBy: row.uploaded_by,
    displayName: row.display_name,
    ...(row.external_ref ? { externalRef: row.external_ref } : {}),
    status: row.status,
    ...(row.current_document_id ? { currentDocumentId: row.current_document_id } : {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapDocument(row: ContractDocumentRow): ContractDocumentRecord {
  return {
    id: row.id,
    organizationId: row.organization_id,
    contractId: row.contract_id,
    versionNumber: row.version_number,
    originalFilename: row.original_filename,
    storageProvider: row.storage_provider,
    storageBucket: row.storage_bucket,
    storageKey: row.storage_key,
    mimeType: row.mime_type,
    fileSizeBytes: row.file_size_bytes,
    fileHashSha256: row.file_hash_sha256,
    sourceType: row.source_type,
    ...(row.source_reference ? { sourceReference: row.source_reference } : {}),
    uploadedBy: row.uploaded_by,
    uploadedAt: row.uploaded_at,
  };
}

function mapProcessingRun(row: ContractProcessingRunRow): ContractProcessingRunRecord {
  return {
    id: row.id,
    contractId: row.contract_id,
    documentId: row.document_id,
    status: row.status,
    attemptNumber: row.attempt_number,
    ...(row.queue_job_id ? { queueJobId: row.queue_job_id } : {}),
    ...(row.error_code ? { errorCode: row.error_code } : {}),
    ...(row.error_message ? { errorMessage: row.error_message } : {}),
    ...(row.started_at ? { startedAt: row.started_at } : {}),
    ...(row.completed_at ? { completedAt: row.completed_at } : {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class PostgresContractRepository implements ContractRepository {
  constructor(private readonly database: PostgreSqlClient) {}

  async findById(id: string): Promise<ContractRecord | null> {
    const result = await this.database.query<ContractRow>(
      `
        SELECT *
        FROM contracts
        WHERE id = $1
      `,
      [id],
    );

    return result.rows[0] ? mapContract(result.rows[0]) : null;
  }

  async findBySha256(sha256: string): Promise<ContractRecord | null> {
    const result = await this.database.query<ContractRow>(
      `
        SELECT contract.*
        FROM contracts AS contract
        INNER JOIN contract_documents AS document
          ON document.contract_id = contract.id
        WHERE document.file_hash_sha256 = $1
        ORDER BY contract.created_at
        LIMIT 1
      `,
      [sha256],
    );

    return result.rows[0] ? mapContract(result.rows[0]) : null;
  }

  async create(
    input: CreateContractInput,
    transaction: TransactionContext,
  ): Promise<ContractRecord> {
    const result = await transaction.client.query<ContractRow>(
      `
        INSERT INTO contracts (
          id,
          organization_id,
          uploaded_by,
          display_name,
          external_ref,
          status
        )
        VALUES ($1, $2, $3, $4, $5, 'DRAFT')
        RETURNING *
      `,
      [
        input.id,
        input.organizationId,
        input.uploadedBy,
        input.displayName,
        input.externalRef ?? null,
      ],
    );

    const row = result.rows[0];
    if (!row) {
      throw new Error("Contract insert returned no row");
    }
    return mapContract(row);
  }

  async assignCurrentDocument(
    input: { readonly contractId: string; readonly documentId: string },
    transaction: TransactionContext,
  ): Promise<void> {
    await transaction.client.query(
      `
        UPDATE contracts
        SET current_document_id = $2,
            updated_at = NOW()
        WHERE id = $1
      `,
      [input.contractId, input.documentId],
    );
  }
}

export class PostgresContractDocumentRepository implements ContractDocumentRepository {
  constructor(private readonly database: PostgreSqlClient) {}

  async findByOrganizationAndHash(input: {
    readonly organizationId: string;
    readonly fileHashSha256: string;
  }): Promise<ExistingContractDocument | null> {
    const result = await this.database.query<
      ContractRow &
        ContractDocumentRow & { readonly processing_run: ContractProcessingRunRow | null }
    >(
      `
        SELECT
          to_jsonb(contract.*) AS contract,
          to_jsonb(document.*) AS document,
          to_jsonb(run.*) AS processing_run
        FROM contract_documents AS document
        INNER JOIN contracts AS contract
          ON contract.id = document.contract_id
        LEFT JOIN LATERAL (
          SELECT *
          FROM contract_processing_runs AS run
          WHERE run.document_id = document.id
          ORDER BY run.created_at DESC
          LIMIT 1
        ) AS run ON TRUE
        WHERE document.organization_id = $1
          AND document.file_hash_sha256 = $2
        LIMIT 1
      `,
      [input.organizationId, input.fileHashSha256],
    );

    const row = result.rows[0] as unknown as
      | {
          readonly contract: ContractRow;
          readonly document: ContractDocumentRow;
          readonly processing_run: ContractProcessingRunRow | null;
        }
      | undefined;
    if (!row) {
      return null;
    }

    return {
      contract: mapContract(row.contract),
      document: mapDocument(row.document),
      processingRun: row.processing_run ? mapProcessingRun(row.processing_run) : null,
    };
  }

  async create(
    input: CreateContractDocumentInput,
    transaction: TransactionContext,
  ): Promise<ContractDocumentRecord> {
    const result = await transaction.client.query<ContractDocumentRow>(
      `
        INSERT INTO contract_documents (
          id,
          organization_id,
          contract_id,
          version_number,
          original_filename,
          storage_provider,
          storage_bucket,
          storage_key,
          mime_type,
          file_size_bytes,
          file_hash_sha256,
          source_type,
          source_reference,
          uploaded_by
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        RETURNING *
      `,
      [
        input.id,
        input.organizationId,
        input.contractId,
        input.versionNumber,
        input.originalFilename,
        input.storageProvider,
        input.storageBucket,
        input.storageKey,
        input.mimeType,
        input.fileSizeBytes,
        input.fileHashSha256,
        input.sourceType,
        input.sourceReference ?? null,
        input.uploadedBy,
      ],
    );

    const row = result.rows[0];
    if (!row) {
      throw new Error("Contract document insert returned no row");
    }
    return mapDocument(row);
  }
}

export class PostgresContractProcessingRepository implements ContractProcessingRepository {
  constructor(private readonly database: PostgreSqlClient) {}

  async createRun(
    input: CreateContractProcessingRunInput,
    transaction: TransactionContext,
  ): Promise<ContractProcessingRunRecord> {
    const result = await transaction.client.query<ContractProcessingRunRow>(
      `
        INSERT INTO contract_processing_runs (
          id,
          contract_id,
          document_id,
          status,
          attempt_number
        )
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `,
      [input.id, input.contractId, input.documentId, input.status, input.attemptNumber],
    );

    const row = result.rows[0];
    if (!row) {
      throw new Error("Contract processing run insert returned no row");
    }
    return mapProcessingRun(row);
  }

  async markQueued(input: {
    readonly processingRunId: string;
    readonly queueJobId: string;
  }): Promise<ContractProcessingRunRecord> {
    const result = await this.database.query<ContractProcessingRunRow>(
      `
        UPDATE contract_processing_runs
        SET status = 'QUEUED',
            queue_job_id = $2,
            updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `,
      [input.processingRunId, input.queueJobId],
    );

    const row = result.rows[0];
    if (!row) {
      throw new Error("Processing run queue update returned no row");
    }
    return mapProcessingRun(row);
  }

  async findLatestByContractId(input: {
    readonly organizationId: string;
    readonly contractId: string;
  }): Promise<ContractProcessingRunRecord | null> {
    const result = await this.database.query<ContractProcessingRunRow>(
      `
        SELECT run.*
        FROM contract_processing_runs AS run
        INNER JOIN contracts AS contract
          ON contract.id = run.contract_id
        WHERE contract.organization_id = $1
          AND contract.id = $2
        ORDER BY run.created_at DESC
        LIMIT 1
      `,
      [input.organizationId, input.contractId],
    );

    return result.rows[0] ? mapProcessingRun(result.rows[0]) : null;
  }
}
