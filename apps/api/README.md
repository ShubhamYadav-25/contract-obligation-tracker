# API App

Node.js, Express, and TypeScript backend for the Contract & Obligation Tracker.

## Contract Upload

Endpoint:

```http
POST /api/v1/contracts
Content-Type: multipart/form-data
```

Required authentication context is provided by trusted request headers in local development:

- `x-user-id`
- `x-organization-id`

The request body must not provide organization or uploader IDs.

Multipart fields:

- `file`: required PDF file.
- `title`: optional display title. `displayName` is still accepted for existing clients.

Example:

```sh
curl -X POST "http://localhost:3000/api/v1/contracts" \
  -H "x-user-id: 00000000-0000-4000-8000-000000000002" \
  -H "x-organization-id: 00000000-0000-4000-8000-000000000001" \
  -F "title=Vendor Agreement" \
  -F "file=@/path/to/contract.pdf;type=application/pdf"
```

Validation:

- A file must be present.
- Only one `file` part is accepted.
- The sanitized filename must end in `.pdf`.
- Declared MIME type must be `application/pdf`.
- File bytes must begin with `%PDF-`.
- Empty files are rejected.
- Files larger than `CONTRACT_MAX_FILE_SIZE_MB` are rejected before permanent storage.
- Password-protected or incomplete PDFs are rejected by the upload validator.

Storage:

- The configured storage provider is used through `StorageProvider`.
- Supabase Storage uses `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `SUPABASE_STORAGE_BUCKET`.
- Buckets for legal documents must remain private.
- The object key is deterministic and tenant-scoped:

```text
organizations/{organizationId}/contracts/{contractId}/documents/{documentId}/original.pdf
```

Raw filenames are stored only as metadata and are never used as object keys.

Duplicate behavior:

- SHA-256 is calculated from the exact uploaded bytes.
- Duplicate detection is scoped to the authenticated organization.
- Active duplicate protection is enforced by the database over `(organization_id, file_hash_sha256)` for `PENDING_UPLOAD` and `STORED` documents.
- Duplicate uploads return the existing contract/document identifiers and do not upload another object.
- Failed upload attempts are marked `UPLOAD_FAILED` and can be retried safely.

Lifecycle:

```text
PENDING_UPLOAD -> STORED
PENDING_UPLOAD -> UPLOAD_FAILED
```

The API response follows the standard envelope:

```json
{
  "success": true,
  "data": {
    "contractId": "00000000-0000-4000-8000-000000000003",
    "documentId": "00000000-0000-4000-8000-000000000004",
    "processingRunId": "00000000-0000-4000-8000-000000000005",
    "status": "STORED",
    "uploadStatus": "stored",
    "isDuplicate": false,
    "duplicate": false,
    "originalFilename": "contract.pdf",
    "mimeType": "application/pdf",
    "sizeBytes": 123456,
    "checksumSha256": "64-character-hex-value",
    "createdAt": "2026-07-21T00:00:00.000Z"
  },
  "meta": {
    "requestId": "correlation-id"
  }
}
```

Parsing and extraction are not part of upload. The next boundary is:

```text
Stored Contract
      |
      v
PDF Parsing / OCR Processing
```
