/**
 * @file Defines backend contracts module contracts, services, routes, or persistence logic.
 */
export {
  assertContractProcessingTransition,
  canTransitionContract,
} from "./contracts.state-machine.js";
export {
  PermanentContractProcessingError,
  RetryableContractProcessingError,
  ContractProcessingPipelineError,
} from "./contract-processing.errors.js";
export { ContractProcessingOrchestrator } from "./contract-processing-orchestrator.service.js";
export { PipelineNotConfigured } from "./contract-processing.pipeline.js";
export { ContractController } from "./contracts.controller.js";
export { createContractIngestionService } from "./contracts.dependencies.js";
export { ContractIngestionService } from "./contract-ingestion.service.js";
export { createContractRouter } from "./contracts.routes.js";
export { parseCuadManifest, resolveWorkingSubsetPath } from "./cuad-manifest.js";
export { FileHashService } from "./file-hash.service.js";
export type {
  ClaimContractProcessingRunInput,
  CompleteContractProcessingRunInput,
  ContractDocumentRepository,
  ContractProcessingRepository,
  ContractRepository,
  ContractWorkspaceRepository,
  DocumentTextPageReadRepository,
  FailContractProcessingRunInput,
} from "./contracts.repository.js";
export type { ProcessContractJobPayload } from "./contract-processing-job.schema.js";
export type {
  ContractProcessingPipeline,
  ContractProcessingPipelineResult,
} from "./contract-processing.pipeline.js";
export { ContractService } from "./contracts.service.js";
export type {
  ContractDocumentRecord,
  ContractDocumentUploadStatus,
  ContractProcessingRunRecord,
  ContractProcessingRunStatus,
  ContractRecord,
  ContractTextSummary,
  ContractTrackingResult,
  ContractUploadMetadata,
  ContractWorkspaceRecord,
  DocumentTextPageRecord,
} from "./contracts.types.js";
