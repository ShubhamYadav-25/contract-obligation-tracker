import type {
  DocumentExtractionInput,
  DocumentTextExtractor,
  ParsedDocument,
} from "../../modules/document-processing/document-processing.types.js";
import { ExternalServiceError } from "../../shared/errors/external-service-error.js";
import { isProbablyPdf } from "./pdf-validator.js";

export class NativePdfTextExtractorAdapter implements DocumentTextExtractor {
  async extract(input: DocumentExtractionInput): Promise<ParsedDocument> {
    if (!isProbablyPdf(input.fileBytes)) {
      throw new ExternalServiceError("Input is not a valid PDF");
    }

    throw new ExternalServiceError("Native PDF extraction adapter is not wired yet", {
      contractId: input.contractId,
    });
  }
}
