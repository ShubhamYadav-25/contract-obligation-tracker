# Frontend API Action Map

This file documents the backend operation behind each visible workflow action.

| UI action               | Backend operation                                     | Request DTO                                                             | Response DTO                                                                                                                                                                                             | Affected query keys                                       |
| ----------------------- | ----------------------------------------------------- | ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| Upload Contract         | `POST /api/v1/contracts`                              | `multipart/form-data`: `file`, optional `title`, optional `externalRef` | Upload result: `contractId`, `documentId`, `processingRunId`, `status: "STORED"`, `uploadStatus`, `isDuplicate`, `duplicate`, `originalFilename`, `mimeType`, `sizeBytes`, `checksumSha256`, `createdAt` | `contracts.all`, `contracts.processingStatus(contractId)` |
| List Contracts          | `GET /api/v1/contracts`                               | optional `limit`, optional `offset`                                     | Contract list with `displayName`, current document, latest processing run, and text page/segment/OCR counts                                                                                              | `contracts.all`                                           |
| Open Contract           | `GET /api/v1/contracts/:contractId`                   | `contractId` path parameter                                             | Contract detail with current document, latest processing run, and text page/segment/OCR counts                                                                                                           | `contracts.detail(contractId)`                            |
| Watch Processing Status | `GET /api/v1/contracts/:contractId/processing-status` | `contractId` path parameter                                             | `contractId`, `documentId`, `processingRunId`, `status`, `attemptNumber`, `queueJobId`, `errorCode`, `errorStage`, `errorMessage`                                                                        | `contracts.processingStatus(contractId)`                  |
| View Parsed Text        | `GET /api/v1/contracts/:contractId/text-pages`        | `contractId` path parameter                                             | `contractId`, plus page-aware parsed/OCR text pages with line segments, extraction method, quality counts, OCR confidence, and warnings                                                                  | `contracts.textPages(contractId)`                         |

Unsupported by registered backend routes as of this UI implementation:

- Retry processing endpoint.
- Download original or signed PDF viewing endpoint.
- Review candidate list, approve, edit-and-approve, and reject endpoints.
- Source-anchor PDF navigation endpoint.
- Obligation detail and transition endpoints.
- Reminder history endpoint.
- Contract activity or audit timeline endpoint.
