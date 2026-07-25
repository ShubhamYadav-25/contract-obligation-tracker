/**
 * @file Defines backend extraction module contracts, services, routes, or persistence logic.
 */
export type Page = { pageNumber: number; rawText: string };

export type Anchor = {
  page_number: number;
  line_offset: number;
  quoted_text: string;
  start_line?: number;
  end_line?: number;
  start_offset?: number;
  end_offset?: number;
  source?: string;
  obligation_type?: string;
  obligated_party?: string | null;
  beneficiary_party?: string | null;
  action?: string;
  deliverable?: string | null;
  timing?: Record<string, unknown>;
  conditions?: readonly string[];
  exceptions?: readonly string[];
  financial_terms?: Record<string, unknown>;
  consequence?: string | null;
  penalty?: string | null;
  confidence?: Record<string, unknown>;
  warnings?: readonly string[];
  missing_fields?: readonly string[];
  source_evidence?: readonly Record<string, unknown>[];
  source_candidate_keys?: readonly string[];
};

export type FieldAnchor = { text: string; anchor: Anchor };

export type StructuredExtraction = {
  parties?: FieldAnchor;
  contractValue?: { text: string; amount?: number; anchor?: Anchor };
  term?: { text: string; durationMonths?: number; anchor?: Anchor };
  renewal?: FieldAnchor;
  noticePeriod?: { text: string; days?: number; anchor?: Anchor };
  obligations?: FieldAnchor[];
};

/**
 * @description Performs the parse currency amount helper operation for this module.
 * @param {string} text - Input value for text.
 * @returns {number | undefined} Result of the parse currency amount operation.
 */
function parseCurrencyAmount(text: string): number | undefined {
  // Match numbers with optional commas and decimals, possibly preceded by currency symbol
  const m =
    text.match(/[$£€]\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]+)?)/) ??
    text.match(/([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]+)?)\s*(USD|GBP|EUR|dollars|pounds|euros)/i);
  if (!m) return undefined;
  const numStr = m[1]?.replace(/,/g, "");
  if (!numStr) return undefined;
  const v = Number(numStr);
  return Number.isFinite(v) ? v : undefined;
}

/**
 * @description Performs the parse duration months helper operation for this module.
 * @param {string} text - Input value for text.
 * @returns {number | undefined} Result of the parse duration months operation.
 */
function parseDurationMonths(text: string): number | undefined {
  // Examples: "3 years", "36 months", "1 year", "6 months"
  const m = text.match(/(\d+)\s*(year|years|month|months)/i);
  if (!m) return undefined;
  const n = Number(m[1]);
  if (!Number.isFinite(n)) return undefined;
  const unit = m[2]?.toLowerCase();
  if (!unit) return undefined;
  if (unit.startsWith("year")) return n * 12;
  return n;
}

/**
 * @description Performs the extract fields from pages helper operation for this module.
 * @param {Page[]} pages - Input value for pages.
 * @returns {{ extraction: StructuredExtraction; confidence: number; }} Result of the extract fields from pages operation.
 */
