import type { DocumentProcessingService } from "../../modules/document-processing/document-processing.service.js";
import type { BackgroundJob } from "../job.types.js";
import { PermanentJobError } from "../retry-policy.js";

export interface ContractProcessingPayload {
  readonly processingRunId: string;
  readonly contractId: string;
  readonly documentId: string;
  readonly organizationId: string;
}

function parsePayload(payload: unknown): ContractProcessingPayload {
  if (
    typeof payload === "object" &&
    payload !== null &&
    "processingRunId" in payload &&
    "contractId" in payload &&
    "documentId" in payload &&
    "organizationId" in payload &&
    typeof payload.processingRunId === "string" &&
    typeof payload.contractId === "string" &&
    typeof payload.documentId === "string" &&
    typeof payload.organizationId === "string"
  ) {
    return {
      processingRunId: payload.processingRunId,
      contractId: payload.contractId,
      documentId: payload.documentId,
      organizationId: payload.organizationId,
    };
  }

  throw new PermanentJobError("Invalid contract processing job payload");
}

export class ContractProcessingProcessor {
  constructor(private readonly documentProcessingService?: DocumentProcessingService) {}

  async process(job: BackgroundJob): Promise<void> {
    const payload = parsePayload(job.payload);
    void payload;
    void this.documentProcessingService;
    throw new Error("Contract processing workflow is not implemented yet");
  }
}
