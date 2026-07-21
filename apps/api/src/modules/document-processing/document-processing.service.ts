import type {
  DocumentExtractionInput,
  DocumentTextExtractor,
  ParsedDocument,
} from "./document-processing.types.js";

export class DocumentProcessingService {
  constructor(private readonly extractor: DocumentTextExtractor) {}

  async parse(input: DocumentExtractionInput): Promise<ParsedDocument> {
    return this.extractor.extract(input);
  }
}
