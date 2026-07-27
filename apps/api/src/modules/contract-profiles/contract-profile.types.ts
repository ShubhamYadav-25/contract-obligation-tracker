export interface ContractProfile {
  readonly contractId: string;
  readonly parties: readonly string[];
  readonly contractValue: string | null;
  readonly currency: string | null;
  readonly effectiveDate: string | null;
  readonly expirationDate: string | null;
  readonly renewalType: string | null;
  readonly noticePeriodDays: number | null;
  readonly nextObligationSummary: string | null;
  readonly extractionConfidence: number | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface ContractProfileFields {
  readonly parties: readonly string[];
  readonly contractValue: string | null;
  readonly currency: string | null;
  readonly effectiveDate: string | null;
  readonly expirationDate: string | null;
  readonly renewalType: string | null;
  readonly noticePeriodDays: number | null;
  readonly nextObligationSummary: string | null;
  readonly extractionConfidence: number | null;
}
