import { ExternalServiceError } from "../../shared/errors/external-service-error.js";
import type { LlmProvider, LlmStructuredRequest, LlmStructuredResponse } from "./llm-provider.js";

export class GeminiLlmAdapter implements LlmProvider {
  async generateStructured(input: LlmStructuredRequest): Promise<LlmStructuredResponse> {
    throw new ExternalServiceError("Gemini LLM adapter is not wired yet", {
      responseSchemaName: input.responseSchemaName,
    });
  }
}
