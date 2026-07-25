/**
 * @file Defines backend contracts module contracts, services, routes, or persistence logic.
 */
import { ApplicationError } from "../../shared/errors/application-error.js";

export type ContractIngestionErrorCode =
  | "MISSING_CONTRACT_FILE"
  | "EMPTY_CONTRACT_FILE"
  | "UNSUPPORTED_DOCUMENT_TYPE"
  | "FILE_TOO_LARGE"
  | "INVALID_PDF_SIGNATURE"
  | "INVALID_PDF"
  | "PASSWORD_PROTECTED_PDF"
  | "MALFORMED_MULTIPART"
  | "STORAGE_UPLOAD_FAILED"
  | "CONTRACT_PERSISTENCE_FAILED";

export class ContractIngestionError extends ApplicationError {
  /**
   * @description Implements the constructor method for this service or adapter.
   * @param {ContractIngestionErrorCode} code - Input value for code.
   * @param {string} message - Input value for message.
   * @param {unknown} statusCode - Input value for status code.
   * @param {Record<string, unknown>} details - Input value for details.
   * @returns {unknown} Result of the constructor operation.
   */
  constructor(
    code: ContractIngestionErrorCode,
    message: string,
    statusCode = 400,
    details?: Record<string, unknown>,
  ) {
    super({
      code,
      message,
      statusCode,
      ...(details ? { details } : {}),
    });
  }
}

/**
 * @description Performs the is unique violation helper operation for this module.
 * @param {unknown} error - Input value for error.
 * @returns {boolean} Result of the is unique violation operation.
 */
export function isUniqueViolation(error: unknown): boolean {
  return Boolean(
    typeof error === "object" && error !== null && "code" in error && error.code === "23505",
  );
}
