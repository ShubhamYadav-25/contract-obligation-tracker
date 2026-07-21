import { ConflictError } from "../../shared/errors/conflict-error.js";
import type { ContractRepository } from "./contracts.repository.js";
import type { ContractUploadMetadata } from "./contracts.types.js";

export class ContractService {
  constructor(private readonly contracts: ContractRepository) {}

  async prepareUpload(
    metadata: ContractUploadMetadata,
  ): Promise<{ readonly duplicateContractId?: string }> {
    const duplicate = await this.contracts.findBySha256(metadata.sha256);
    if (duplicate) {
      return { duplicateContractId: duplicate.id };
    }
    return {};
  }

  async ensureUniqueUpload(metadata: ContractUploadMetadata): Promise<void> {
    const duplicate = await this.contracts.findBySha256(metadata.sha256);
    if (duplicate) {
      throw new ConflictError("Contract already exists", { contractId: duplicate.id });
    }
  }
}
