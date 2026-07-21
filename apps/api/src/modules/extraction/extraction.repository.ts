import type { ExtractionCandidate } from "./extraction.types.js";

export interface ExtractionCandidateRepository {
  createPending(input: {
    readonly contractId: string;
    readonly extractedJson: unknown;
    readonly confidence: number;
    readonly validationIssues: readonly string[];
  }): Promise<ExtractionCandidate>;
  findPendingById(id: string): Promise<ExtractionCandidate | null>;
}
