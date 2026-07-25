/**
 * @file Defines backend extraction module contracts, services, routes, or persistence logic.
 */
import type { Request, Response } from "express";
import { PgPoolClient } from "../../infrastructure/database/postgres-client.js";
import { createDatabaseConfig } from "../../config/database.js";
import { loadEnv } from "../../config/env.js";
import { PgTransactionManager } from "../../infrastructure/database/transaction-manager.js";
import { PostgresExtractionCandidateRepository } from "./postgres-extraction.repository.js";
import type { ExtractionCandidate } from "./extraction.types.js";

/**
 * @description Performs the to review candidate helper operation for this module.
 * @param {ExtractionCandidate} row - Input value for row.
 * @returns {unknown} Result of the to review candidate operation.
 */
function toReviewCandidate(row: ExtractionCandidate) {
  const extracted = row.extractedJson as any;
  const anchors: any[] = [];

  if (extracted && typeof extracted === "object") {
    if (Array.isArray(extracted.obligations)) {
      for (const obligation of extracted.obligations) {
        if (obligation && obligation.anchor) {
          anchors.push({
            pageNumber: obligation.anchor.page_number,
            startLine: obligation.anchor.line_offset,
            endLine: obligation.anchor.line_offset,
            quotedText: obligation.anchor.quoted_text,
          });
        }
      }
    }

    for (const fieldName of ["parties", "contractValue", "term", "renewal", "noticePeriod"]) {
      const field = extracted[fieldName];
      if (field && field.anchor) {
        anchors.push({
          pageNumber: field.anchor.page_number,
          startLine: field.anchor.line_offset,
          endLine: field.anchor.line_offset,
          quotedText: field.anchor.quoted_text,
        });
      }
    }
  }

  const title =
    (extracted && extracted.parties && extracted.parties.text) ||
    (extracted && extracted.obligations && extracted.obligations[0]?.text) ||
    "Extraction candidate";

  return {
    id: row.id,
    contractId: row.contractId,
    title,
    description: JSON.stringify(extracted),
    confidence: Math.round((Number(row.confidence) || 0) * 100),
    reviewReasons: row.validationIssues ?? [],
    sourceAnchors: anchors,
  };
}

export class ExtractionController {
  private readonly database = new PgPoolClient(createDatabaseConfig(loadEnv()));
  private readonly transactions = new PgTransactionManager(this.database.pool);
  private readonly candidates = new PostgresExtractionCandidateRepository(this.transactions);

  /**
   * @description Executes the list by contract operation used by the application workflow.
   * @param {Request} request - Input value for request.
   * @param {Response} response - Input value for response.
   * @returns {Promise<void>} Result of the list by contract operation.
   */
  async listByContract(request: Request, response: Response): Promise<void> {
    const contractId = Array.isArray(request.params.contractId)
      ? request.params.contractId[0]
      : request.params.contractId;
    const rows = await this.candidates.listByContract(contractId ?? "");
    response.json({ count: rows.length, items: rows });
  }

  /**
   * @description Executes the list all operation used by the application workflow.
   * @param {Request} request - Input value for request.
   * @param {Response} response - Input value for response.
   * @returns {Promise<void>} Result of the list all operation.
   */
  async listAll(request: Request, response: Response): Promise<void> {
    const rows = await this.candidates.listAll();
    response.json({ success: true, data: rows.map(toReviewCandidate) });
  }

  /**
   * @description Implements the detail method for this service or adapter.
   * @param {Request} request - Input value for request.
   * @param {Response} response - Input value for response.
   * @returns {Promise<void>} Result of the detail operation.
   */
  async detail(request: Request, response: Response): Promise<void> {
    const candidateId = Array.isArray(request.params.candidateId)
      ? request.params.candidateId[0]
      : request.params.candidateId;
    const candidate = await this.candidates.findPendingById(candidateId ?? "");
    if (!candidate) {
      response.status(404).json({
        success: false,
        error: {
          code: "NOT_FOUND",
          message: "Review candidate not found",
          details: { candidateId },
          correlationId: String(response.locals.correlationId ?? "unknown"),
        },
      });
      return;
    }

    response.json({ success: true, data: toReviewCandidate(candidate) });
  }

  /**
   * @description Executes the approve candidate operation used by the application workflow.
   * @param {Request} request - Input value for request.
   * @param {Response} response - Input value for response.
   * @returns {Promise<void>} Result of the approve candidate operation.
   */
  async approveCandidate(request: Request, response: Response): Promise<void> {
    const candidateId = Array.isArray(request.params.candidateId)
      ? request.params.candidateId[0]
      : request.params.candidateId;
    const candidate = await this.candidates.findPendingById(candidateId ?? "");
    if (!candidate) {
      response.status(404).json({ error: "not_found" });
      return;
    }

    // promote to obligations in a transaction: mark candidate approved and create obligation
    await this.transactions.inTransaction(async ({ client }) => {
      await client.query(
        `UPDATE extraction_candidates SET status = 'APPROVED', reviewed_at = NOW() WHERE id = $1`,
        [candidateId],
      );

      const extracted = candidate.extractedJson as any;
      // build anchors array from extracted fields anchors if present
      const anchors: any[] = [];
      if (extracted && typeof extracted === "object") {
        for (const key of Object.keys(extracted)) {
          const value = extracted[key];
          if (value && value.anchor) {
            anchors.push(value.anchor);
          }
        }
      }

      const title =
        extracted && extracted.parties && extracted.parties.text
          ? extracted.parties.text
          : (extracted && extracted.obligation_text) || "Extracted obligation";

      await client.query(
        `INSERT INTO obligations (contract_id, title, description, anchors) VALUES ($1, $2, $3, $4::jsonb)`,
        [candidate.contractId, title, JSON.stringify(extracted), JSON.stringify(anchors)],
      );
    });

    response.status(200).json({ success: true, data: { id: candidateId, status: "APPROVED" } });
  }

  /**
   * @description Executes the reject candidate operation used by the application workflow.
   * @param {Request} request - Input value for request.
   * @param {Response} response - Input value for response.
   * @returns {Promise<void>} Result of the reject candidate operation.
   */
  async rejectCandidate(request: Request, response: Response): Promise<void> {
    const candidateId = Array.isArray(request.params.candidateId)
      ? request.params.candidateId[0]
      : request.params.candidateId;
    const candidate = await this.candidates.findPendingById(candidateId ?? "");
    if (!candidate) {
      response.status(404).json({
        success: false,
        error: {
          code: "NOT_FOUND",
          message: "Review candidate not found",
          details: { candidateId },
          correlationId: String(response.locals.correlationId ?? "unknown"),
        },
      });
      return;
    }

    await this.candidates.markStatus(candidate.id, "REJECTED");

    response.status(200).json({
      success: true,
      data: {
        id: candidate.id,
        status: "REJECTED",
        reason:
          typeof request.body === "object" && request.body && "reason" in request.body
            ? String(request.body.reason)
            : null,
      },
    });
  }
}
