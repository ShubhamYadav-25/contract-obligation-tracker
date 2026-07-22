import type { TransactionManager } from "../../infrastructure/database/transaction-manager.js";
import type { ExtractionCandidate } from "./extraction.types.js";

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
  constructor(private readonly transactions: TransactionManager) {}

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

  async listByContract(contractId: string): Promise<ExtractionCandidate[]> {
    return this.transactions.inTransaction(async ({ client }) => {
      const result = await client.query(
        `SELECT id, contract_id, document_id, extracted_json, confidence, validation_issues, created_at, status, reviewed_at FROM extraction_candidates WHERE contract_id = $1 ORDER BY created_at DESC`,
        [contractId],
      );
      return result.rows.map((row: any) => mapCandidateRow(row));
    });
  }

  async listAll(): Promise<ExtractionCandidate[]> {
    return this.transactions.inTransaction(async ({ client }) => {
      const result = await client.query(
        `SELECT id, contract_id, document_id, extracted_json, confidence, validation_issues, created_at, status, reviewed_at FROM extraction_candidates ORDER BY created_at DESC`,
        [],
      );
      return result.rows.map((row: any) => mapCandidateRow(row));
    });
  }

  async markStatus(id: string, status: "APPROVED" | "REJECTED") {
    return this.transactions.inTransaction(async ({ client }) => {
      await client.query(
        `UPDATE extraction_candidates SET status = $2, reviewed_at = NOW() WHERE id = $1`,
        [id, status],
      );
    });
  }
}
