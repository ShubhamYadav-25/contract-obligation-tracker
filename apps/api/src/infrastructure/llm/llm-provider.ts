export interface LlmStructuredRequest {
  readonly prompt: string;
  readonly responseSchemaName: string;
  readonly model?: string;
  readonly systemInstruction?: string;
  readonly timeoutMilliseconds?: number;
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
