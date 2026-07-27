import { z } from "zod";
import { apiRequest } from "@/services/api-client.js";

const nullableString = z.string().nullable();

export const contractProfileSchema = z.object({
  contractId: z.string(),
  parties: z.array(z.string()),
  contractValue: nullableString,
  currency: nullableString,
  effectiveDate: nullableString,
  expirationDate: nullableString,
  renewalType: nullableString,
  noticePeriodDays: z.number().nullable(),
  nextObligationSummary: nullableString,
  extractionConfidence: z.number().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const processingRunSchema = z.object({
  id: z.string(),
  documentId: z.string(),
  status: z.string(),
  attemptNumber: z.coerce.number(),
  queueJobId: nullableString,
  errorCode: nullableString,
  errorStage: nullableString,
  errorMessage: nullableString,
  startedAt: z.coerce.date().nullable(),
  completedAt: z.coerce.date().nullable(),
  failedAt: z.coerce.date().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

const activitySchema = z.object({
  items: z.array(z.object({
    id: z.string(),
    actorId: z.string(),
    actorType: z.string(),
    action: z.string(),
    entityType: z.string(),
    entityId: z.string(),
    previousData: z.unknown().nullable(),
    newData: z.unknown().nullable(),
    correlationId: z.string(),
    createdAt: z.coerce.date(),
  })),
  total: z.number(),
});

const dashboardOverviewSchema = z.object({
  kpis: z.object({
    totalContracts: z.number(),
    uploadedThisMonth: z.number(),
    processing: z.number(),
    awaitingReview: z.number(),
    lowConfidenceItems: z.number(),
    extracting: z.number(),
    queued: z.number(),
    dueSoon: z.number(),
    missed: z.number(),
    permanentAuditActionNeeded: z.number(),
  }),
  attentionRequired: z.array(z.object({
    id: z.string(),
    contractId: z.string(),
    type: z.string(),
    title: z.string(),
    contractName: z.string(),
    description: z.string().nullable(),
    timestamp: z.coerce.date(),
    action: z.string(),
  })),
  upcomingDeadlines: z.array(z.object({
    id: z.string(),
    contractId: z.string(),
    title: z.string(),
    contractName: z.string(),
    dueDate: z.coerce.date(),
    owner: z.string().nullable(),
    status: z.string(),
  })),
});

export function getContractProfile(contractId: string, signal?: AbortSignal) {
  return apiRequest(`/api/v1/contracts/${contractId}/profile`, {
    signal,
    responseSchema: contractProfileSchema,
  });
}

export interface SaveContractProfileInput {
  readonly contractId: string;
  readonly create: boolean;
  readonly parties: readonly string[];
  readonly contractValue: string | null;
  readonly currency: string | null;
  readonly effectiveDate: string | null;
  readonly expirationDate: string | null;
  readonly renewalType: string | null;
  readonly noticePeriodDays: number | null;
  readonly nextObligationSummary: string | null;
  readonly extractionConfidence: number | null;
}

export function saveContractProfile({ contractId, create, ...body }: SaveContractProfileInput) {
  return apiRequest(`/api/v1/contracts/${contractId}/profile`, {
    method: create ? "POST" : "PATCH",
    body,
    responseSchema: contractProfileSchema,
  });
}

export function getProcessingHistory(contractId: string, signal?: AbortSignal) {
  return apiRequest(`/api/v1/contracts/${contractId}/processing-history`, {
    signal,
    responseSchema: z.object({ items: z.array(processingRunSchema), total: z.number() }),
  });
}

export function getContractActivity(contractId: string, signal?: AbortSignal) {
  return apiRequest(`/api/v1/contracts/${contractId}/activity?limit=100&offset=0`, {
    signal,
    responseSchema: activitySchema,
  });
}

export function getDashboardOverview(signal?: AbortSignal) {
  return apiRequest("/api/v1/dashboard/overview", {
    signal,
    responseSchema: dashboardOverviewSchema,
  });
}
