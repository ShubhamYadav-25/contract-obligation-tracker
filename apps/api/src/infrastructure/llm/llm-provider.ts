export interface LlmStructuredRequest {
  readonly prompt: string;
  readonly responseSchemaName: string;
  readonly correlationId?: string;
}

export interface LlmStructuredResponse {
  readonly rawText: string;
  readonly parsedJson: unknown;
  readonly modelConfidence?: number;
}

export interface LlmProvider {
  generateStructured(input: LlmStructuredRequest): Promise<LlmStructuredResponse>;
}
