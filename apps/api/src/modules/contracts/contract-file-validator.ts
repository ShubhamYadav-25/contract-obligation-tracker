/**
 * @file Defines backend contracts module contracts, services, routes, or persistence logic.
 */
import { extname } from "node:path";

import { ContractIngestionError } from "./contract-ingestion.errors.js";

export interface UploadedContractFile {
  readonly originalFilename: string;
  readonly mimeType: string;
  readonly sizeBytes: number;
  readonly body: Buffer;
}

export interface ContractFileValidationConfig {
  readonly maxFileSizeBytes: number;
  readonly maxPageCount: number;
}

export interface ValidatedContractFile extends UploadedContractFile {
  readonly sanitizedDisplayName: string;
}

const pdfMagicBytes = Buffer.from("%PDF-");

/**
 * @description Performs the sanitize display filename helper operation for this module.
 * @param {string} input - Input value for input.
 * @returns {string} Result of the sanitize display filename operation.
 */
export function sanitizeDisplayFilename(input: string): string {
  const withoutPath = input.replace(/\\/g, "/").split("/").at(-1) ?? "contract.pdf";
  const sanitized = withoutPath
    .replace(/[^\w .()[\]#,&@+-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return sanitized.length > 0 ? sanitized.slice(0, 255) : "contract.pdf";
}

/**
 * @description Performs the estimate page count helper operation for this module.
 * @param {Buffer} buffer - Input value for buffer.
 * @returns {number} Result of the estimate page count operation.
 */
function estimatePageCount(buffer: Buffer): number {
  const text = buffer.toString("latin1");
  const matches = text.match(/\/Type\s*\/Page\b/g);
  return matches?.length ?? 0;
}

/**
 * @description Performs the validate contract pdf file helper operation for this module.
 * @param {UploadedContractFile | undefined} file - Input value for file.
 * @param {ContractFileValidationConfig} config - Input value for config.
 * @returns {ValidatedContractFile} Result of the validate contract pdf file operation.
 * @throws {Error} When validation, I/O, or downstream service operations fail.
 */
export function validateContractPdfFile(
  file: UploadedContractFile | undefined,
  config: ContractFileValidationConfig,
): ValidatedContractFile {
  if (!file) {
    throw new ContractIngestionError("MISSING_CONTRACT_FILE", "Contract PDF file is required");
  }
  if (file.body.byteLength === 0 || file.sizeBytes === 0) {
    throw new ContractIngestionError("EMPTY_CONTRACT_FILE", "Contract PDF file is empty");
  }
  if (file.sizeBytes > config.maxFileSizeBytes) {
    throw new ContractIngestionError("FILE_TOO_LARGE", "Contract PDF exceeds size limit", 413, {
      maxFileSizeBytes: config.maxFileSizeBytes,
    });
  }

  const sanitizedDisplayName = sanitizeDisplayFilename(file.originalFilename);
  if (extname(sanitizedDisplayName).toLowerCase() !== ".pdf") {
    throw new ContractIngestionError(
      "UNSUPPORTED_DOCUMENT_TYPE",
      "Contract upload must use a .pdf file extension",
    );
  }
  if (file.mimeType !== "application/pdf") {
    throw new ContractIngestionError(
      "UNSUPPORTED_DOCUMENT_TYPE",
      "Contract upload must use application/pdf content type",
    );
  }
  if (!file.body.subarray(0, pdfMagicBytes.length).equals(pdfMagicBytes)) {
    throw new ContractIngestionError(
      "INVALID_PDF_SIGNATURE",
      "Contract file does not start with a valid PDF signature",
    );
  }

  const latin1 = file.body.toString("latin1");
  if (latin1.includes("/Encrypt")) {
    throw new ContractIngestionError(
      "PASSWORD_PROTECTED_PDF",
      "Password-protected PDFs are not supported",
    );
  }
  if (!latin1.includes("%%EOF")) {
    throw new ContractIngestionError("INVALID_PDF", "Contract file is not a complete PDF");
  }

  const estimatedPages = estimatePageCount(file.body);
  if (estimatedPages > config.maxPageCount) {
    throw new ContractIngestionError("INVALID_PDF", "Contract PDF exceeds page count limit", 400, {
      maxPageCount: config.maxPageCount,
      estimatedPages,
    });
  }

  return {
    ...file,
    sanitizedDisplayName,
  };
}
