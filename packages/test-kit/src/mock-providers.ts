/**
 * @file Defines reusable test helpers, fixtures, and mock providers.
 */
export interface StorageProviderMock {
  putObject(key: string, body: Uint8Array): Promise<{ readonly key: string }>;
  getObject(key: string): Promise<Uint8Array>;
}

export interface OcrProviderMock {
  extractText(input: Uint8Array): Promise<{ readonly text: string; readonly confidence: number }>;
}

export interface ExtractionProviderMock<TInput, TOutput> {
  extract(input: TInput): Promise<TOutput>;
}

export interface ReminderProviderMock {
  enqueueReminder(input: { readonly obligationId: string; readonly runAt: Date }): Promise<void>;
}
