import { z } from "zod";

import type { StructuredLlmClient } from "../../../infrastructure/llm/structured-llm-client.js";
import type { DocumentTextSegment } from "../../document-processing/document-processing.types.js";
import type {
  ContractContext,
  ContractKeyDate,
  ContractParty,
  DefinedTerm,
  ReferenceResolutionStatus,
  SourceLineRange,
} from "./reference-aware-extraction.schemas.js";
import { referenceResolutionStatusSchema } from "./reference-aware-extraction.schemas.js";
import type { DetectedCandidateWindow } from "./candidate-window-detector.js";
import type {
  ContractSourceIndex,
  ContractSourceLine,
  ContractSourceVerificationError,
  ResolvedEvidenceSpan,
} from "./source-index.js";

export interface ContractStructureHint {
  readonly heading: string;
  readonly sectionPath: readonly string[];
  readonly startGlobalLine: number;
  readonly endGlobalLine: number;
  readonly reliable: boolean;
}

export interface ContractContextExtractorConfig {
  readonly introductoryPageCount: number;
  readonly maxPromptLineCount: number;
  readonly maxPromptCharacters: number;
  readonly includeSectionStructureWhenReliable: boolean;
}

export interface ContractContextExtractorInput {
  readonly sourceIndex: ContractSourceIndex;
  readonly segments?: readonly DocumentTextSegment[];
  readonly sectionHints?: readonly ContractStructureHint[];
}

export interface VerifiedContextSource {
  readonly globalStartLine: number;
  readonly globalEndLine: number;
  readonly pageRange: SourceLineRange;
  readonly exactQuote: string;
}

export interface VerifiedContractParty extends ContractParty {
  readonly sourceReference: VerifiedContextSource;
}

export interface VerifiedDefinedTerm extends DefinedTerm {
  readonly sourceReference: VerifiedContextSource;
}

export interface VerifiedContractKeyDate extends ContractKeyDate {
  readonly sourceReference: VerifiedContextSource;
}

export interface VerifiedContractSectionHeading {
  readonly heading: string;
  readonly sectionPath: readonly string[];
  readonly sourceReference: VerifiedContextSource;
}

export type ContractContextRejectedItemType =
  | "party"
  | "defined_term"
  | "key_date"
  | "section_heading";

export interface ContractContextRejectedItem {
  readonly type: ContractContextRejectedItemType;
  readonly label: string;
  readonly startLine: number;
  readonly endLine: number;
  readonly errors: readonly ContractSourceVerificationError[];
}

export interface ContractContextExtractionResult {
  readonly context: ContractContext;
  readonly parties: readonly VerifiedContractParty[];
  readonly definedTerms: readonly VerifiedDefinedTerm[];
  readonly keyDates: readonly VerifiedContractKeyDate[];
  readonly sectionHeadings: readonly VerifiedContractSectionHeading[];
  readonly rejectedItems: readonly ContractContextRejectedItem[];
}

export interface CanonicalPartyMapEntry {
  readonly canonicalName: string;
  readonly roleLabel: string;
  readonly aliases: readonly string[];
}

export interface RelevantContextSelection {
  readonly canonicalPartyMap: readonly CanonicalPartyMapEntry[];
  readonly parties: readonly VerifiedContractParty[];
  readonly definedTerms: readonly VerifiedDefinedTerm[];
  readonly keyDates: readonly VerifiedContractKeyDate[];
}

export interface RelevantContextSelectorConfig {
  readonly nearbyLineCount: number;
}

const defaultContextExtractorConfig: ContractContextExtractorConfig = {
  introductoryPageCount: 3,
  maxPromptLineCount: 120,
  maxPromptCharacters: 16_000,
  includeSectionStructureWhenReliable: false,
};

const defaultRelevantContextConfig: RelevantContextSelectorConfig = {
  nearbyLineCount: 3,
};

const globalSourceSpanSchema = z
  .object({
    startLine: z.number().int().positive(),
    endLine: z.number().int().positive(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.startLine > value.endLine) {
      context.addIssue({
        code: "custom",
        path: ["startLine"],
        message: "startLine must be less than or equal to endLine",
      });
    }
  });

