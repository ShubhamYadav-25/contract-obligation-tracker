import type { PostgreSqlClient } from "../../infrastructure/database/postgres-client.js";
import type { ContractProfileRepository } from "./contract-profile.repository.js";
import type { ContractProfile, ContractProfileFields } from "./contract-profile.types.js";

interface ProfileRow {
  readonly contract_id: string;
  readonly parties: string[];
  readonly contract_value: string | null;
  readonly currency: string | null;
  readonly effective_date: string | null;
  readonly expiration_date: string | null;
  readonly renewal_type: string | null;
  readonly notice_period_days: number | null;
  readonly next_obligation_summary: string | null;
  readonly extraction_confidence: string | number | null;
  readonly created_at: Date;
  readonly updated_at: Date;
}

function mapRow(row: ProfileRow): ContractProfile {
  return {
    contractId: row.contract_id,
    parties: row.parties,
    contractValue: row.contract_value,
    currency: row.currency?.trim() ?? null,
    effectiveDate: row.effective_date,
    expirationDate: row.expiration_date,
    renewalType: row.renewal_type,
    noticePeriodDays: row.notice_period_days,
    nextObligationSummary: row.next_obligation_summary,
    extractionConfidence:
      row.extraction_confidence === null ? null : Number(row.extraction_confidence),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const returningColumns = `
  contract_id, parties, contract_value::text, currency, effective_date::text,
  expiration_date::text, renewal_type, notice_period_days, next_obligation_summary,
  extraction_confidence, created_at, updated_at
`;

export class PostgresContractProfileRepository implements ContractProfileRepository {
  constructor(private readonly database: PostgreSqlClient) {}

  async find(input: { readonly organizationId: string; readonly contractId: string }) {
    const result = await this.database.query<ProfileRow>(
      `SELECT ${returningColumns}
       FROM contract_profiles
       WHERE organization_id = $1 AND contract_id = $2`,
      [input.organizationId, input.contractId],
    );
    return result.rows[0] ? mapRow(result.rows[0]) : null;
  }

  async create(input: {
    readonly organizationId: string;
    readonly contractId: string;
    readonly fields: ContractProfileFields;
  }) {
    const result = await this.database.query<ProfileRow>(
      `INSERT INTO contract_profiles (
         contract_id, organization_id, parties, contract_value, currency, effective_date,
         expiration_date, renewal_type, notice_period_days, next_obligation_summary,
         extraction_confidence
       )
       SELECT $2, $1, $3::text[], $4::numeric, $5, $6::date, $7::date, $8, $9, $10, $11
       WHERE EXISTS (
         SELECT 1 FROM contracts WHERE id = $2 AND organization_id = $1
       )
       RETURNING ${returningColumns}`,
      [
        input.organizationId,
        input.contractId,
        input.fields.parties,
        input.fields.contractValue,
        input.fields.currency,
        input.fields.effectiveDate,
        input.fields.expirationDate,
        input.fields.renewalType,
        input.fields.noticePeriodDays,
        input.fields.nextObligationSummary,
        input.fields.extractionConfidence,
      ],
    );
    if (!result.rows[0]) throw new Error("CONTRACT_NOT_FOUND");
    return mapRow(result.rows[0]);
  }

  async update(input: {
    readonly organizationId: string;
    readonly contractId: string;
    readonly fields: Partial<ContractProfileFields>;
  }) {
    const existing = await this.find(input);
    if (!existing) return null;
    const merged: ContractProfileFields = {
      parties: input.fields.parties ?? existing.parties,
      contractValue: input.fields.contractValue === undefined ? existing.contractValue : input.fields.contractValue,
      currency: input.fields.currency === undefined ? existing.currency : input.fields.currency,
      effectiveDate: input.fields.effectiveDate === undefined ? existing.effectiveDate : input.fields.effectiveDate,
      expirationDate: input.fields.expirationDate === undefined ? existing.expirationDate : input.fields.expirationDate,
      renewalType: input.fields.renewalType === undefined ? existing.renewalType : input.fields.renewalType,
      noticePeriodDays: input.fields.noticePeriodDays === undefined ? existing.noticePeriodDays : input.fields.noticePeriodDays,
      nextObligationSummary: input.fields.nextObligationSummary === undefined ? existing.nextObligationSummary : input.fields.nextObligationSummary,
      extractionConfidence: input.fields.extractionConfidence === undefined ? existing.extractionConfidence : input.fields.extractionConfidence,
    };
    const result = await this.database.query<ProfileRow>(
      `UPDATE contract_profiles
       SET parties = $3::text[], contract_value = $4::numeric, currency = $5,
           effective_date = $6::date, expiration_date = $7::date, renewal_type = $8,
           notice_period_days = $9, next_obligation_summary = $10,
           extraction_confidence = $11, updated_at = NOW()
       WHERE organization_id = $1 AND contract_id = $2
       RETURNING ${returningColumns}`,
      [
        input.organizationId, input.contractId, merged.parties, merged.contractValue,
        merged.currency, merged.effectiveDate, merged.expirationDate, merged.renewalType,
        merged.noticePeriodDays, merged.nextObligationSummary, merged.extractionConfidence,
      ],
    );
    return result.rows[0] ? mapRow(result.rows[0]) : null;
  }

  async delete(input: { readonly organizationId: string; readonly contractId: string }) {
    const result = await this.database.query(
      "DELETE FROM contract_profiles WHERE organization_id = $1 AND contract_id = $2",
      [input.organizationId, input.contractId],
    );
    return result.rowCount > 0;
  }
}
