export function evaluateExtractionConfidence(input: {
  readonly modelConfidence?: number;
  readonly validationIssueCount: number;
  readonly anchorCoverageRatio: number;
}): number {
  const baseConfidence = input.modelConfidence ?? 0.5;
  const validationPenalty = Math.min(input.validationIssueCount * 0.1, 0.4);
  const anchorPenalty = input.anchorCoverageRatio < 1 ? 0.2 : 0;
  return Math.max(0, Math.min(1, baseConfidence - validationPenalty - anchorPenalty));
}