export function extractFieldsFromPages(pages: Page[]): {
  extraction: StructuredExtraction;
  confidence: number;
} {
  const extraction: StructuredExtraction = {};
  let confidences: number[] = [];

  // Flatten lines with page & offset for easier search
  const lines: { page: number; offset: number; text: string }[] = [];
  for (const p of pages) {
    const pageLines = p.rawText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
    for (let i = 0; i < pageLines.length; i++) {
      const pageText = pageLines[i];
      if (pageText !== undefined) {
        lines.push({ page: p.pageNumber, offset: i, text: pageText });
      }
    }
  }

  // Heuristics: find parties
  const partyLine = lines.find((l) =>
    /\bby and between\b|\bbetween\b|\bis between\b/i.test(l.text),
  );
  if (partyLine) {
    extraction.parties = {
      text: partyLine.text,
      anchor: {
        page_number: partyLine.page,
        line_offset: partyLine.offset,
        quoted_text: partyLine.text,
      },
    };
    confidences.push(0.9);
  }

  // Contract value
  const valueLine =
    lines.find((l) => /\b(total contract value|contract value|tcv|total value)\b/i.test(l.text)) ||
    lines.find((l) => /[$£€]/.test(l.text));
  if (valueLine) {
    const amount = parseCurrencyAmount(valueLine.text);
    const contractValue = {
      text: valueLine.text,
      anchor: {
        page_number: valueLine.page,
        line_offset: valueLine.offset,
        quoted_text: valueLine.text,
      },
    } as { text: string; amount?: number; anchor: Anchor };
    if (amount !== undefined) contractValue.amount = amount;
    extraction.contractValue = contractValue;
    confidences.push(amount ? 0.95 : 0.75);
  }

  // Term
  const termLine = lines.find((l) =>
    /\bterm\b|\bcommenc(e|ing)\b|\bend(s)?\b|\bfor a period of\b/i.test(l.text),
  );
  if (termLine) {
    const months = parseDurationMonths(termLine.text);
    const term = {
      text: termLine.text,
      anchor: {
        page_number: termLine.page,
        line_offset: termLine.offset,
        quoted_text: termLine.text,
      },
    } as { text: string; durationMonths?: number; anchor: Anchor };
    if (months !== undefined) term.durationMonths = months;
    extraction.term = term;
    confidences.push(months ? 0.93 : 0.7);
  }

  // Renewal
  const renewalLine = lines.find((l) =>
    /\brenewal\b|\brenew(s|al)\b|\bautomatically renew\b/i.test(l.text),
  );
  if (renewalLine) {
    extraction.renewal = {
      text: renewalLine.text,
      anchor: {
        page_number: renewalLine.page,
        line_offset: renewalLine.offset,
        quoted_text: renewalLine.text,
      },
    };
    confidences.push(0.85);
  }

  // Notice period
  const noticeLine = lines.find(
    (l) => /\bnotice\b/i.test(l.text) && /\d+\s*(day|days|month|months|year|years)/i.test(l.text),
  );
  if (noticeLine) {
    const m = noticeLine.text.match(/(\d+)\s*(day|days|month|months|year|years)/i);
    const days = m ? (m[2]?.toLowerCase().startsWith("day") ? Number(m[1]) : undefined) : undefined;
    const noticePeriod = {
      text: noticeLine.text,
      anchor: {
        page_number: noticeLine.page,
        line_offset: noticeLine.offset,
        quoted_text: noticeLine.text,
      },
    } as { text: string; days?: number; anchor: Anchor };
    if (days !== undefined) noticePeriod.days = days;
    extraction.noticePeriod = noticePeriod;
    confidences.push(days ? 0.92 : 0.75);
  }

  // Obligations: lines with shall/must/obligat
  extraction.obligations = lines
    .filter((l) => /\b(shall|must|is required to|will)\b/i.test(l.text))
    .slice(0, 10)
    .map((l) => ({
      text: l.text,
      anchor: { page_number: l.page, line_offset: l.offset, quoted_text: l.text },
    }));
  if (extraction.obligations.length > 0)
    confidences.push(0.8 + Math.min(0.15, extraction.obligations.length * 0.01));

  // Aggregate confidence: average, but penalize missing critical fields
  let baseConfidence = confidences.length
    ? confidences.reduce((a, b) => a + b, 0) / confidences.length
    : 0.5;

  // If parties and contractValue and noticePeriod present, boost
  const critical =
    (extraction.parties ? 1 : 0) +
    (extraction.contractValue ? 1 : 0) +
    (extraction.noticePeriod ? 1 : 0);
  if (critical >= 2) baseConfidence = Math.max(baseConfidence, 0.85);

  // Cap
  if (baseConfidence > 0.99) baseConfidence = 0.99;

  return { extraction, confidence: Number(baseConfidence.toFixed(3)) };
}
