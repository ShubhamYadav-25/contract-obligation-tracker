# Frontend API Action Map

This file documents the backend operation behind each visible workflow action.

| UI action               | Backend operation                                     | Request DTO                                                             | Response DTO                                                                                                                                                                                             | Affected query keys                                       |
| ----------------------- | ----------------------------------------------------- | ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| Upload Contract         | `POST /api/v1/contracts`                              | `multipart/form-data`: `file`, optional `title`, optional `externalRef` | Upload result: `contractId`, `documentId`, `processingRunId`, `status: "STORED"`, `uploadStatus`, `isDuplicate`, `duplicate`, `originalFilename`, `mimeType`, `sizeBytes`, `checksumSha256`, `createdAt` | `contracts.all`, `contracts.processingStatus(contractId)` |
| Watch Processing Status | `GET /api/v1/contracts/:contractId/processing-status` | `contractId` path parameter                                             | `contractId`, `documentId`, `processingRunId`, `status`, `attemptNumber`, `queueJobId`, `errorCode`, `errorMessage`                                                                                      | `contracts.processingStatus(contractId)`                  |

Unsupported by registered backend routes as of this UI implementation:

- Contract list and contract detail endpoints.
- Automatic parsing, OCR, extraction, or queue enqueueing from the upload endpoint.
- Retry processing endpoint.
- Download original or signed PDF viewing endpoint.
- Review candidate list, approve, edit-and-approve, and reject endpoints.
- Source-anchor PDF navigation endpoint.
- Obligation detail and transition endpoints.
- Reminder history endpoint.
- Contract activity or audit timeline endpoint.
