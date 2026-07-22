import { createDatabaseConfig } from "../../config/database.js";
import { loadEnv } from "../../config/env.js";
import { PgPoolClient } from "../../infrastructure/database/postgres-client.js";
import { PgTransactionManager } from "../../infrastructure/database/transaction-manager.js";
import { PostgresExtractionCandidateRepository } from "./postgres-extraction.repository.js";
import { extractFieldsFromPages } from "./heuristics.js";

export class DeterministicExtractor {
  private readonly db = new PgPoolClient(createDatabaseConfig(loadEnv()));
  private readonly transactions = new PgTransactionManager(this.db.pool);
  private readonly candidatesRepo = new PostgresExtractionCandidateRepository(this.transactions);

  // Run structured extraction and persist a single candidate for the document.
  async run({ contractId, documentId, pages }: { contractId: string; documentId: string; pages: { pageNumber: number; rawText: string }[] }) {
    const results: { promoted?: any; candidate?: any } = {};

    // Build structured extraction locally first
    const { extraction, confidence } = extractFieldsFromPages(pages);

    // Persist candidate and, if confident, promote to obligation atomically
    await this.transactions.inTransaction(async ({ client }) => {
      const candidate = await this.candidatesRepo.createPending({
        contractId,
        documentId,
        extractedJson: extraction,
        confidence,
        validationIssues: [],
      });

      results.candidate = candidate;

      if (confidence >= 0.9) {
        // Prepare anchors: gather anchors from structured fields if present
        const anchors: any[] = [];
        const pushAnchor = (a: any) => {
          if (a && a.anchor) anchors.push(a.anchor);
          else if (a && a.page_number !== undefined) anchors.push(a);
        };

        if ((extraction.parties as any)?.anchor) pushAnchor((extraction.parties as any).anchor);
        if ((extraction.contractValue as any)?.anchor) pushAnchor((extraction.contractValue as any).anchor);
        if ((extraction.term as any)?.anchor) pushAnchor((extraction.term as any).anchor);
        if ((extraction.renewal as any)?.anchor) pushAnchor((extraction.renewal as any).anchor);
        if ((extraction.noticePeriod as any)?.anchor) pushAnchor((extraction.noticePeriod as any).anchor);
        if (Array.isArray(extraction.obligations)) {
          for (const o of extraction.obligations) pushAnchor(o.anchor);
        }

        const title = (extraction.parties && extraction.parties.text) || (extraction.obligations && extraction.obligations[0]?.text) || 'Extracted obligation';

        const insert = await client.query(
          `INSERT INTO obligations (contract_id, title, description, anchors) VALUES ($1, $2, $3, $4::jsonb) RETURNING id, contract_id, title, description, status, due_at, version`,
          [contractId, title, JSON.stringify(extraction), JSON.stringify(anchors)],
        );

        results.promoted = insert.rows[0];
        // Also mark candidate approved
        await this.candidatesRepo.markStatus(candidate.id, 'APPROVED');
      }
    });

    return results;
  }
}
