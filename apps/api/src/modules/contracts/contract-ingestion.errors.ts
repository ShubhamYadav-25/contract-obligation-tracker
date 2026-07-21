import { ApplicationError } from "../../shared/errors/application-error.js";

export type ContractIngestionErrorCode =
  | "MISSING_CONTRACT_FILE"
  | "EMPTY_CONTRACT_FILE"
  | "UNSUPPORTED_DOCUMENT_TYPE"
  | "FILE_TOO_LARGE"
  | "INVALID_PDF_SIGNATURE"
  | "INVALID_PDF"
  | "PASSWORD_PROTECTED_PDF"
  | "STORAGE_UPLOAD_FAILED"
  | "CONTRACT_PERSISTENCE_FAILED";

export class ContractIngestionError extends ApplicationError {
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

export function isUniqueViolation(error: unknown): boolean {
  return Boolean(
    typeof error === "object" && error !== null && "code" in error && error.code === "23505",
  );
}
