/**
 * @file Defines backend contracts module contracts, services, routes, or persistence logic.
 */
import type { PostgreSqlClient } from "../../infrastructure/database/postgres-client.js";
import type { TransactionContext } from "../../infrastructure/database/transaction-manager.js";
import type {
  ContractDocumentRepository,
  ContractProcessingRepository,
  ContractRepository,
  CreateContractDocumentInput,
  CreateContractInput,
  CreateContractProcessingRunInput,
  ClaimContractProcessingRunInput,
  CompleteContractProcessingRunInput,
  DocumentTextPageRepository,
  DocumentTextPageReadRepository,
  ExistingContractDocument,
  FailContractProcessingRunInput,
  MarkContractProcessingStageInput,
  PersistDocumentTextPagesInput,
  ContractWorkspaceRepository,
} from "./contracts.repository.js";
import type {
  ContractDocumentRecord,
  ContractDocumentSourceType,
  ContractDocumentUploadStatus,
  ContractProcessingRunRecord,
  ContractProcessingRunStatus,
  ContractRecord,
  ContractStatus,
  ContractWorkspaceRecord,
  DocumentTextPageRecord,
} from "./contracts.types.js";

type PgTimestamp = Date | string;

interface ContractRow {
  readonly id: string;
  readonly organization_id: string;
  readonly uploaded_by: string;
  readonly display_name: string;
  readonly external_ref: string | null;
  readonly status: ContractStatus;
  readonly current_document_id: string | null;
  readonly created_at: PgTimestamp;
  readonly updated_at: PgTimestamp;
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
  readonly file_size_bytes: PgNumeric;
  readonly file_hash_sha256: string;
  readonly upload_status: ContractDocumentUploadStatus;
  readonly upload_error_code: string | null;
  readonly upload_error_message: string | null;
  readonly upload_failed_at: PgTimestamp | null;
  readonly source_type: ContractDocumentSourceType;
  readonly source_reference: string | null;
  readonly uploaded_by: string;
  readonly uploaded_at: PgTimestamp;
}

interface ContractProcessingRunRow {
  readonly id: string;
  readonly contract_id: string;
  readonly document_id: string;
  readonly status: ContractProcessingRunStatus;
  readonly attempt_number: number;
  readonly queue_job_id: string | null;
  readonly error_code: string | null;
  readonly error_stage: string | null;
  readonly error_message: string | null;
  readonly error_retryable: boolean | null;
  readonly started_at: PgTimestamp | null;
  readonly completed_at: PgTimestamp | null;
  readonly failed_at: PgTimestamp | null;
  readonly created_at: PgTimestamp;
  readonly updated_at: PgTimestamp;
}

type PgNumeric = number | string;

interface ContractWorkspaceRow {
  readonly contract: ContractRow;
  readonly document: ContractDocumentRow | null;
  readonly processing_run: ContractProcessingRunRow | null;
  readonly text_page_count: PgNumeric;
  readonly text_segment_count: PgNumeric;
  readonly ocr_page_count: PgNumeric;
  readonly obligation_count: PgNumeric;
  readonly extraction_audit_data: unknown;
}

interface DocumentTextPageRow {
  readonly organization_id: string;
  readonly contract_id: string;
  readonly document_id: string;
  readonly processing_run_id: string;
  readonly page_number: number;
  readonly extraction_method: DocumentTextPageRecord["extractionMethod"];
  readonly raw_text: string;
  readonly normalized_text: string;
  readonly char_count: number;
  readonly word_count: number;
  readonly printable_ratio: PgNumeric;
  readonly ocr_confidence: PgNumeric | null;
  readonly page_width: PgNumeric | null;
  readonly page_height: PgNumeric | null;
  readonly segments: unknown;
  readonly warnings: unknown;
  readonly created_at: PgTimestamp;
}

/**
 * @description Performs the to date helper operation for this module.
 * @param {PgTimestamp} value - Input value for value.
 * @returns {Date} Result of the to date operation.
 */
function toDate(value: PgTimestamp): Date {
  return value instanceof Date ? value : new Date(value);
}

/**
 * @description Performs the to optional date helper operation for this module.
 * @param {PgTimestamp | null} value - Input value for value.
 * @returns {Date | undefined} Result of the to optional date operation.
 */
function toOptionalDate(value: PgTimestamp | null): Date | undefined {
  return value ? toDate(value) : undefined;
}

/**
 * @description Performs the to number helper operation for this module.
 * @param {PgNumeric} value - Input value for value.
 * @returns {number} Result of the to number operation.
 */
function toNumber(value: PgNumeric): number {
  return typeof value === "number" ? value : Number(value);
}

/**
 * @description Performs the to optional number helper operation for this module.
 * @param {PgNumeric | null} value - Input value for value.
 * @returns {number | undefined} Result of the to optional number operation.
 */
function toOptionalNumber(value: PgNumeric | null): number | undefined {
  return value === null ? undefined : toNumber(value);
}

/**
 * @description Performs the number from record helper operation for this module.
 * @param {Record<string, unknown> | null} record - Input value for record.
 * @param {string} key - Input value for key.
 * @returns {number | undefined} Result of the number from record operation.
 */
