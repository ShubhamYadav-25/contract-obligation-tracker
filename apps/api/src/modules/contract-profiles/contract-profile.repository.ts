import type { ContractProfile, ContractProfileFields } from "./contract-profile.types.js";

export interface ContractProfileRepository {
  find(input: { readonly organizationId: string; readonly contractId: string }): Promise<ContractProfile | null>;
  create(input: {
    readonly organizationId: string;
    readonly contractId: string;
    readonly fields: ContractProfileFields;
  }): Promise<ContractProfile>;
  update(input: {
    readonly organizationId: string;
    readonly contractId: string;
    readonly fields: Partial<ContractProfileFields>;
  }): Promise<ContractProfile | null>;
  delete(input: { readonly organizationId: string; readonly contractId: string }): Promise<boolean>;
}
