/**
 * @file Contains automated tests that verify contract tracker behavior.
 */
import { describe, expect, it } from "vitest";

import { ContractIngestionError } from "../../src/modules/contracts/contract-ingestion.errors.js";
import {
  sanitizeDisplayFilename,
  validateContractPdfFile,
} from "../../src/modules/contracts/contract-file-validator.js";
import { createContractStorageKey } from "../../src/modules/contracts/contract-storage-key.js";
import { FileHashService } from "../../src/modules/contracts/file-hash.service.js";

const validPdf = Buffer.from("%PDF-1.4\n1 0 obj\n<< /Type /Page >>\nendobj\n%%EOF");
const validation = {
  maxFileSizeBytes: 1024,
  maxPageCount: 10,
};

/**
 * @description Performs the file helper operation for this module.
 * @param {Partial<Parameters<typeof validateContractPdfFile>[0]>} overrides - Input value for overrides.
 * @returns {unknown} Result of the file operation.
 */
function file(overrides: Partial<Parameters<typeof validateContractPdfFile>[0]> = {}) {
  return {
    originalFilename: "vendor-contract.pdf",
    mimeType: "application/pdf",
    sizeBytes: validPdf.byteLength,
    body: validPdf,
    ...overrides,
  };
}

/**
 * @description Performs the expect code helper operation for this module.
 * @param {() => unknown} work - Input value for work.
 * @param {string} code - Input value for code.
 * @returns {unknown} Result of the expect code operation.
 * @throws {Error} When validation, I/O, or downstream service operations fail.
 */
function expectCode(work: () => unknown, code: string) {
  try {
    work();
  } catch (error) {
    expect(error).toBeInstanceOf(ContractIngestionError);
    expect((error as ContractIngestionError).code).toBe(code);
    return;
  }
  throw new Error("Expected validation error");
}

describe("contract PDF file validation", () => {
  it("rejects missing files", () => {
    expectCode(() => validateContractPdfFile(undefined, validation), "MISSING_CONTRACT_FILE");
  });

  it("rejects empty files", () => {
    expectCode(
      () => validateContractPdfFile(file({ sizeBytes: 0, body: Buffer.alloc(0) }), validation),
      "EMPTY_CONTRACT_FILE",
    );
  });

  it("rejects invalid extensions", () => {
    expectCode(
      () => validateContractPdfFile(file({ originalFilename: "contract.txt" }), validation),
      "UNSUPPORTED_DOCUMENT_TYPE",
    );
  });

  it("rejects invalid MIME types", () => {
    expectCode(
      () => validateContractPdfFile(file({ mimeType: "text/plain" }), validation),
      "UNSUPPORTED_DOCUMENT_TYPE",
    );
  });

  it("rejects invalid PDF magic bytes", () => {
    expectCode(
      () => validateContractPdfFile(file({ body: Buffer.from("not a pdf") }), validation),
      "INVALID_PDF_SIGNATURE",
    );
  });

  it("rejects files over the configured size limit", () => {
    expectCode(
      () => validateContractPdfFile(file({ sizeBytes: 2048 }), validation),
      "FILE_TOO_LARGE",
    );
  });

  it("sanitizes display filenames", () => {
    expect(sanitizeDisplayFilename("../vendor:<bad>.pdf")).toBe("vendor bad .pdf");
  });

  it("calculates SHA-256 hashes", () => {
    expect(new FileHashService().sha256(validPdf)).toMatch(/^[a-f0-9]{64}$/);
  });

  it("generates safe storage keys", () => {
    expect(
      createContractStorageKey({
        organizationId: "org",
        contractId: "contract",
        documentId: "document",
      }),
    ).toBe("organizations/org/contracts/contract/documents/document/original.pdf");
  });
});