function numberFromRecord(record: Record<string, unknown> | null, key: string): number | undefined {
  const value = record?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

/**
 * @description Performs the string from record helper operation for this module.
 * @param {Record<string, unknown> | null} record - Input value for record.
 * @param {string} key - Input value for key.
 * @returns {string | undefined} Result of the string from record operation.
 */
function stringFromRecord(record: Record<string, unknown> | null, key: string): string | undefined {
  const value = record?.[key];
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

/**
 * @description Performs the record from unknown helper operation for this module.
 * @param {unknown} value - Input value for value.
 * @returns {Record<string, unknown> | null} Result of the record from unknown operation.
 */
function recordFromUnknown(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/**
 * @description Performs the to record array helper operation for this module.
 * @param {unknown} value - Input value for value.
 * @returns {readonly Record<string, unknown>[]} Result of the to record array operation.
 */
function toRecordArray(value: unknown): readonly Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.filter(
        (item): item is Record<string, unknown> =>
          typeof item === "object" && item !== null && !Array.isArray(item),
      )
    : [];
}

/**
 * @description Performs the to string array helper operation for this module.
 * @param {unknown} value - Input value for value.
 * @returns {readonly string[]} Result of the to string array operation.
 */
function toStringArray(value: unknown): readonly string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

/**
 * @description Performs the map contract helper operation for this module.
 * @param {ContractRow} row - Input value for row.
 * @returns {ContractRecord} Result of the map contract operation.
 */
function mapContract(row: ContractRow): ContractRecord {
  return {
    id: row.id,
    organizationId: row.organization_id,
    uploadedBy: row.uploaded_by,
    displayName: row.display_name,
    ...(row.external_ref ? { externalRef: row.external_ref } : {}),
    status: row.status,
    ...(row.current_document_id ? { currentDocumentId: row.current_document_id } : {}),
    createdAt: toDate(row.created_at),
    updatedAt: toDate(row.updated_at),
  };
}

/**
 * @description Performs the map document helper operation for this module.
 * @param {ContractDocumentRow} row - Input value for row.
 * @returns {ContractDocumentRecord} Result of the map document operation.
 */
function mapDocument(row: ContractDocumentRow): ContractDocumentRecord {
  const uploadFailedAt = toOptionalDate(row.upload_failed_at);

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
    fileSizeBytes: toNumber(row.file_size_bytes),
    fileHashSha256: row.file_hash_sha256,
    uploadStatus: row.upload_status,
    ...(row.upload_error_code ? { uploadErrorCode: row.upload_error_code } : {}),
    ...(row.upload_error_message ? { uploadErrorMessage: row.upload_error_message } : {}),
    ...(uploadFailedAt ? { uploadFailedAt } : {}),
    sourceType: row.source_type,
    ...(row.source_reference ? { sourceReference: row.source_reference } : {}),
    uploadedBy: row.uploaded_by,
    uploadedAt: toDate(row.uploaded_at),
  };
}

/**
 * @description Performs the map processing run helper operation for this module.
 * @param {ContractProcessingRunRow} row - Input value for row.
 * @returns {ContractProcessingRunRecord} Result of the map processing run operation.
 */
function mapProcessingRun(row: ContractProcessingRunRow): ContractProcessingRunRecord {
  const startedAt = toOptionalDate(row.started_at);
  const completedAt = toOptionalDate(row.completed_at);
  const failedAt = toOptionalDate(row.failed_at);

  return {
    id: row.id,
    contractId: row.contract_id,
    documentId: row.document_id,
    status: row.status,
    attemptNumber: row.attempt_number,
    ...(row.queue_job_id ? { queueJobId: row.queue_job_id } : {}),
    ...(row.error_code ? { errorCode: row.error_code } : {}),
    ...(row.error_stage ? { errorStage: row.error_stage } : {}),
    ...(row.error_message ? { errorMessage: row.error_message } : {}),
    ...(row.error_retryable !== null ? { errorRetryable: row.error_retryable } : {}),
    ...(startedAt ? { startedAt } : {}),
    ...(completedAt ? { completedAt } : {}),
    ...(failedAt ? { failedAt } : {}),
    createdAt: toDate(row.created_at),
    updatedAt: toDate(row.updated_at),
  };
}

/**
 * @description Performs the map workspace helper operation for this module.
 * @param {ContractWorkspaceRow} row - Input value for row.
 * @returns {ContractWorkspaceRecord} Result of the map workspace operation.
 */
function mapWorkspace(row: ContractWorkspaceRow): ContractWorkspaceRecord {
  const auditData = recordFromUnknown(row.extraction_audit_data);
  const metadata = recordFromUnknown(auditData?.extractionMetadata);
  const metrics = recordFromUnknown(metadata?.metrics);
  const provider = stringFromRecord(auditData, "extractionProvider");
  const confidence = numberFromRecord(auditData, "extractionConfidence");

  return {
    contract: mapContract(row.contract),
    ...(row.document ? { currentDocument: mapDocument(row.document) } : {}),
    ...(row.processing_run ? { latestProcessingRun: mapProcessingRun(row.processing_run) } : {}),
    text: {
      pageCount: toNumber(row.text_page_count),
      segmentCount: toNumber(row.text_segment_count),
      ocrPageCount: toNumber(row.ocr_page_count),
    },
    extraction: {
      ...(provider ? { provider } : {}),
      ...(confidence !== undefined ? { confidence } : {}),
      confirmedCount:
        numberFromRecord(metrics, "confirmed") ??
        numberFromRecord(auditData, "obligationCount") ??
        toNumber(row.obligation_count),
      reviewRequiredCount: numberFromRecord(metrics, "reviewRequired") ?? 0,
      rejectedCount: numberFromRecord(metrics, "rejected") ?? 0,
      ...(numberFromRecord(metrics, "rawCandidates") !== undefined
        ? { rawCandidateCount: numberFromRecord(metrics, "rawCandidates") ?? 0 }
        : {}),
      ...(numberFromRecord(metrics, "verifiedCandidates") !== undefined
        ? { verifiedCandidateCount: numberFromRecord(metrics, "verifiedCandidates") ?? 0 }
        : {}),
      ...(numberFromRecord(metrics, "duplicateRemovals") !== undefined
        ? { duplicateRemovalCount: numberFromRecord(metrics, "duplicateRemovals") ?? 0 }
        : {}),
      ...(numberFromRecord(metrics, "consolidations") !== undefined
        ? { consolidationCount: numberFromRecord(metrics, "consolidations") ?? 0 }
        : {}),
      ...(numberFromRecord(metrics, "llmRequestCount") !== undefined
        ? { llmRequestCount: numberFromRecord(metrics, "llmRequestCount") ?? 0 }
        : {}),
      ...(numberFromRecord(metrics, "retryCount") !== undefined
        ? { retryCount: numberFromRecord(metrics, "retryCount") ?? 0 }
        : {}),
    },
  };
}

/**
 * @description Performs the map document text page helper operation for this module.
 * @param {DocumentTextPageRow} row - Input value for row.
 * @returns {DocumentTextPageRecord} Result of the map document text page operation.
 */
function mapDocumentTextPage(row: DocumentTextPageRow): DocumentTextPageRecord {
  const ocrConfidence = toOptionalNumber(row.ocr_confidence);
  const pageWidth = toOptionalNumber(row.page_width);
  const pageHeight = toOptionalNumber(row.page_height);

  return {
    organizationId: row.organization_id,
    contractId: row.contract_id,
    documentId: row.document_id,
    processingRunId: row.processing_run_id,
    pageNumber: row.page_number,
    extractionMethod: row.extraction_method,
    rawText: row.raw_text,
    normalizedText: row.normalized_text,
    charCount: row.char_count,
    wordCount: row.word_count,
    printableRatio: toNumber(row.printable_ratio),
    ...(ocrConfidence !== undefined ? { ocrConfidence } : {}),
    ...(pageWidth !== undefined ? { pageWidth } : {}),
    ...(pageHeight !== undefined ? { pageHeight } : {}),
    segments: toRecordArray(row.segments),
    warnings: toStringArray(row.warnings),
    createdAt: toDate(row.created_at),
  };
}

export class PostgresContractRepository implements ContractRepository, ContractWorkspaceRepository {
  /**
   * @description Implements the constructor method for this service or adapter.
   * @param {PostgreSqlClient} database - Input value for database.
   * @returns {unknown} Result of the constructor operation.
   */
  constructor(private readonly database: PostgreSqlClient) {}

  /**
   * @description Executes the list by organization operation used by the application workflow.
   * @param {{ readonly organizationId: string; readonly search?: string; readonly limit: number; readonly offset: number; }} input - Input value for input.
   * @returns {Promise<readonly ContractWorkspaceRecord[]>} Result of the list by organization operation.
   */
  async listByOrganization(input: {
    readonly organizationId: string;
    readonly search?: string;
    readonly limit: number;
    readonly offset: number;
  }): Promise<readonly ContractWorkspaceRecord[]> {
    const result = await this.database.query<ContractWorkspaceRow>(
      `
        SELECT
          to_jsonb(contract.*) AS contract,
          to_jsonb(document.*) AS document,
          to_jsonb(run.*) AS processing_run,
          COALESCE(text_stats.page_count, 0) AS text_page_count,
          COALESCE(text_stats.segment_count, 0) AS text_segment_count,
          COALESCE(text_stats.ocr_page_count, 0) AS ocr_page_count,
          COALESCE(obligation_stats.obligation_count, 0) AS obligation_count,
          extraction_audit.new_data AS extraction_audit_data
        FROM contracts AS contract
        LEFT JOIN contract_documents AS document
          ON document.id = contract.current_document_id
          AND document.organization_id = contract.organization_id
        LEFT JOIN LATERAL (
          SELECT *
          FROM contract_processing_runs AS run
          WHERE run.contract_id = contract.id
            AND (
              contract.current_document_id IS NULL
              OR run.document_id = contract.current_document_id
            )
          ORDER BY run.created_at DESC
          LIMIT 1
        ) AS run ON TRUE
        LEFT JOIN LATERAL (
          SELECT
            COUNT(*)::int AS page_count,
            COALESCE(SUM(jsonb_array_length(page.segments)), 0)::int AS segment_count,
            COUNT(*) FILTER (WHERE page.extraction_method <> 'PDF_TEXT')::int AS ocr_page_count
          FROM document_text_pages AS page
          WHERE page.contract_id = contract.id
            AND (
              contract.current_document_id IS NULL
              OR page.document_id = contract.current_document_id
            )
        ) AS text_stats ON TRUE
        LEFT JOIN LATERAL (
          SELECT COUNT(*)::int AS obligation_count
          FROM obligations AS obligation
          WHERE obligation.contract_id = contract.id
        ) AS obligation_stats ON TRUE
        LEFT JOIN LATERAL (
          SELECT audit.new_data
          FROM audit_events AS audit
          WHERE audit.entity_type = 'CONTRACT'
            AND audit.entity_id = contract.id::text
            AND audit.action = 'CONTRACT_OBLIGATIONS_EXTRACTED'
          ORDER BY audit.created_at DESC
          LIMIT 1
        ) AS extraction_audit ON TRUE
        WHERE contract.organization_id = $1
          AND (
            $4::text IS NULL
            OR contract.display_name ILIKE '%' || $4 || '%'
            OR contract.external_ref ILIKE '%' || $4 || '%'
            OR document.original_filename ILIKE '%' || $4 || '%'
            OR document.file_hash_sha256 ILIKE '%' || $4 || '%'
          )
        ORDER BY contract.created_at DESC
        LIMIT $2 OFFSET $3
      `,
      [input.organizationId, input.limit, input.offset, input.search ?? null],
    );

    return result.rows.map(mapWorkspace);
  }

  /**
   * @description Implements the find by organization and id method for this service or adapter.
   * @param {{ readonly organizationId: string; readonly contractId: string; }} input - Input value for input.
   * @returns {Promise<ContractWorkspaceRecord | null>} Result of the find by organization and id operation.
   */
  async findByOrganizationAndId(input: {
    readonly organizationId: string;
    readonly contractId: string;
  }): Promise<ContractWorkspaceRecord | null> {
    const result = await this.database.query<ContractWorkspaceRow>(
      `
        SELECT
          to_jsonb(contract.*) AS contract,
          to_jsonb(document.*) AS document,
          to_jsonb(run.*) AS processing_run,
          COALESCE(text_stats.page_count, 0) AS text_page_count,
          COALESCE(text_stats.segment_count, 0) AS text_segment_count,
          COALESCE(text_stats.ocr_page_count, 0) AS ocr_page_count,
          COALESCE(obligation_stats.obligation_count, 0) AS obligation_count,
          extraction_audit.new_data AS extraction_audit_data
        FROM contracts AS contract
        LEFT JOIN contract_documents AS document
          ON document.id = contract.current_document_id
          AND document.organization_id = contract.organization_id
        LEFT JOIN LATERAL (
          SELECT *
          FROM contract_processing_runs AS run
          WHERE run.contract_id = contract.id
            AND (
              contract.current_document_id IS NULL
              OR run.document_id = contract.current_document_id
            )
          ORDER BY run.created_at DESC
          LIMIT 1
        ) AS run ON TRUE
        LEFT JOIN LATERAL (
          SELECT
            COUNT(*)::int AS page_count,
            COALESCE(SUM(jsonb_array_length(page.segments)), 0)::int AS segment_count,
            COUNT(*) FILTER (WHERE page.extraction_method <> 'PDF_TEXT')::int AS ocr_page_count
          FROM document_text_pages AS page
          WHERE page.contract_id = contract.id
            AND (
              contract.current_document_id IS NULL
              OR page.document_id = contract.current_document_id
            )
        ) AS text_stats ON TRUE
        LEFT JOIN LATERAL (
          SELECT COUNT(*)::int AS obligation_count
          FROM obligations AS obligation
          WHERE obligation.contract_id = contract.id
        ) AS obligation_stats ON TRUE
        LEFT JOIN LATERAL (
          SELECT audit.new_data
          FROM audit_events AS audit
          WHERE audit.entity_type = 'CONTRACT'
            AND audit.entity_id = contract.id::text
            AND audit.action = 'CONTRACT_OBLIGATIONS_EXTRACTED'
          ORDER BY audit.created_at DESC
          LIMIT 1
        ) AS extraction_audit ON TRUE
        WHERE contract.organization_id = $1
          AND contract.id = $2
        LIMIT 1
      `,
      [input.organizationId, input.contractId],
    );

    return result.rows[0] ? mapWorkspace(result.rows[0]) : null;
  }

  /**
   * @description Implements the find by id method for this service or adapter.
   * @param {string} id - Input value for id.
   * @returns {Promise<ContractRecord | null>} Result of the find by id operation.
   */
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

  /**
   * @description Implements the find by sha256 method for this service or adapter.
   * @param {string} sha256 - Input value for sha256.
   * @returns {Promise<ContractRecord | null>} Result of the find by sha256 operation.
   */
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

  /**
   * @description Executes the create operation used by the application workflow.
   * @param {CreateContractInput} input - Input value for input.
   * @param {TransactionContext} transaction - Input value for transaction.
   * @returns {Promise<ContractRecord>} Result of the create operation.
   * @throws {Error} When validation, I/O, or downstream service operations fail.
   */
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

  /**
   * @description Implements the assign current document method for this service or adapter.
   * @param {{ readonly contractId: string; readonly documentId: string }} input - Input value for input.
   * @param {TransactionContext} transaction - Input value for transaction.
   * @returns {Promise<void>} Result of the assign current document operation.
   */
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
  /**
   * @description Implements the constructor method for this service or adapter.
   * @param {PostgreSqlClient} database - Input value for database.
   * @returns {unknown} Result of the constructor operation.
   */
  constructor(private readonly database: PostgreSqlClient) {}

  /**
   * @description Implements the find by organization and hash method for this service or adapter.
   * @param {{ readonly organizationId: string; readonly fileHashSha256: string; }} input - Input value for input.
   * @returns {Promise<ExistingContractDocument | null>} Result of the find by organization and hash operation.
   */
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
          AND document.upload_status IN ('PENDING_UPLOAD', 'STORED')
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

  /**
   * @description Executes the create pending operation used by the application workflow.
   * @param {CreateContractDocumentInput} input - Input value for input.
   * @param {TransactionContext} transaction - Input value for transaction.
   * @returns {Promise<ContractDocumentRecord>} Result of the create pending operation.
   * @throws {Error} When validation, I/O, or downstream service operations fail.
   */
  async createPending(
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
          upload_status,
          source_type,
          source_reference,
          uploaded_by
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
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
        input.uploadStatus,
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

  /**
   * @description Implements the find stored for processing method for this service or adapter.
   * @param {{ readonly organizationId: string; readonly contractId: string; readonly documentId: string; }} input - Input value for input.
   * @returns {Promise<ContractDocumentRecord | null>} Result of the find stored for processing operation.
   */
  async findStoredForProcessing(input: {
    readonly organizationId: string;
    readonly contractId: string;
    readonly documentId: string;
  }): Promise<ContractDocumentRecord | null> {
    const result = await this.database.query<ContractDocumentRow>(
      `
        SELECT document.*
        FROM contract_documents AS document
        INNER JOIN contracts AS contract
          ON contract.id = document.contract_id
        WHERE document.organization_id = $1
          AND document.contract_id = $2
          AND document.id = $3
          AND document.upload_status = 'STORED'
          AND contract.organization_id = document.organization_id
          AND contract.current_document_id = document.id
        LIMIT 1
      `,
      [input.organizationId, input.contractId, input.documentId],
    );

    return result.rows[0] ? mapDocument(result.rows[0]) : null;
  }

  /**
   * @description Implements the mark stored method for this service or adapter.
   * @param {{ readonly documentId: string }} input - Input value for input.
   * @param {TransactionContext} transaction - Input value for transaction.
   * @returns {Promise<ContractDocumentRecord>} Result of the mark stored operation.
   * @throws {Error} When validation, I/O, or downstream service operations fail.
   */
  async markStored(
    input: { readonly documentId: string },
    transaction: TransactionContext,
  ): Promise<ContractDocumentRecord> {
    const result = await transaction.client.query<ContractDocumentRow>(
      `
        UPDATE contract_documents
        SET upload_status = 'STORED',
            upload_error_code = NULL,
            upload_error_message = NULL,
            upload_failed_at = NULL,
            uploaded_at = NOW()
        WHERE id = $1
          AND upload_status = 'PENDING_UPLOAD'
        RETURNING *
      `,
      [input.documentId],
    );

    const row = result.rows[0];
    if (!row) {
      throw new Error("Contract document stored update returned no row");
    }
    return mapDocument(row);
  }

  /**
   * @description Implements the mark upload failed method for this service or adapter.
   * @param {{ readonly documentId: string; readonly errorCode: string; readonly errorMessage: string; }} input - Input value for input.
   * @param {TransactionContext} transaction - Input value for transaction.
   * @returns {Promise<ContractDocumentRecord>} Result of the mark upload failed operation.
   * @throws {Error} When validation, I/O, or downstream service operations fail.
   */
  async markUploadFailed(
    input: {
      readonly documentId: string;
      readonly errorCode: string;
      readonly errorMessage: string;
    },
    transaction: TransactionContext,
  ): Promise<ContractDocumentRecord> {
    const result = await transaction.client.query<ContractDocumentRow>(
      `
        UPDATE contract_documents
        SET upload_status = 'UPLOAD_FAILED',
            upload_error_code = $2,
            upload_error_message = $3,
            upload_failed_at = NOW()
        WHERE id = $1
          AND upload_status = 'PENDING_UPLOAD'
        RETURNING *
      `,
      [input.documentId, input.errorCode, input.errorMessage],
    );

    const row = result.rows[0];
    if (!row) {
      throw new Error("Contract document upload failure update returned no row");
    }
    return mapDocument(row);
  }
}

export class PostgresContractProcessingRepository implements ContractProcessingRepository {
  /**
   * @description Implements the constructor method for this service or adapter.
   * @param {PostgreSqlClient} database - Input value for database.
   * @returns {unknown} Result of the constructor operation.
   */
  constructor(private readonly database: PostgreSqlClient) {}

  /**
   * @description Executes the create run operation used by the application workflow.
   * @param {CreateContractProcessingRunInput} input - Input value for input.
   * @param {TransactionContext} transaction - Input value for transaction.
   * @returns {Promise<ContractProcessingRunRecord>} Result of the create run operation.
   * @throws {Error} When validation, I/O, or downstream service operations fail.
   */
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

  /**
   * @description Implements the mark queued method for this service or adapter.
   * @param {{ readonly processingRunId: string; readonly queueJobId: string; }} input - Input value for input.
   * @returns {Promise<ContractProcessingRunRecord>} Result of the mark queued operation.
   * @throws {Error} When validation, I/O, or downstream service operations fail.
   */
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

  /**
   * @description Implements the find latest by contract id method for this service or adapter.
   * @param {{ readonly organizationId: string; readonly contractId: string; }} input - Input value for input.
   * @returns {Promise<ContractProcessingRunRecord | null>} Result of the find latest by contract id operation.
   */
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

  /**
   * @description Implements the find by id method for this service or adapter.
   * @param {{ readonly organizationId: string; readonly processingRunId: string; }} input - Input value for input.
   * @returns {Promise<ContractProcessingRunRecord | null>} Result of the find by id operation.
   */
  async findById(input: {
    readonly organizationId: string;
    readonly processingRunId: string;
  }): Promise<ContractProcessingRunRecord | null> {
    const result = await this.database.query<ContractProcessingRunRow>(
      `
        SELECT run.*
        FROM contract_processing_runs AS run
        INNER JOIN contracts AS contract
          ON contract.id = run.contract_id
        WHERE contract.organization_id = $1
          AND run.id = $2
        LIMIT 1
      `,
      [input.organizationId, input.processingRunId],
    );

    return result.rows[0] ? mapProcessingRun(result.rows[0]) : null;
  }

  /**
   * @description Implements the claim for processing method for this service or adapter.
   * @param {ClaimContractProcessingRunInput} input - Input value for input.
   * @param {TransactionContext} transaction - Input value for transaction.
   * @returns {Promise<ContractProcessingRunRecord | null>} Result of the claim for processing operation.
   */
  async claimForProcessing(
    input: ClaimContractProcessingRunInput,
    transaction: TransactionContext,
  ): Promise<ContractProcessingRunRecord | null> {
    const result = await transaction.client.query<ContractProcessingRunRow>(
      `
        UPDATE contract_processing_runs AS run
        SET
          status = 'PROCESSING',
          queue_job_id = $5,
          started_at = NOW(),
          completed_at = NULL,
          failed_at = NULL,
          error_code = NULL,
          error_stage = NULL,
          error_message = NULL,
          error_retryable = NULL,
          updated_at = NOW()
        FROM contracts AS contract
        WHERE run.id = $1
          AND run.contract_id = $2
          AND run.document_id = $3
          AND contract.id = run.contract_id
          AND contract.organization_id = $4
          AND run.status = 'QUEUED'
          AND NOT EXISTS (
            SELECT 1
            FROM contract_processing_runs AS newer_run
            WHERE newer_run.contract_id = run.contract_id
              AND newer_run.created_at > run.created_at
          )
        RETURNING run.*
      `,
      [
        input.processingRunId,
        input.contractId,
        input.documentId,
        input.organizationId,
        input.queueJobId,
      ],
    );

    return result.rows[0] ? mapProcessingRun(result.rows[0]) : null;
  }

  /**
   * @description Implements the mark completed method for this service or adapter.
   * @param {CompleteContractProcessingRunInput} input - Input value for input.
   * @param {TransactionContext} transaction - Input value for transaction.
   * @returns {Promise<ContractProcessingRunRecord>} Result of the mark completed operation.
   */
  async markCompleted(
    input: CompleteContractProcessingRunInput,
    transaction: TransactionContext,
  ): Promise<ContractProcessingRunRecord> {
    return this.markTerminal("COMPLETED", input, transaction);
  }

  /**
   * @description Implements the mark review required method for this service or adapter.
   * @param {CompleteContractProcessingRunInput} input - Input value for input.
   * @param {TransactionContext} transaction - Input value for transaction.
   * @returns {Promise<ContractProcessingRunRecord>} Result of the mark review required operation.
   */
  async markReviewRequired(
    input: CompleteContractProcessingRunInput,
    transaction: TransactionContext,
  ): Promise<ContractProcessingRunRecord> {
    return this.markTerminal("REVIEW_REQUIRED", input, transaction);
  }

  /**
   * @description Implements the mark retryable failure method for this service or adapter.
   * @param {FailContractProcessingRunInput} input - Input value for input.
   * @param {TransactionContext} transaction - Input value for transaction.
   * @returns {Promise<ContractProcessingRunRecord>} Result of the mark retryable failure operation.
   * @throws {Error} When validation, I/O, or downstream service operations fail.
   */
  async markRetryableFailure(
    input: FailContractProcessingRunInput,
    transaction: TransactionContext,
  ): Promise<ContractProcessingRunRecord> {
    const result = await transaction.client.query<ContractProcessingRunRow>(
      `
        UPDATE contract_processing_runs AS run
        SET
          status = 'QUEUED',
          error_code = $5,
          error_stage = $6,
          error_message = $7,
          error_retryable = TRUE,
          updated_at = NOW()
        FROM contracts AS contract
        WHERE run.id = $1
          AND run.contract_id = $2
          AND run.document_id = $3
          AND contract.id = run.contract_id
          AND contract.organization_id = $4
          AND run.status IN ('PROCESSING', 'PARSING', 'OCR_PROCESSING', 'TEXT_SEGMENTED')
        RETURNING run.*
      `,
      [
        input.processingRunId,
        input.contractId,
        input.documentId,
        input.organizationId,
        input.errorCode,
        input.errorStage,
        input.message,
      ],
    );

    const row = result.rows[0];
    if (!row) {
      throw new Error("Processing run retryable failure update returned no row");
    }
    return mapProcessingRun(row);
  }

  /**
   * @description Implements the mark stage method for this service or adapter.
   * @param {MarkContractProcessingStageInput} input - Input value for input.
   * @param {TransactionContext} transaction - Input value for transaction.
   * @returns {Promise<ContractProcessingRunRecord>} Result of the mark stage operation.
   * @throws {Error} When validation, I/O, or downstream service operations fail.
   */
  async markStage(
    input: MarkContractProcessingStageInput,
    transaction: TransactionContext,
  ): Promise<ContractProcessingRunRecord> {
    const result = await transaction.client.query<ContractProcessingRunRow>(
      `
        UPDATE contract_processing_runs AS run
        SET
          status = $5,
          updated_at = NOW()
        FROM contracts AS contract
        WHERE run.id = $1
          AND run.contract_id = $2
          AND run.document_id = $3
          AND contract.id = run.contract_id
          AND contract.organization_id = $4
          AND run.status IN ('PROCESSING', 'PARSING')
        RETURNING run.*
      `,
      [
        input.processingRunId,
        input.contractId,
        input.documentId,
        input.organizationId,
        input.status,
      ],
    );

    const row = result.rows[0];
    if (!row) {
      throw new Error("Processing run stage update returned no row");
    }
    return mapProcessingRun(row);
  }

  /**
   * @description Implements the mark text segmented method for this service or adapter.
   * @param {CompleteContractProcessingRunInput} input - Input value for input.
   * @param {TransactionContext} transaction - Input value for transaction.
   * @returns {Promise<ContractProcessingRunRecord>} Result of the mark text segmented operation.
   * @throws {Error} When validation, I/O, or downstream service operations fail.
   */
  async markTextSegmented(
    input: CompleteContractProcessingRunInput,
    transaction: TransactionContext,
  ): Promise<ContractProcessingRunRecord> {
    const result = await transaction.client.query<ContractProcessingRunRow>(
      `
        UPDATE contract_processing_runs AS run
        SET
          status = 'TEXT_SEGMENTED',
          completed_at = NULL,
          failed_at = NULL,
          error_code = NULL,
          error_stage = NULL,
          error_message = NULL,
          error_retryable = NULL,
          updated_at = NOW()
        FROM contracts AS contract
        WHERE run.id = $1
          AND run.contract_id = $2
          AND run.document_id = $3
          AND contract.id = run.contract_id
          AND contract.organization_id = $4
          AND run.status IN ('PROCESSING', 'PARSING', 'OCR_PROCESSING', 'TEXT_SEGMENTED')
        RETURNING run.*
      `,
      [input.processingRunId, input.contractId, input.documentId, input.organizationId],
    );

    const row = result.rows[0];
    if (!row) {
      throw new Error("Processing run text segmented update returned no row");
    }
    return mapProcessingRun(row);
  }

  /**
   * @description Implements the mark failed method for this service or adapter.
   * @param {FailContractProcessingRunInput} input - Input value for input.
   * @param {TransactionContext} transaction - Input value for transaction.
   * @returns {Promise<ContractProcessingRunRecord>} Result of the mark failed operation.
   * @throws {Error} When validation, I/O, or downstream service operations fail.
   */
  async markFailed(
    input: FailContractProcessingRunInput,
    transaction: TransactionContext,
  ): Promise<ContractProcessingRunRecord> {
    const result = await transaction.client.query<ContractProcessingRunRow>(
      `
        UPDATE contract_processing_runs AS run
        SET
          status = 'FAILED',
          error_code = $5,
          error_stage = $6,
          error_message = $7,
          error_retryable = $8,
          failed_at = NOW(),
          completed_at = NOW(),
          updated_at = NOW()
        FROM contracts AS contract
        WHERE run.id = $1
          AND run.contract_id = $2
          AND run.document_id = $3
          AND contract.id = run.contract_id
          AND contract.organization_id = $4
          AND run.status IN ('PROCESSING', 'PARSING', 'OCR_PROCESSING')
        RETURNING run.*
      `,
      [
        input.processingRunId,
        input.contractId,
        input.documentId,
        input.organizationId,
        input.errorCode,
        input.errorStage,
        input.message,
        input.retryable,
      ],
    );

    const row = result.rows[0];
    if (!row) {
      throw new Error("Processing run failed update returned no row");
    }
    return mapProcessingRun(row);
  }

  /**
   * @description Implements the mark terminal method for this service or adapter.
   * @param {"COMPLETED" | "REVIEW_REQUIRED"} status - Input value for status.
   * @param {CompleteContractProcessingRunInput} input - Input value for input.
   * @param {TransactionContext} transaction - Input value for transaction.
   * @returns {Promise<ContractProcessingRunRecord>} Result of the mark terminal operation.
   * @throws {Error} When validation, I/O, or downstream service operations fail.
   */
  private async markTerminal(
    status: "COMPLETED" | "REVIEW_REQUIRED",
    input: CompleteContractProcessingRunInput,
    transaction: TransactionContext,
  ): Promise<ContractProcessingRunRecord> {
    const allowedSourceStatuses = ["PROCESSING", "PARSING", "OCR_PROCESSING", "TEXT_SEGMENTED"];
    const result = await transaction.client.query<ContractProcessingRunRow>(
      `
        UPDATE contract_processing_runs AS run
        SET
          status = $5,
          completed_at = NOW(),
          failed_at = NULL,
          error_code = NULL,
          error_stage = NULL,
          error_message = NULL,
          error_retryable = NULL,
          updated_at = NOW()
        FROM contracts AS contract
        WHERE run.id = $1
          AND run.contract_id = $2
          AND run.document_id = $3
          AND contract.id = run.contract_id
          AND contract.organization_id = $4
          AND run.status = ANY($6::text[])
        RETURNING run.*
      `,
      [
        input.processingRunId,
        input.contractId,
        input.documentId,
        input.organizationId,
        status,
        allowedSourceStatuses,
      ],
    );

    const row = result.rows[0];
    if (!row) {
      throw new Error(`Processing run ${status.toLowerCase()} update returned no row`);
    }
    return mapProcessingRun(row);
  }
}

export class PostgresDocumentTextPageRepository
  implements DocumentTextPageRepository, DocumentTextPageReadRepository
{
  /**
   * @description Implements the constructor method for this service or adapter.
   * @param {PostgreSqlClient} database - Input value for database.
   * @returns {unknown} Result of the constructor operation.
   */
  constructor(private readonly database: PostgreSqlClient) {}

  /**
   * @description Executes the list by contract operation used by the application workflow.
   * @param {{ readonly organizationId: string; readonly contractId: string; }} input - Input value for input.
   * @returns {Promise<readonly DocumentTextPageRecord[]>} Result of the list by contract operation.
   */
  async listByContract(input: {
    readonly organizationId: string;
    readonly contractId: string;
  }): Promise<readonly DocumentTextPageRecord[]> {
    const result = await this.database.query<DocumentTextPageRow>(
      `
        SELECT page.*
        FROM document_text_pages AS page
        INNER JOIN contracts AS contract
          ON contract.id = page.contract_id
          AND contract.organization_id = page.organization_id
          AND contract.current_document_id = page.document_id
        WHERE page.organization_id = $1
          AND page.contract_id = $2
        ORDER BY page.page_number ASC
      `,
      [input.organizationId, input.contractId],
    );

    return result.rows.map(mapDocumentTextPage);
  }

  /**
   * @description Implements the replace pages method for this service or adapter.
   * @param {PersistDocumentTextPagesInput} input - Input value for input.
   * @param {TransactionContext} transaction - Input value for transaction.
   * @returns {Promise<void>} Result of the replace pages operation.
   */
  async replacePages(
    input: PersistDocumentTextPagesInput,
    transaction: TransactionContext,
  ): Promise<void> {
    await transaction.client.query(
      `
        DELETE FROM document_text_pages
        WHERE document_id = $1
      `,
      [input.documentId],
    );

    for (const page of input.pages) {
      await transaction.client.query(
        `
          INSERT INTO document_text_pages (
            organization_id,
            contract_id,
            document_id,
            processing_run_id,
            page_number,
            extraction_method,
            raw_text,
            normalized_text,
            char_count,
            word_count,
            printable_ratio,
            ocr_confidence,
            page_width,
            page_height,
            segments,
            warnings
          )
          VALUES (
            $1,
            $2,
            $3,
            $4,
            $5,
            $6,
            $7,
            $8,
            $9,
            $10,
            $11,
            $12,
            $13,
            $14,
            $15::jsonb,
            $16::jsonb
          )
          ON CONFLICT (document_id, page_number)
          DO UPDATE SET
            processing_run_id = EXCLUDED.processing_run_id,
            extraction_method = EXCLUDED.extraction_method,
            raw_text = EXCLUDED.raw_text,
            normalized_text = EXCLUDED.normalized_text,
            char_count = EXCLUDED.char_count,
            word_count = EXCLUDED.word_count,
            printable_ratio = EXCLUDED.printable_ratio,
            ocr_confidence = EXCLUDED.ocr_confidence,
            page_width = EXCLUDED.page_width,
            page_height = EXCLUDED.page_height,
            segments = EXCLUDED.segments,
            warnings = EXCLUDED.warnings
        `,
        [
          input.organizationId,
          input.contractId,
          input.documentId,
          input.processingRunId,
          page.pageNumber,
          page.extractionMethod,
          page.rawText,
          page.normalizedText,
          page.charCount,
          page.wordCount,
          page.printableRatio,
          page.ocrConfidence ?? null,
          page.pageWidth ?? null,
          page.pageHeight ?? null,
          JSON.stringify(page.segments),
          JSON.stringify(page.warnings),
        ],
      );
    }
  }
}
