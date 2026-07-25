/**
 * @file Defines LLM infrastructure clients and structured response helpers.
 */
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

  /**
   * @description Implements the queue response method for this service or adapter.
   * @param {string} operationName - Input value for operation name.
   * @param {unknown} data - Input value for data.
   * @returns {void} Result of the queue response operation.
   */
  queueResponse(operationName: string, data: unknown): void {
    this.queue(operationName, { data });
  }

  /**
   * @description Implements the queue error method for this service or adapter.
   * @param {string} operationName - Input value for operation name.
   * @param {unknown} error - Input value for error.
   * @returns {void} Result of the queue error operation.
   */
  queueError(operationName: string, error: unknown): void {
    this.queue(operationName, { error });
  }

  /**
   * @description Implements the generate structured method for this service or adapter.
   * @param {StructuredLlmRequest<T>} request - Input value for request.
   * @returns {Promise<T>} Result of the generate structured operation.
   * @throws {Error} When validation, I/O, or downstream service operations fail.
   */
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

  /**
   * @description Implements the queue method for this service or adapter.
   * @param {string} operationName - Input value for operation name.
   * @param {QueuedFakeResponse} response - Input value for response.
   * @returns {void} Result of the queue operation.
   */
  private queue(operationName: string, response: QueuedFakeResponse): void {
    const responses = this.responsesByOperationName.get(operationName) ?? [];
    responses.push(response);
    this.responsesByOperationName.set(operationName, responses);
  }
}

/**
 * @description Performs the normalize queued data helper operation for this module.
 * @param {unknown} data - Input value for data.
 * @param {StructuredLlmRequest<T>} request - Input value for request.
 * @returns {unknown} Result of the normalize queued data operation.
 */
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