const rawContractPartySchema = z
  .object({
    roleLabel: z.string().trim().min(1),
    canonicalName: z.string().trim().min(1),
    aliases: z.array(z.string().trim().min(1)).default([]),
    sourceSpan: globalSourceSpanSchema,
  })
  .strict();

const rawDefinedTermSchema = z
  .object({
    term: z.string().trim().min(1),
    definition: z.string().trim().min(1).nullable(),
    referencedSection: z.string().trim().min(1).nullable(),
    referencedExhibit: z.string().trim().min(1).nullable(),
    resolutionStatus: referenceResolutionStatusSchema,
    sourceSpan: globalSourceSpanSchema,
  })
  .strict();

const rawKeyDateSchema = z
  .object({
    label: z.string().trim().min(1),
    rawValue: z.string().trim().min(1),
    normalizedValue: z.string().trim().min(1).nullable(),
    sourceSpan: globalSourceSpanSchema,
  })
  .strict();

const rawSectionHeadingSchema = z
  .object({
    heading: z.string().trim().min(1),
    sectionPath: z.array(z.string().trim().min(1)).default([]),
    sourceSpan: globalSourceSpanSchema,
  })
  .strict();

const rawContractContextExtractionSchema = z
  .object({
    parties: z.array(rawContractPartySchema).default([]),
    definedTerms: z.array(rawDefinedTermSchema).default([]),
    keyDates: z.array(rawKeyDateSchema).default([]),
    sectionHeadings: z.array(rawSectionHeadingSchema).default([]),
  })
  .strict();

type RawContractContextExtraction = z.infer<typeof rawContractContextExtractionSchema>;

const contractContextJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    parties: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          roleLabel: { type: "string" },
          canonicalName: { type: "string" },
          aliases: { type: "array", items: { type: "string" } },
          sourceSpan: {
            type: "object",
            additionalProperties: false,
            properties: {
              startLine: { type: "integer" },
              endLine: { type: "integer" },
            },
            required: ["startLine", "endLine"],
          },
        },
        required: ["roleLabel", "canonicalName", "aliases", "sourceSpan"],
      },
    },
    definedTerms: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          term: { type: "string" },
          definition: { type: ["string", "null"] },
          referencedSection: { type: ["string", "null"] },
          referencedExhibit: { type: ["string", "null"] },
          resolutionStatus: {
            type: "string",
            enum: ["RESOLVED", "PARTIALLY_RESOLVED", "UNRESOLVED", "AMBIGUOUS"],
          },
          sourceSpan: {
            type: "object",
            additionalProperties: false,
            properties: {
              startLine: { type: "integer" },
              endLine: { type: "integer" },
            },
            required: ["startLine", "endLine"],
          },
        },
        required: [
          "term",
          "definition",
          "referencedSection",
          "referencedExhibit",
          "resolutionStatus",
          "sourceSpan",
        ],
      },
    },
    keyDates: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          label: { type: "string" },
          rawValue: { type: "string" },
          normalizedValue: { type: ["string", "null"] },
          sourceSpan: {
            type: "object",
            additionalProperties: false,
            properties: {
              startLine: { type: "integer" },
              endLine: { type: "integer" },
            },
            required: ["startLine", "endLine"],
          },
        },
        required: ["label", "rawValue", "normalizedValue", "sourceSpan"],
      },
    },
    sectionHeadings: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          heading: { type: "string" },
          sectionPath: { type: "array", items: { type: "string" } },
          sourceSpan: {
            type: "object",
            additionalProperties: false,
            properties: {
              startLine: { type: "integer" },
              endLine: { type: "integer" },
            },
            required: ["startLine", "endLine"],
          },
        },
        required: ["heading", "sectionPath", "sourceSpan"],
      },
    },
  },
  required: ["parties", "definedTerms", "keyDates", "sectionHeadings"],
} satisfies Record<string, unknown>;

