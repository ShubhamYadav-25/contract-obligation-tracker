/**
 * @file Defines backend document processing module contracts, services, routes, or persistence logic.
 */
import type { ParsedDocumentPage } from "./document-processing.types.js";
import { countWords, printableCharacterRatio } from "./text-normalizer.js";

export interface DocumentTextQualityConfig {
  readonly minCharacters: number;
  readonly minWords: number;
  readonly minPrintableRatio: number;
  readonly maxIsolatedTokenRatio: number;
}

export interface DocumentTextQuality {
  readonly charCount: number;
  readonly wordCount: number;
  readonly printableRatio: number;
  readonly isolatedTokenRatio: number;
  readonly usable: boolean;
  readonly warnings: readonly string[];
}

/**
 * @description Performs the evaluate text quality helper operation for this module.
 * @param {string} text - Input value for text.
 * @param {DocumentTextQualityConfig} config - Input value for config.
 * @returns {DocumentTextQuality} Result of the evaluate text quality operation.
 */
export function evaluateTextQuality(
  text: string,
  config: DocumentTextQualityConfig,
): DocumentTextQuality {
  const trimmedText = text.trim();
  const charCount = trimmedText.length;
  const wordCount = countWords(trimmedText);
  const printableRatio = printableCharacterRatio(trimmedText);
  const tokens = trimmedText.split(/\s+/).filter(Boolean);
  const isolatedTokenCount = tokens.filter((token) => token.length === 1).length;
  const isolatedTokenRatio = tokens.length > 0 ? isolatedTokenCount / tokens.length : 1;
  const warnings: string[] = [];

  if (charCount < config.minCharacters) {
    warnings.push("LOW_CHARACTER_COUNT");
  }
  if (wordCount < config.minWords) {
    warnings.push("LOW_WORD_COUNT");
  }
  if (printableRatio < config.minPrintableRatio) {
    warnings.push("LOW_PRINTABLE_RATIO");
  }
  if (isolatedTokenRatio > config.maxIsolatedTokenRatio) {
    warnings.push("EXCESSIVE_ISOLATED_TOKENS");
  }

  return {
    charCount,
    wordCount,
    printableRatio,
    isolatedTokenRatio,
    usable: warnings.length === 0,
    warnings,
  };
}

/**
 * @description Performs the page requires ocr helper operation for this module.
 * @param {Pick<ParsedDocumentPage, "normalizedText">} page - Input value for page.
 * @param {DocumentTextQualityConfig} config - Input value for config.
 * @returns {boolean} Result of the page requires ocr operation.
 */
export function pageRequiresOcr(
  page: Pick<ParsedDocumentPage, "normalizedText">,
  config: DocumentTextQualityConfig,
): boolean {
  return !evaluateTextQuality(page.normalizedText, config).usable;
}
