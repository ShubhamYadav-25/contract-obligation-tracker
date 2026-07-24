import { ExternalServiceError } from "../../shared/errors/external-service-error.js";
import type { StructuredLlmClient, StructuredLlmRequest } from "./structured-llm-client.js";
import { validateStructuredData } from "./structured-llm-client.js";

export interface FakeStructuredLlmPromptRecord {
  readonly operationName: string;
  readonly systemInstruction: string;
  readonly prompt: string;
  readonly jsonSchema: Record<string, unknown>;
}

type QueuedFakeResponse = { readonly data: unknown } | { readonly error: unknown };

export class FakeStructuredLlmClient implements StructuredLlmClient {
  private readonly responsesByOperationName = new Map<string, QueuedFakeResponse[]>();
  readonly prompts: FakeStructuredLlmPromptRecord[] = [];

  queueResponse(operationName: string, data: unknown): void {
    this.queue(operationName, { data });
  }

  queueError(operationName: string, error: unknown): void {
    this.queue(operationName, { error });
  }

  async generateStructured<T>(request: StructuredLlmRequest<T>): Promise<T> {
    this.prompts.push({
      operationName: request.operationName,
      systemInstruction: request.systemInstruction,
      prompt: request.prompt,
      jsonSchema: request.jsonSchema,
    });

    const nextResponse = this.responsesByOperationName.get(request.operationName)?.shift();
    if (!nextResponse) {
      throw new ExternalServiceError("No fake structured LLM response queued", {
        operationName: request.operationName,
        retryable: false,
      });
    }

    if ("error" in nextResponse) {
      throw nextResponse.error;
    }

    return validateStructuredData(
      normalizeQueuedData(nextResponse.data, request),
      request.validator,
      request.operationName,
    );
  }

  private queue(operationName: string, response: QueuedFakeResponse): void {
    const responses = this.responsesByOperationName.get(operationName) ?? [];
    responses.push(response);
    this.responsesByOperationName.set(operationName, responses);
  }
}

function normalizeQueuedData<T>(data: unknown, request: StructuredLlmRequest<T>): unknown {
  if (
    request.operationName !== "obligation_candidate_extraction" ||
    !data ||
    typeof data !== "object" ||
    !("candidates" in data) ||
    "windowResults" in data
  ) {
    return data;
  }

  const windowId = /WINDOW ID:\s*(\S+)/.exec(request.prompt)?.[1] ?? "fake_window";
  return {
    windowResults: [
      {
        windowId,
        obligations: (data as { readonly candidates: unknown }).candidates,
      },
    ],
  };
}
