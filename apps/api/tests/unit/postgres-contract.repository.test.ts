/**
 * @file Contains automated tests that verify contract tracker behavior.
 */
import { describe, expect, it, vi } from "vitest";

import { PostgresContractDocumentRepository } from "../../src/modules/contracts/postgres-contract.repository.js";

describe("PostgresContractDocumentRepository", () => {
  it("normalizes timestamp strings from nested JSON duplicate lookup rows", async () => {
    const uploadedAt = "2026-07-21T10:00:00.000Z";
    const database = {
      query: vi.fn(async () => ({
        rows: [
          {
            contract: {
              id: "00000000-0000-4000-8000-000000000003",
              organization_id: "00000000-0000-4000-8000-000000000001",
              uploaded_by: "00000000-0000-4000-8000-000000000002",
              display_name: "Existing Contract",
              external_ref: null,
              status: "DRAFT",
              current_document_id: "00000000-0000-4000-8000-000000000004",
              created_at: "2026-07-21T09:59:00.000Z",
              updated_at: "2026-07-21T09:59:00.000Z",
            },
            document: {
              id: "00000000-0000-4000-8000-000000000004",
              organization_id: "00000000-0000-4000-8000-000000000001",
              contract_id: "00000000-0000-4000-8000-000000000003",
              version_number: 1,
              original_filename: "contract.pdf",
              storage_provider: "supabase",
              storage_bucket: "contracts",
              storage_key: "organizations/org/contracts/contract/documents/document/original.pdf",
              mime_type: "application/pdf",
              file_size_bytes: "128",
              file_hash_sha256: "a".repeat(64),
              upload_status: "STORED",
              upload_error_code: null,
              upload_error_message: null,
              upload_failed_at: null,
              source_type: "USER_UPLOAD",
              source_reference: null,
              uploaded_by: "00000000-0000-4000-8000-000000000002",
              uploaded_at: uploadedAt,
            },
            processing_run: {
              id: "00000000-0000-4000-8000-000000000005",
              contract_id: "00000000-0000-4000-8000-000000000003",
              document_id: "00000000-0000-4000-8000-000000000004",
              status: "STORED",
              attempt_number: 1,
              queue_job_id: null,
              error_code: null,
              error_stage: null,
              error_message: null,
              error_retryable: null,
              started_at: null,
              completed_at: null,
              failed_at: null,
              created_at: "2026-07-21T10:00:01.000Z",
              updated_at: "2026-07-21T10:00:01.000Z",
            },
          },
        ],
      })),
    };

    const repository = new PostgresContractDocumentRepository(database as never);

    const duplicate = await repository.findByOrganizationAndHash({
      organizationId: "00000000-0000-4000-8000-000000000001",
      fileHashSha256: "a".repeat(64),
    });

    expect(duplicate?.document.uploadedAt).toBeInstanceOf(Date);
    expect(duplicate?.document.uploadedAt.toISOString()).toBe(uploadedAt);
    expect(duplicate?.document.fileSizeBytes).toBe(128);
    expect(duplicate?.contract.createdAt).toBeInstanceOf(Date);
    expect(duplicate?.processingRun?.createdAt).toBeInstanceOf(Date);
  });
});
