/**
 * @file Defines backend document processing module contracts, services, routes, or persistence logic.
 */
import type {
  DocumentExtractionInput,
  DocumentTextExtractor,
  ParsedDocument,
} from "./document-processing.types.js";

export class DocumentProcessingService {
  /**
   * @description Implements the constructor method for this service or adapter.
   * @param {DocumentTextExtractor} extractor - Input value for extractor.
   * @returns {unknown} Result of the constructor operation.
   */
  constructor(private readonly extractor: DocumentTextExtractor) {}

  /**
   * @description Implements the parse method for this service or adapter.
   * @param {DocumentExtractionInput} input - Input value for input.
   * @returns {Promise<ParsedDocument>} Result of the parse operation.
   */
  async parse(input: DocumentExtractionInput): Promise<ParsedDocument> {
    return this.extractor.extract(input);
  }
}