function selectedLinesFromSource(
  input: ContractContextExtractorInput,
  config: ContractContextExtractorConfig,
): readonly ContractSourceLine[] {
  const selected = new Map<number, ContractSourceLine>();
  const reliableStructure = hasReliableStructure(input);
  const includeStructure = config.includeSectionStructureWhenReliable || !reliableStructure;

  for (const line of input.sourceIndex.lines) {
    const sectionText = line.sectionPath.join(" ").toLowerCase();
    const text = line.normalizedText.toLowerCase();
    const isIntroductory = line.pageNumber <= config.introductoryPageCount;
    const isDefinitionOrTermSection =
      /\b(definition|defined terms|term|renewal|notice|exhibit|schedule)\b/.test(sectionText) ||
      /\b(section|article|exhibit|schedule)\b.*\b(definition|term|renewal|notice)\b/.test(text);
    const looksLikeReferenceContext =
      /\b(?:effective date|commencement date|renewal date|term|has the meaning|means|by and between)\b/i.test(
        line.normalizedText,
      );

    if (isIntroductory || isDefinitionOrTermSection || looksLikeReferenceContext) {
      selected.set(line.globalLineNumber, line);
    }

    if (includeStructure && /^(?:section|article|schedule|exhibit)\b/i.test(line.normalizedText)) {
      selected.set(line.globalLineNumber, line);
    }
  }

  for (const section of input.sectionHints ?? []) {
    if (section.reliable && !config.includeSectionStructureWhenReliable) {
      continue;
    }
    for (let lineNumber = section.startGlobalLine; lineNumber <= section.endGlobalLine; lineNumber += 1) {
      const line = input.sourceIndex.getLine(lineNumber);
      if (line) {
        selected.set(lineNumber, line);
      }
    }
  }

  for (const segment of input.segments ?? []) {
    const sectionPath = (segment as { readonly sectionPath?: readonly string[] }).sectionPath ?? [];
    const segmentText = `${sectionPath.join(" ")} ${segment.normalizedText || segment.text}`;
    if (!/\b(definition|defined terms|term|renewal|notice|exhibit|schedule)\b/i.test(segmentText)) {
      continue;
    }
    for (const line of input.sourceIndex.lines) {
      if (
        line.pageNumber === segment.pageNumber &&
        line.pageLocalLineNumber !== null &&
        line.pageLocalLineNumber >= segment.lineStart &&
        line.pageLocalLineNumber <= segment.lineEnd
      ) {
        selected.set(line.globalLineNumber, line);
      }
    }
  }

  const bounded: ContractSourceLine[] = [];
  let characterCount = 0;
  for (const line of [...selected.values()].sort((left, right) => left.globalLineNumber - right.globalLineNumber)) {
    const nextCharacterCount = characterCount + line.normalizedText.length + (bounded.length > 0 ? 1 : 0);
    if (
      bounded.length >= config.maxPromptLineCount ||
      nextCharacterCount > config.maxPromptCharacters
    ) {
      break;
    }
    bounded.push(line);
    characterCount = nextCharacterCount;
  }

  return bounded;
}

function hasReliableStructure(input: ContractContextExtractorInput): boolean {
  return (
    (input.sectionHints?.some((section) => section.reliable) ?? false) ||
    input.sourceIndex.lines.some((line) => line.sectionPath.length > 0)
  );
}

function renderSourceLinesForPrompt(lines: readonly ContractSourceLine[]): string {
  return lines
    .map((line) => {
      const pageLocalLine =
        line.pageLocalLineNumber !== null ? `L${line.pageLocalLineNumber}` : "L?";
      const sectionPath =
        line.sectionPath.length > 0 ? ` [${line.sectionPath.join(" > ")}]` : "";
      return `G${line.globalLineNumber} P${line.pageNumber}:${pageLocalLine}${sectionPath} ${line.normalizedText}`;
    })
    .join("\n");
}

function toVerifiedSource(
  sourceIndex: ContractSourceIndex,
  startLine: number,
  endLine: number,
): VerifiedContextSource | null {
  const resolved = sourceIndex.resolveEvidenceSpan(startLine, endLine);
  if (hasInvalidSpan(resolved)) {
    return null;
  }

  const firstLine = resolved.sourceLines[0];
  const lastLine = resolved.sourceLines[resolved.sourceLines.length - 1];
  if (!firstLine || !lastLine || firstLine.pageNumber !== lastLine.pageNumber) {
    return null;
  }

  return {
    globalStartLine: startLine,
    globalEndLine: endLine,
    pageRange: {
      pageNumber: firstLine.pageNumber,
      startLine: firstLine.pageLocalLineNumber ?? firstLine.globalLineNumber,
      endLine: lastLine.pageLocalLineNumber ?? lastLine.globalLineNumber,
    },
    exactQuote: resolved.exactQuote,
  };
}

