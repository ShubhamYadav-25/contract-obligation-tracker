/**
 * @file Defines backend contracts module contracts, services, routes, or persistence logic.
 */
import { ConflictError } from "../../shared/errors/conflict-error.js";
import type { ContractRepository } from "./contracts.repository.js";
import type { ContractUploadMetadata } from "./contracts.types.js";

export class ContractService {
  /**
   * @description Implements the constructor method for this service or adapter.
   * @param {ContractRepository} contracts - Input value for contracts.
   * @returns {unknown} Result of the constructor operation.
   */
  constructor(private readonly contracts: ContractRepository) {}

  /**
   * @description Implements the prepare upload method for this service or adapter.
   * @param {ContractUploadMetadata} metadata - Input value for metadata.
   * @returns {Promise<{ readonly duplicateContractId?: string }>} Result of the prepare upload operation.
   */
  async prepareUpload(
    metadata: ContractUploadMetadata,
  ): Promise<{ readonly duplicateContractId?: string }> {
    const duplicate = await this.contracts.findBySha256(metadata.sha256);
    if (duplicate) {
      return { duplicateContractId: duplicate.id };
    }
    return {};
  }

  /**
   * @description Implements the ensure unique upload method for this service or adapter.
   * @param {ContractUploadMetadata} metadata - Input value for metadata.
   * @returns {Promise<void>} Result of the ensure unique upload operation.
   * @throws {Error} When validation, I/O, or downstream service operations fail.
   */
  async ensureUniqueUpload(metadata: ContractUploadMetadata): Promise<void> {
    const duplicate = await this.contracts.findBySha256(metadata.sha256);
    if (duplicate) {
      throw new ConflictError("Contract already exists", { contractId: duplicate.id });
    }
  }
}
