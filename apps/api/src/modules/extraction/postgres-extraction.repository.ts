/**
 * @file Defines backend extraction module contracts, services, routes, or persistence logic.
 */
import type { TransactionManager } from "../../infrastructure/database/transaction-manager.js";
import type { ExtractionCandidate } from "./extraction.types.js";

/**
 * @description Performs the map candidate row helper operation for this module.
 * @param {any} row - Input value for row.
 * @returns {ExtractionCandidate} Result of the map candidate row operation.
 */
function mapCandidateRow(row: any): ExtractionCandidate {
  const candidate: ExtractionCandidate = {
    id: row.id,
    contractId: row.contract_id,
    documentId: row.document_id,
    extractedJson: row.extracted_json,
    confidence: Number(row.confidence),
    validationIssues: row.validation_issues ?? [],
    createdAt: new Date(row.created_at),
    ...(row.status ? { status: row.status } : {}),
    ...(row.reviewed_at ? { reviewedAt: new Date(row.reviewed_at) } : {}),
  };

  return candidate;
}

export class PostgresExtractionCandidateRepository {
  /**
   * @description Implements the constructor method for this service or adapter.
   * @param {TransactionManager} transactions - Input value for transactions.
   * @returns {unknown} Result of the constructor operation.
   */
  constructor(private readonly transactions: TransactionManager) {}

  /**
   * @description Executes the create pending operation used by the application workflow.
   * @param {{ readonly contractId: string; readonly documentId: string; readonly extractedJson: unknown; readonly confidence: number; readonly validationIssues: readonly string[]; }} input - Input value for input.
   * @returns {Promise<ExtractionCandidate>} Result of the create pending operation.
   */
  async createPending(input: {
    readonly contractId: string;
    readonly documentId: string;
    readonly extractedJson: unknown;
    readonly confidence: number;
    readonly validationIssues: readonly string[];
  }): Promise<ExtractionCandidate> {
    return this.transactions.inTransaction(async ({ client }) => {
      const result = await client.query(
        `
          INSERT INTO extraction_candidates (contract_id, document_id, extracted_json, confidence, validation_issues)
          VALUES ($1, $2, $3::jsonb, $4, $5)
          RETURNING id, contract_id, document_id, extracted_json, confidence, validation_issues, created_at, status
        `,
        [
          input.contractId,
          input.documentId,
          input.extractedJson,
          input.confidence,
          input.validationIssues,
        ],
      );

      const row = result.rows[0];
      return mapCandidateRow(row);
    });
  }

  /**
   * @description Implements the find pending by id method for this service or adapter.
   * @param {string} id - Input value for id.
   * @returns {Promise<ExtractionCandidate | null>} Result of the find pending by id operation.
   */
  async findPendingById(id: string): Promise<ExtractionCandidate | null> {
    return this.transactions.inTransaction(async ({ client }) => {
      const result = await client.query(
        `SELECT id, contract_id, document_id, extracted_json, confidence, validation_issues, created_at, status, reviewed_at FROM extraction_candidates WHERE id = $1`,
        [id],
      );
      if (result.rowCount === 0) return null;
      return mapCandidateRow(result.rows[0]);
    });
  }

  async findPendingByIdForOrganization(
    id: string,
    organizationId: string,
  ): Promise<ExtractionCandidate | null> {
    return this.transactions.inTransaction(async ({ client }) => {
      const result = await client.query(
        `SELECT candidate.id, candidate.contract_id, candidate.document_id,
                candidate.extracted_json, candidate.confidence, candidate.validation_issues,
                candidate.created_at, candidate.status, candidate.reviewed_at
         FROM extraction_candidates candidate
         JOIN contracts contract ON contract.id = candidate.contract_id
         WHERE candidate.id = $1 AND contract.organization_id = $2
           AND candidate.status = 'PENDING_REVIEW'`,
        [id, organizationId],
      );
      return result.rowCount === 0 ? null : mapCandidateRow(result.rows[0]);
    });
  }

  /**
   * @description Executes the list by contract operation used by the application workflow.
   * @param {string} contractId - Input value for contract id.
   * @returns {Promise<ExtractionCandidate[]>} Result of the list by contract operation.
   */
  async listByContract(contractId: string): Promise<ExtractionCandidate[]> {
    return this.transactions.inTransaction(async ({ client }) => {
      const result = await client.query(
        `SELECT id, contract_id, document_id, extracted_json, confidence, validation_issues, created_at, status, reviewed_at FROM extraction_candidates WHERE contract_id = $1 ORDER BY created_at DESC`,
        [contractId],
      );
      return result.rows.map((row: any) => mapCandidateRow(row));
    });
  }

  async listByContractAndOrganization(
    contractId: string,
    organizationId: string,
  ): Promise<ExtractionCandidate[]> {
    return this.transactions.inTransaction(async ({ client }) => {
      const result = await client.query(
        `SELECT candidate.id, candidate.contract_id, candidate.document_id,
                candidate.extracted_json, candidate.confidence, candidate.validation_issues,
                candidate.created_at, candidate.status, candidate.reviewed_at
         FROM extraction_candidates candidate
         JOIN contracts contract ON contract.id = candidate.contract_id
         WHERE candidate.contract_id = $1 AND contract.organization_id = $2
         ORDER BY candidate.created_at DESC`,
        [contractId, organizationId],
      );
      return result.rows.map((row: any) => mapCandidateRow(row));
    });
  }

  /**
   * @description Executes the list all operation used by the application workflow.
   * @returns {Promise<ExtractionCandidate[]>} Result of the list all operation.
   */
  async listAll(): Promise<ExtractionCandidate[]> {
    return this.transactions.inTransaction(async ({ client }) => {
      const result = await client.query(
        `SELECT id, contract_id, document_id, extracted_json, confidence, validation_issues, created_at, status, reviewed_at FROM extraction_candidates ORDER BY created_at DESC`,
        [],
      );
      return result.rows.map((row: any) => mapCandidateRow(row));
    });
  }

  async listAllByOrganization(organizationId: string): Promise<ExtractionCandidate[]> {
    return this.transactions.inTransaction(async ({ client }) => {
      const result = await client.query(
        `SELECT candidate.id, candidate.contract_id, candidate.document_id,
                candidate.extracted_json, candidate.confidence, candidate.validation_issues,
                candidate.created_at, candidate.status, candidate.reviewed_at
         FROM extraction_candidates candidate
         JOIN contracts contract ON contract.id = candidate.contract_id
         WHERE contract.organization_id = $1 AND candidate.status = 'PENDING_REVIEW'
         ORDER BY candidate.created_at DESC`,
        [organizationId],
      );
      return result.rows.map((row: any) => mapCandidateRow(row));
    });
  }

  /**
   * @description Implements the mark status method for this service or adapter.
   * @param {string} id - Input value for id.
   * @param {"APPROVED" | "REJECTED"} status - Input value for status.
   * @returns {Promise<unknown>} Result of the mark status operation.
   */
  async markStatus(id: string, status: "APPROVED" | "REJECTED") {
    return this.transactions.inTransaction(async ({ client }) => {
      await client.query(
        `UPDATE extraction_candidates SET status = $2, reviewed_at = NOW() WHERE id = $1`,
        [id, status],
      );
    });
  }
}