function hasInvalidSpan(resolved: ResolvedEvidenceSpan): boolean {
  return resolved.verificationErrors.length > 0 || resolved.exactQuote.length === 0;
}

function rejectedItem(input: {
  readonly sourceIndex: ContractSourceIndex;
  readonly type: ContractContextRejectedItemType;
  readonly label: string;
  readonly startLine: number;
  readonly endLine: number;
}): ContractContextRejectedItem {
  return {
    type: input.type,
    label: input.label,
    startLine: input.startLine,
    endLine: input.endLine,
    errors: input.sourceIndex.resolveEvidenceSpan(input.startLine, input.endLine).verificationErrors,
  };
}

function normalizeAliases(aliases: readonly string[], canonicalName: string): string[] {
  return [...new Set(aliases.filter((alias) => alias !== canonicalName))].sort((left, right) =>
    left.localeCompare(right),
  );
}

function containsTerm(text: string, term: string): boolean {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^A-Za-z0-9])${escaped}([^A-Za-z0-9]|$)`, "i").test(text);
}

export class ContractContextExtractor {
  private readonly llm: StructuredLlmClient;
  private readonly config: ContractContextExtractorConfig;

  constructor(input: {
    readonly llm: StructuredLlmClient;
    readonly config?: Partial<ContractContextExtractorConfig>;
  }) {
    this.llm = input.llm;
    this.config = { ...defaultContextExtractorConfig, ...input.config };
  }

  async extract(input: ContractContextExtractorInput): Promise<ContractContextExtractionResult> {
    const scopedLines = selectedLinesFromSource(input, this.config);
    const raw = await this.llm.generateStructured<RawContractContextExtraction>({
      operationName: "contract_context_extraction",
      systemInstruction:
        "Extract contract-level reference context only. Do not extract obligations. Use only supplied lines. Return global source spans.",
      prompt: [
        "Extract parties, defined terms, key dates, and section headings only when structure is not already reliable.",
        "Do not infer legal names absent from the source.",
        "Do not resolve cross-references when referenced text is not supplied.",
        "Use G line numbers for sourceSpan.startLine and sourceSpan.endLine.",
        "",
        "SOURCE LINES:",
        renderSourceLinesForPrompt(scopedLines),
      ].join("\n"),
      jsonSchema: contractContextJsonSchema,
      validator: rawContractContextExtractionSchema,
    });

    return this.verifyRawContext(input.sourceIndex, raw, !hasReliableStructure(input));
  }

  private verifyRawContext(
    sourceIndex: ContractSourceIndex,
    raw: RawContractContextExtraction,
    acceptSectionHeadings: boolean,
  ): ContractContextExtractionResult {
    const parties: VerifiedContractParty[] = [];
    const definedTerms: VerifiedDefinedTerm[] = [];
    const keyDates: VerifiedContractKeyDate[] = [];
    const sectionHeadings: VerifiedContractSectionHeading[] = [];
    const rejectedItems: ContractContextRejectedItem[] = [];

    for (const party of raw.parties) {
      const sourceReference = toVerifiedSource(
        sourceIndex,
        party.sourceSpan.startLine,
        party.sourceSpan.endLine,
      );
      if (!sourceReference) {
        rejectedItems.push(
          rejectedItem({
            sourceIndex,
            type: "party",
            label: party.canonicalName,
            startLine: party.sourceSpan.startLine,
            endLine: party.sourceSpan.endLine,
          }),
        );
        continue;
      }
      parties.push({
        roleLabel: party.roleLabel,
        canonicalName: party.canonicalName,
        aliases: normalizeAliases(party.aliases, party.canonicalName),
        source: sourceReference.pageRange,
        sourceReference,
      });
    }

    for (const term of raw.definedTerms) {
      const sourceReference = toVerifiedSource(
        sourceIndex,
        term.sourceSpan.startLine,
        term.sourceSpan.endLine,
      );
      if (!sourceReference) {
        rejectedItems.push(
          rejectedItem({
            sourceIndex,
            type: "defined_term",
            label: term.term,
            startLine: term.sourceSpan.startLine,
            endLine: term.sourceSpan.endLine,
          }),
        );
        continue;
      }
      definedTerms.push({
        term: term.term,
        definition: term.definition,
        referencedSection: term.referencedSection,
        referencedExhibit: term.referencedExhibit,
        resolutionStatus: term.resolutionStatus as ReferenceResolutionStatus,
        source: sourceReference.pageRange,
        sourceReference,
      });
    }

    for (const date of raw.keyDates) {
      const sourceReference = toVerifiedSource(
        sourceIndex,
        date.sourceSpan.startLine,
        date.sourceSpan.endLine,
      );
      if (!sourceReference) {
        rejectedItems.push(
          rejectedItem({
            sourceIndex,
            type: "key_date",
            label: date.label,
            startLine: date.sourceSpan.startLine,
            endLine: date.sourceSpan.endLine,
          }),
        );
        continue;
      }
      keyDates.push({
        label: date.label,
        rawValue: date.rawValue,
        normalizedValue: date.normalizedValue,
        source: sourceReference.pageRange,
        sourceReference,
      });
    }

    if (acceptSectionHeadings) {
      for (const section of raw.sectionHeadings) {
        const sourceReference = toVerifiedSource(
          sourceIndex,
          section.sourceSpan.startLine,
          section.sourceSpan.endLine,
        );
        if (!sourceReference) {
          rejectedItems.push(
            rejectedItem({
              sourceIndex,
              type: "section_heading",
              label: section.heading,
              startLine: section.sourceSpan.startLine,
              endLine: section.sourceSpan.endLine,
            }),
          );
          continue;
        }
        sectionHeadings.push({
          heading: section.heading,
          sectionPath: section.sectionPath,
          sourceReference,
        });
      }
    }

    return {
      context: {
        parties: parties.map(({ roleLabel, canonicalName, aliases, source }) => ({
          roleLabel,
          canonicalName,
          aliases,
          source,
        })),
        definedTerms: definedTerms.map(
          ({ term, definition, referencedSection, referencedExhibit, resolutionStatus, source }) => ({
            term,
            definition,
            referencedSection,
            referencedExhibit,
            resolutionStatus,
            source,
          }),
        ),
        keyDates: keyDates.map(({ label, rawValue, normalizedValue, source }) => ({
          label,
          rawValue,
          normalizedValue,
          source,
        })),
      },
      parties,
      definedTerms,
      keyDates,
      sectionHeadings,
      rejectedItems,
    };
  }
}

export class RelevantContextSelector {
  private readonly config: RelevantContextSelectorConfig;

  constructor(config: Partial<RelevantContextSelectorConfig> = {}) {
    this.config = { ...defaultRelevantContextConfig, ...config };
  }

  select(input: {
    readonly window: DetectedCandidateWindow;
    readonly context: ContractContextExtractionResult;
    readonly sourceIndex: ContractSourceIndex;
  }): RelevantContextSelection {
    const nearbyText = this.nearbyText(input.window, input.sourceIndex);
    const parties = input.context.parties.filter((party) =>
      [party.canonicalName, party.roleLabel, ...party.aliases].some((value) =>
        containsTerm(nearbyText, value),
      ),
    );
    const definedTerms = input.context.definedTerms.filter((term) =>
      containsTerm(nearbyText, term.term),
    );
    const keyDates = input.context.keyDates.filter((date) =>
      containsTerm(nearbyText, date.label) || containsTerm(nearbyText, date.rawValue),
    );

    return {
      canonicalPartyMap: input.context.parties.map((party) => ({
        canonicalName: party.canonicalName,
        roleLabel: party.roleLabel,
        aliases: party.aliases,
      })),
      parties,
      definedTerms,
      keyDates,
    };
  }

  private nearbyText(window: DetectedCandidateWindow, sourceIndex: ContractSourceIndex): string {
    const startLine = Math.max(1, window.globalStartLine - this.config.nearbyLineCount);
    const endLine = window.globalEndLine + this.config.nearbyLineCount;
    const lines: string[] = [];
    for (let lineNumber = startLine; lineNumber <= endLine; lineNumber += 1) {
      const line = sourceIndex.getLine(lineNumber);
      if (line) {
        lines.push(line.normalizedText);
      }
    }
    return lines.join("\n");
  }
}
