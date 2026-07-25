/**
 * @file Defines feature-level web application code for the contract tracker.
 */
export interface ReviewSourceAnchor {
  readonly pageNumber: number;
  readonly startLine: number;
  readonly endLine: number;
  readonly quotedText: string;
}

export interface ReviewCandidate {
  readonly id: string;
  readonly contractId: string;
  readonly title: string;
  readonly description: string;
  readonly confidence: number;
  readonly reviewReasons: readonly string[];
  readonly sourceAnchors: readonly ReviewSourceAnchor[];
}
