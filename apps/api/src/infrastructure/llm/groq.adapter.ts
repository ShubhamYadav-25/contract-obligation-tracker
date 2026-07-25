/**
 * @file Defines LLM infrastructure clients and structured response helpers.
 */
import { ExternalServiceError } from "../../shared/errors/external-service-error.js";
import type { LlmProvider, LlmStructuredRequest, LlmStructuredResponse } from "./llm-provider.js";

type GroqLlmAdapterConfig = {
  readonly apiKey?: string;
  readonly defaultModel: string;
  readonly endpointBaseUrl?: string;
  readonly temperature: number;
  readonly maxTokens: number;
};

type GroqErrorPayload = {
  readonly error?: {
    readonly message?: string;
    readonly type?: string;
    readonly code?: string;
  };
};

/**
 * @description Performs the safe parse json helper operation for this module.
 * @param {string} text - Input value for text.
 * @returns {unknown} Result of the safe parse json operation.
 */
function safeParseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/**
 * @description Performs the extract choice text helper operation for this module.
 * @param {unknown} payload - Input value for payload.
 * @returns {string} Result of the extract choice text operation.
 */
function extractChoiceText(payload: unknown): string {
  const choices = (payload as { choices?: unknown[] }).choices;
  const firstChoice = choices?.[0] as { message?: { content?: unknown } } | undefined;
  return typeof firstChoice?.message?.content === "string"
    ? firstChoice.message.content.trim()
    : "";
}

export class GroqLlmAdapter implements LlmProvider {
  private readonly apiKey: string | undefined;
  private readonly defaultModel: string;
  private readonly endpointBaseUrl: string;
  private readonly temperature: number;
  private readonly maxTokens: number;

  /**
   * @description Implements the constructor method for this service or adapter.
   * @param {GroqLlmAdapterConfig} config - Input value for config.
   * @returns {unknown} Result of the constructor operation.
   */
  constructor(config: GroqLlmAdapterConfig) {
    this.apiKey = config.apiKey;
    this.defaultModel = config.defaultModel;
    this.endpointBaseUrl = config.endpointBaseUrl ?? "https://api.groq.com/openai/v1";
    this.temperature = config.temperature;
    this.maxTokens = config.maxTokens;
  }

  /**
   * @description Implements the generate structured method for this service or adapter.
   * @param {LlmStructuredRequest} input - Input value for input.
   * @returns {Promise<LlmStructuredResponse>} Result of the generate structured operation.
   * @throws {Error} When validation, I/O, or downstream service operations fail.
   */
  async generateStructured(input: LlmStructuredRequest): Promise<LlmStructuredResponse> {
    if (!this.apiKey) {
      throw new ExternalServiceError("Groq API key is required for structured generation", {
        responseSchemaName: input.responseSchemaName,
        retryable: false,
      });
    }

    const model = input.model ?? this.defaultModel;
    const controller = new AbortController();
    const timeout =
      input.timeoutMilliseconds && input.timeoutMilliseconds > 0
        ? setTimeout(() => controller.abort(), input.timeoutMilliseconds)
        : undefined;

    try {
      const messages = [
        ...(input.systemInstruction
          ? [{ role: "system" as const, content: input.systemInstruction }]
          : []),
        { role: "user" as const, content: input.prompt },
      ];
      const response = await fetch(`${this.endpointBaseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${this.apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: this.temperature,
          max_tokens: this.maxTokens,
        }),
        signal: controller.signal,
      });

      const responseText = await response.text();
      if (!response.ok) {
        const errorPayload = safeParseJson(responseText) as GroqErrorPayload | undefined;
        throw new ExternalServiceError("Groq structured generation failed", {
          responseSchemaName: input.responseSchemaName,
          status: response.status,
          statusText: response.statusText,
          providerMessage: errorPayload?.error?.message,
          providerType: errorPayload?.error?.type,
          providerCode: errorPayload?.error?.code,
          retryable: [408, 429, 500, 502, 503, 504].includes(response.status),
        });
      }

      const payload = safeParseJson(responseText);
      const rawText = extractChoiceText(payload);
      if (!rawText) {
        throw new ExternalServiceError("Groq structured generation returned no text", {
          responseSchemaName: input.responseSchemaName,
          retryable: true,
        });
      }

      return {
        rawText,
        parsedJson: JSON.parse(rawText),
      };
    } catch (error) {
      if (error instanceof ExternalServiceError) {
        throw error;
      }
      if (error instanceof Error && error.name === "AbortError") {
        throw new ExternalServiceError("Groq structured generation timed out", {
          responseSchemaName: input.responseSchemaName,
          retryable: true,
        });
      }
      throw new ExternalServiceError("Groq structured generation failed", {
        responseSchemaName: input.responseSchemaName,
        message: error instanceof Error ? error.message : String(error),
        retryable: true,
      });
    } finally {
      if (timeout) {
        clearTimeout(timeout);
      }
    }
  }
}
