/**
 * Generates an editable PPTX with PptxGenJS and a native PDF with PDFKit.
 * Both formats consume the same evidence-backed slide model.
 *
 * Usage:
 *   node generate-pitch-pdf.js --format=both
 *   node generate-pitch-pdf.js --format=pdf --output-dir=outputs
 *   node generate-pitch-pdf.js --kpi=docs/kpi-scoreboard.json
 *
 * Supported KPI JSON keys include contractsProcessed, sourceAnchoringCoverage,
 * missedReminders, invalidTransitionMismatches, lowConfidenceErrorDetection,
 * and keyFieldExtractionAccuracy. Missing actuals are shown as "Not measured".
 */

import fs from "node:fs";
import path from "node:path";
import pptxgen from "pptxgenjs";
import PDFDocument from "pdfkit";

const cli = parseCliArgs(process.argv.slice(2));
const rootDir = path.resolve(cli.rootDir || process.cwd());
const outputDir = path.resolve(rootDir, cli.outputDir || "outputs");
const outputBasename = sanitizeFilename(
  cli.basename || "contract-obligation-tracker-pitch",
);
const pptxPath = path.join(outputDir, `${outputBasename}.pptx`);
const pdfPath = path.join(outputDir, `${outputBasename}.pdf`);
const generatedAt = new Date();
const presenterName = cli.presenter || process.env.PITCH_PRESENTER || "Shubham Yadav";
const presenterRole = cli.role || process.env.PITCH_ROLE || "Full-Stack Engineering Trial";
const NOT_MEASURED = "Not measured";

function parseCliArgs(args) {
  const result = { format: "both" };
  for (const arg of args) {
    if (!arg.startsWith("--")) continue;
    const [rawKey, ...rest] = arg.slice(2).split("=");
    const value = rest.length ? rest.join("=") : true;
    const key = rawKey.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
    result[key] = value;
  }
  if (!["pdf", "pptx", "both"].includes(result.format)) {
    throw new Error("--format must be pdf, pptx, or both");
  }
  return result;
}

function sanitizeFilename(value) {
  return String(value)
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "contract-obligation-tracker-pitch";
}
const defaultPitchSpec = `
Slide 1: Title & One-Line Pitch
Project Title: Contract & Obligation Tracker
Subtitle / One-Liner: Turn buried contract clauses into source-verifiable obligations, reliable workflows, and reminders that never silently disappear.
Slide 2: The Problem
Obligations buried on page 9, including 60-day notice periods and auto-renewals.
Businesses quietly lose money due to untracked renewal clauses.
Slide 3: Why It's Worth Building
Market Pain: Unclear ownership, manual counting, opaque AI extractions.
Who Pays: Any business signing recurring vendor/client contracts.
Slide 4: What We Built
End-to-end extraction pipeline designed for exact source page and line anchoring.
Strict obligation state machine: UPCOMING -> DUE -> MET / MISSED.
Idempotent reminder scheduler whose measured results must come from KPI evidence.
Slide 5: Live Demo & Core Workflow
Contract Ingestion -> LLM Line-Level Extraction -> State Machine Ledger -> Notification System.
Slide 6: How We Built It
Node.js/TypeScript, PostgreSQL-backed persistence, LLM API with Gemini/Groq, Resend-compatible notification adapter.
Slide 7: KPI Scoreboard
Contracts Processed, Source Line Anchoring, Reminder Scheduler Misses, Invalid State Transitions, Low-Confidence Flagging Accuracy, Key Field Extraction Accuracy.
Slide 8: What Broke / What We'd Fix
Adversarial testing: clock skew, process restarts, edge-case PDF layouts.
Slide 9: Product Roadmap & Commercialization
Multi-tenant escalation chains, diffing contract versions, portfolio risk scoring.
`;

function readTextIfExists(relativePath) {
  if (!relativePath) return "";
  const filePath = path.isAbsolute(relativePath) ? relativePath : assetPath(relativePath);
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : "";
}

function loadPitchSpecification() {
  const explicitArg = process.argv.find(
    (arg) => arg.startsWith("--spec=") || arg.startsWith("--trial-doc="),
  );
  const explicitPath = explicitArg
    ? explicitArg.split("=").slice(1).join("=")
    : process.env.PITCH_SPEC_PATH;
  const candidates = [
    explicitPath,
    "trial-document.md",
    "provided-trial-document.md",
    "docs/trial-document.md",
    "docs/trial-spec.md",
    "docs/pitch-spec.md",
  ].filter(Boolean);

  for (const candidate of candidates) {
    const filePath = path.isAbsolute(candidate) ? candidate : assetPath(candidate);
    if (fs.existsSync(filePath)) {
      return {
        sourcePath: filePath,
        text: fs.readFileSync(filePath, "utf8"),
      };
    }
  }

  return {
    sourcePath: "prompt-provided pitch specification",
    text: defaultPitchSpec,
  };
}

function readJsonIfExists(relativePath) {
  const content = readTextIfExists(relativePath);
  if (!content) return undefined;
  try {
    return JSON.parse(content);
  } catch (error) {
    console.warn(`[pitch] Ignoring invalid JSON at ${relativePath}: ${error.message}`);
    return undefined;
  }
}

function readJsonlIfExists(relativePath) {
  const content = readTextIfExists(relativePath);
  if (!content) return [];

  const rows = [];
  content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .forEach((line, index) => {
      try {
        rows.push(JSON.parse(line));
      } catch (error) {
        console.warn(
          `[pitch] Ignoring invalid JSONL line ${index + 1} in ${relativePath}: ${error.message}`,
        );
      }
    });
  return rows;
}

function loadTrialEvidence(pitchSpec) {
  const contracts = readJsonlIfExists("datasets/contracts/25_contracts.jsonl");
  const transitions = readJsonlIfExists("datasets/transitions/100_state_transitions.jsonl");
  const reminders = readJsonlIfExists("datasets/reminders/20_restart_scenarios.jsonl");
  const trialTest = readTextIfExists("apps/api/tests/unit/trial-datasets.test.ts");
  const finalReport = readTextIfExists("docs/final-application-wiring-report.md");
  const workingReport = readTextIfExists("docs/reference-aware-working-app-report.md");
  const kpiReport =
    readJsonIfExists(cli.kpi || "docs/kpi-scoreboard.json") ||
    readJsonIfExists("docs/kpi-results.json") ||
    readJsonIfExists("outputs/kpi-scoreboard.json");
  const reportText = [trialTest, finalReport, workingReport, JSON.stringify(kpiReport || {})].join("\n");

  return {
    contracts,
    transitions,
    reminders,
    trialTest,
    finalReport,
    workingReport,
    reportText,
    kpiReport,
    pitchSpec,
    duplicateReminderKeys: (() => {
      const keys = reminders
        .map((item) => item.expectedOccurrenceKey || item.occurrenceKey)
        .filter(Boolean);
      return keys.length ? keys.length - new Set(keys).size : undefined;
    })(),
  };
}

function numberFrom(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const match = value.replace(/,/g, "").match(/-?\d+(?:\.\d+)?/);
    return match ? Number(match[0]) : undefined;
  }
  return undefined;
}

function findNestedValue(object, keys) {
  if (!object || typeof object !== "object") return undefined;
  const wanted = new Set(keys.map((key) => key.toLowerCase()));
  const queue = [object];
  const visited = new Set();
  while (queue.length) {
    const current = queue.shift();
    if (!current || typeof current !== "object" || visited.has(current)) continue;
    visited.add(current);
    const identity = String(
      current.key ?? current.id ?? current.name ?? current.label ?? "",
    ).toLowerCase();
    if (wanted.has(identity)) {
      return current.actual ?? current.value ?? current.result ?? current.metric;
    }
    for (const [key, value] of Object.entries(current)) {
      if (wanted.has(key.toLowerCase())) return value;
      if (value && typeof value === "object") queue.push(value);
    }
  }
  return undefined;
}

function metricFromText(text, patterns) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return numberFrom(match[1]);
  }
  return undefined;
}

function percentFrom(value) {
  const number = numberFrom(value);
  if (number === undefined) return undefined;
  return number > 0 && number <= 1 ? number * 100 : number;
}

function inferTransitionMismatches(rows) {
  if (!rows.length) return undefined;
  let comparable = 0;
  let mismatches = 0;
  for (const row of rows) {
    if (typeof row.passed === "boolean") {
      comparable += 1;
      if (!row.passed) mismatches += 1;
      continue;
    }
    const expected = row.expectedAllowed ?? row.expected ?? row.shouldAllow;
    const actual = row.actualAllowed ?? row.actual ?? row.allowed;
    if (typeof expected === "boolean" && typeof actual === "boolean") {
      comparable += 1;
      if (expected !== actual) mismatches += 1;
    }
  }
  return comparable === rows.length ? mismatches : undefined;
}

function inferReminderMisses(rows) {
  if (!rows.length) return undefined;
  let comparable = 0;
  let misses = 0;
  for (const row of rows) {
    const missed = row.missed ?? row.wasMissed ?? row.deliveryMissed;
    if (typeof missed === "boolean") {
      comparable += 1;
      if (missed) misses += 1;
      continue;
    }
    const status = String(row.status ?? row.actualStatus ?? "").toLowerCase();
    if (["sent", "delivered", "fired", "success", "completed"].includes(status)) {
      comparable += 1;
    } else if (["missed", "failed", "not-fired", "not_sent"].includes(status)) {
      comparable += 1;
      misses += 1;
    }
  }
  return comparable === rows.length ? misses : undefined;
}

function makeKpi(label, target, actual, method, passed) {
  const measured = actual !== undefined;
  return [
    label,
    target,
    measured ? String(actual) : NOT_MEASURED,
    method,
    measured ? (passed ? "PASS" : "FAIL") : "NOT MEASURED",
  ];
}

function buildKpiRows(evidence) {
  const json = evidence.kpiReport || {};
  const text = evidence.reportText;

  const contractsProcessed =
    numberFrom(findNestedValue(json, ["contractsProcessed", "contracts_processed"])) ??
    metricFromText(text, [
      /contracts\s+processed\s*[:=-]\s*(\d+)/i,
      /(\d+)\s+contracts\s+processed/i,
    ]);

  const sourceAnchoring =
    percentFrom(
      findNestedValue(json, [
        "sourceAnchoringCoverage",
        "source_anchoring_coverage",
        "anchoringCoverage",
      ]),
    ) ??
    metricFromText(text, [
      /source\s+(?:line\s+)?anchoring(?:\s+coverage)?\s*[:=-]\s*(\d+(?:\.\d+)?)\s*%/i,
    ]);

  const reminderMisses =
    numberFrom(findNestedValue(json, ["missedReminders", "reminderMisses"])) ??
    metricFromText(text, [
      /missed\s+reminders\s*[:=-]\s*(\d+)/i,
      /(\d+)\s+missed\s+reminders/i,
    ]) ??
    inferReminderMisses(evidence.reminders);

  const transitionMismatches =
    numberFrom(
      findNestedValue(json, [
        "invalidTransitionMismatches",
        "invalidTransitions",
        "transitionMismatches",
      ]),
    ) ??
    metricFromText(text, [
      /invalid\s+(?:state\s+)?transitions\s*[:=-]\s*(\d+)/i,
      /transition\s+(?:failures|mismatches)\s*[:=-]\s*(\d+)/i,
    ]) ??
    inferTransitionMismatches(evidence.transitions);

  const lowConfidence =
    percentFrom(
      findNestedValue(json, [
        "lowConfidenceErrorDetection",
        "lowConfidenceAccuracy",
        "low_confidence_error_detection",
      ]),
    ) ??
    metricFromText(text, [
      /low[-\s]confidence(?:\s+error)?\s+(?:detection|flagging|accuracy)[^\d]*(\d+(?:\.\d+)?)\s*%/i,
    ]);

  const keyFieldAccuracy =
    percentFrom(
      findNestedValue(json, [
        "keyFieldExtractionAccuracy",
        "keyFieldAccuracy",
        "key_field_extraction_accuracy",
      ]),
    ) ??
    metricFromText(text, [
      /key[-\s]field(?:\s+extraction)?\s+accuracy[^\d]*(\d+(?:\.\d+)?)\s*%/i,
    ]);

  return [
    makeKpi(
      "Contracts processed",
      ">= 25",
      contractsProcessed,
      contractsProcessed === undefined
        ? `${evidence.contracts.length} labelled contracts available; run the ingestion KPI.`
        : "Processing/KPI report.",
      contractsProcessed >= 25,
    ),
    makeKpi(
      "Source anchoring coverage",
      "100%",
      sourceAnchoring === undefined ? undefined : `${sourceAnchoring.toFixed(1)}%`,
      "Anchored obligations / extracted obligations.",
      sourceAnchoring === 100,
    ),
    makeKpi(
      "Missed reminders",
      "0 across 20 scenarios",
      reminderMisses === undefined
        ? undefined
        : `${reminderMisses} across ${evidence.reminders.length || 20} scenarios`,
      reminderMisses === undefined
        ? `${evidence.reminders.length} scenarios available; execute and record outcomes.`
        : `Restart/adversarial report; ${
            evidence.duplicateReminderKeys === undefined
              ? "duplicate-key count unavailable"
              : `${evidence.duplicateReminderKeys} duplicate fixture keys`
          }.`,
      reminderMisses === 0,
    ),
    makeKpi(
      "Invalid state transitions",
      "0 across 100 tests",
      transitionMismatches === undefined
        ? undefined
        : `${transitionMismatches} across ${evidence.transitions.length || 100} tests`,
      transitionMismatches === undefined
        ? `${evidence.transitions.length} cases available; execute expected-vs-actual checks.`
        : "Expected versus actual transition decisions.",
      transitionMismatches === 0,
    ),
    makeKpi(
      "Low-confidence error detection",
      ">= 90%",
      lowConfidence === undefined ? undefined : `${lowConfidence.toFixed(1)}%`,
      "Labelled extraction-error evaluation set.",
      lowConfidence >= 90,
    ),
    makeKpi(
      "Key-field extraction accuracy",
      ">= 90%",
      keyFieldAccuracy === undefined ? undefined : `${keyFieldAccuracy.toFixed(1)}%`,
      "Labelled parties, value, term, renewal, and notice fields.",
      keyFieldAccuracy >= 90,
    ),
  ];
}

function featureEvidenceStatus(evidence, positivePatterns, mentionPatterns) {
  const text = evidence.reportText || "";
  if (positivePatterns.some((pattern) => pattern.test(text))) return "IMPLEMENTED";
  if (mentionPatterns.some((pattern) => pattern.test(text))) return "PARTIAL";
  return "NOT VERIFIED";
}

function buildSlides(evidence) {
  const kpiRows = buildKpiRows(evidence);
  const ingestionStatus = featureEvidenceStatus(
    evidence,
    [/contract ingestion.*(?:passed|working|complete|implemented)/i, /POST \/api\/v1\/contracts/i],
    [/contract ingestion|duplicate detection|processing run/i],
  );
  const anchoringStatus = featureEvidenceStatus(
    evidence,
    [/source (?:line )?anchoring.*(?:passed|working|100%)/i],
    [/source anchoring|page\/line|page and line/i],
  );
  const stateStatus = featureEvidenceStatus(
    evidence,
    [/state machine.*(?:passed|working|complete|implemented)/i],
    [/state machine|illegal transition|UPCOMING.*DUE/i],
  );
  const schedulerStatus = featureEvidenceStatus(
    evidence,
    [/scheduler.*(?:passed|working|restart-safe|complete|implemented)/i],
    [/scheduler|idempotent|occurrence key|restart scenario/i],
  );
  const reviewStatus = featureEvidenceStatus(
    evidence,
    [/confidence.*review.*(?:passed|working|complete|implemented)/i],
    [/confidence|review queue|human review/i],
  );

  return [
    {
      eyebrow: "Contract & Obligation Tracker",
      title: "Contract & Obligation Tracker",
      subtitle:
        "Turn buried contract clauses into source-verifiable obligations, reliable workflows, and reminders that never silently disappear.",
      image: "apps/web/visual-verification/dashboard-desktop.png",
      presenter: presenterName,
      role: presenterRole,
      foot: `Pitch deck generated from local trial datasets, app reports, and ${evidence.pitchSpec.sourcePath}.`,
    },
    {
      eyebrow: "The Problem",
      title: "Obligations buried deep in contracts become expensive surprises",
      bullets: [
        "A 60-day notice period on page 9 can decide whether an auto-renewal silently locks in another term.",
        "Businesses quietly lose money when renewal clauses, payment duties, and notice windows are tracked by memory.",
        "Manual spreadsheets break down as contract volume grows and ownership changes.",
      ],
      stat: { value: "Page 9", label: "where renewal risk often hides" },
    },
    {
      eyebrow: "Why Build It",
      title: "The buyer pays for clarity, ownership, and trusted AI extraction",
      bullets: [
        "Market pain: unclear ownership, manual counting, opaque AI extractions, and no reliable audit trail.",
        "Who pays: any business signing recurring vendor or client contracts with renewal, payment, or reporting duties.",
        "The value is not just extraction. It is converting static contract language into accountable operational work.",
      ],
      stat: { value: "Any", label: "recurring-contract business is exposed" },
    },
    {
      eyebrow: "What We Built",
      title: "The product turns contract text into a guarded obligation ledger",
      bullets: [
        `${ingestionStatus}: Ingestion, validation, duplicate detection, storage, and processing metadata.`,
        `${anchoringStatus}/${reviewStatus}: Page-line evidence, confidence scoring, and human review.`,
        `${stateStatus}: UPCOMING -> DUE -> MET / MISSED with illegal transitions rejected.`,
        `${schedulerStatus}: Deterministic reminder keys, retries, restart recovery, and idempotency.`,
      ],
      metrics: [
        [String(evidence.contracts.length || 0), "labelled contracts available"],
        [String(evidence.transitions.length || 0), "transition cases available"],
        [String(evidence.reminders.length || 0), "reminder scenarios available"],
      ],
    },
    {
      eyebrow: "Live Demo Flow",
      title: "The core workflow moves from ingestion to reminders without losing evidence",
      flow: [
        "Contract Ingestion",
        "LLM Line-Level Extraction",
        "State Machine Ledger",
        "Notification System",
      ],
      bullets: [
        "Upload a fresh contract and inspect its asynchronous processing state.",
        "Review extracted key fields, obligations, confidence, and supporting source text.",
        "Click an obligation to open the PDF at its exact page and line.",
        "Attempt an illegal transition and show the state machine reject it.",
        "Trigger a reminder scenario and show duplicate/restart safety only when measured.",
      ],
      image: "apps/web/visual-verification/contract-workspace-desktop.png",
    },
    {
      eyebrow: "How We Built It",
      title: "The architecture favors transactions, idempotency, and auditability",
      columns: [
        [
          "Runtime",
          "Node.js and TypeScript services with Express routes, workers, schedulers, and recovery jobs.",
        ],
        [
          "Data",
          "PostgreSQL-backed persistence, repository boundaries, immutable PDF storage, and audit read models.",
        ],
        [
          "AI",
          "Pluggable structured extraction, strict validation, confidence handling, and source anchoring.",
        ],
        [
          "Notifications",
          "Reminder delivery through provider adapters backed by durable, idempotent occurrence records.",
        ],
      ],
    },
    {
      eyebrow: "Reliability Engineering",
      title: "The system is judged by invariants that survive retries, restarts, and bad inputs",
      bullets: [
        "Illegal obligation transitions are rejected at the service/domain boundary.",
        "Deterministic reminder occurrence keys make retries and duplicate triggers idempotent.",
        "Transactions keep obligation, state, reminder, and audit changes consistent.",
        "Duplicate uploads are detected before duplicate processing work is created.",
        "KPI claims remain unverified until a repeatable test or report proves them.",
      ],
      stat: { value: "Proof", label: "before production claims" },
    },
    {
      eyebrow: "KPI Scoreboard",
      title: "The trial scoreboard separates measured evidence from pilot targets",
      table: {
        headers: ["KPI", "Target", "Actual", "Measurement", "Status"],
        rows: kpiRows,
      },
    },
    {
      eyebrow: "What Broke",
      title: "Adversarial testing exposed the right hardening work",
      bullets: [
        "Clock skew and process restarts force reminder jobs to use deterministic occurrence keys.",
        "Edge-case PDF layouts require source-aware extraction, strict candidate windows, and reviewer fallback.",
        "Browser-level source-click validation still needs a complete run against the live UI.",
        "Provider quotas and retries need explicit limits so extraction failures do not look like product success.",
      ],
      image: "apps/web/visual-verification/review-queue-desktop.png",
    },
    {
      eyebrow: "Roadmap",
      title: "The commercial product becomes a contract-risk operating system",
      bullets: [
        "Multi-tenant escalation chains for legal, finance, procurement, and business owners.",
        "Contract version diffing to show renewal, payment, and notice changes before signature.",
        "Portfolio risk scoring across missed deadlines, low confidence terms, renewal exposure, and owner latency.",
        "Enterprise readiness through role policy, observability, email deliverability, and audit export.",
      ],
      stat: { value: "Pilot", label: "then multi-tenant commercialization" },
    },
  ];
}

const pitchSpec = loadPitchSpecification();
const trialEvidence = loadTrialEvidence(pitchSpec);
const presentationData = Object.freeze({
  generatedAt: generatedAt.toISOString(),
  presenter: presenterName,
  role: presenterRole,
  sourcePath: pitchSpec.sourcePath,
  slides: buildSlides(trialEvidence),
});
const slides = presentationData.slides;

const theme = {
  ink: "07162F",
  muted: "5C6B82",
  teal: "0F8A7A",
  cyan: "0EA5B7",
  amber: "D97706",
  red: "B91C1C",
  green: "047857",
  line: "D7DEE8",
  soft: "F4F7FB",
  white: "FFFFFF",
};
const shapeType = new pptxgen().ShapeType;

function ensureOutputDir() {
  fs.mkdirSync(outputDir, { recursive: true });
}

function assetPath(relativePath) {
  return path.join(rootDir, relativePath);
}

function addFooter(slide, index) {
  slide.addShape(shapeType.line, {
    x: 0.55,
    y: 7.06,
    w: 12.2,
    h: 0,
    line: { color: theme.line, width: 0.6 },
  });
  slide.addText("Contract & Obligation Tracker", {
    x: 0.55,
    y: 7.16,
    w: 3.5,
    h: 0.18,
    fontSize: 7,
    color: theme.muted,
    margin: 0,
  });
  slide.addText(`${generatedAt.toISOString().slice(0, 19).replace("T", " ")} UTC`, {
    x: 4.5,
    y: 7.16,
    w: 4.3,
    h: 0.18,
    fontSize: 7,
    color: theme.muted,
    align: "center",
    margin: 0,
  });
  slide.addText(
    `${String(index + 1).padStart(2, "0")} / ${String(slides.length).padStart(2, "0")}`,
    {
      x: 11.85,
      y: 7.16,
      w: 0.9,
      h: 0.18,
      fontSize: 7,
      color: theme.muted,
      align: "right",
      margin: 0,
    },
  );
}

function addTitleBlock(slide, slideDef, opts = {}) {
  const x = opts.x ?? 0.7;
  const y = opts.y ?? 0.55;
  const w = opts.w ?? 11.9;
  slide.addText(slideDef.eyebrow.toUpperCase(), {
    x,
    y,
    w,
    h: 0.25,
    fontSize: 9,
    bold: true,
    color: theme.teal,
    charSpace: 1.2,
    margin: 0,
  });
  slide.addText(slideDef.title, {
    x,
    y: y + 0.38,
    w,
    h: opts.titleH ?? 0.95,
    fontSize: opts.titleSize ?? 26,
    bold: true,
    color: theme.ink,
    breakLine: false,
    fit: "shrink",
    margin: 0,
  });
  if (slideDef.subtitle) {
    slide.addText(slideDef.subtitle, {
      x,
      y: y + 1.42,
      w: opts.subtitleW ?? 8.5,
      h: 0.55,
      fontSize: 13,
      color: theme.muted,
      fit: "shrink",
      margin: 0,
    });
  }
}

function addBullets(slide, bullets, x, y, w, options = {}) {
  bullets.forEach((bullet, idx) => {
    const rowY = y + idx * (options.gap ?? 0.58);
    slide.addShape(shapeType.ellipse, {
      x,
      y: rowY + 0.08,
      w: 0.12,
      h: 0.12,
      fill: { color: options.dotColor ?? theme.teal },
      line: { color: options.dotColor ?? theme.teal },
    });
    slide.addText(bullet, {
      x: x + 0.25,
      y: rowY,
      w,
      h: options.h ?? 0.36,
      fontSize: options.fontSize ?? 12.5,
      color: options.color ?? theme.ink,
      fit: "shrink",
      margin: 0,
      breakLine: false,
    });
  });
}

function addMetricCard(slide, value, label, x, y, w, accent = theme.teal) {
  slide.addShape(shapeType.roundRect, {
    x,
    y,
    w,
    h: 0.9,
    rectRadius: 0.05,
    fill: { color: theme.white },
    line: { color: theme.line, width: 1 },
  });
  slide.addText(value, {
    x: x + 0.16,
    y: y + 0.1,
    w: w - 0.32,
    h: 0.33,
    fontSize: 20,
    bold: true,
    color: accent,
    margin: 0,
    fit: "shrink",
  });
  slide.addText(label, {
    x: x + 0.16,
    y: y + 0.5,
    w: w - 0.32,
    h: 0.25,
    fontSize: 8.5,
    color: theme.muted,
    margin: 0,
    fit: "shrink",
  });
}

function statusPalette(status) {
  if (status === "PASS") return { fill: "E7F7EE", text: theme.green, line: "A8DEC5" };
  if (status === "FAIL") return { fill: "FDECEC", text: theme.red, line: "EDB6B6" };
  return { fill: "F1F4F8", text: theme.muted, line: theme.line };
}

function addImageFrame(slide, relativePath, x, y, w, h, label = "Screenshot unavailable") {
  slide.addShape(shapeType.roundRect, {
    x,
    y,
    w,
    h,
    rectRadius: 0.05,
    fill: { color: theme.white },
    line: { color: theme.line, width: 1 },
    shadow: { type: "outer", color: "B8C1CE", opacity: 0.25, blur: 1, angle: 45, distance: 1 },
  });
  const filePath = relativePath ? assetPath(relativePath) : undefined;
  if (filePath && fs.existsSync(filePath)) {
    slide.addImage({
      path: filePath,
      x: x + 0.08,
      y: y + 0.08,
      w: w - 0.16,
      h: h - 0.16,
    });
    return;
  }
  slide.addShape(shapeType.rect, {
    x: x + 0.1,
    y: y + 0.1,
    w: w - 0.2,
    h: h - 0.2,
    fill: { color: theme.soft },
    line: { color: theme.line, dash: "dash", width: 0.8 },
  });
  slide.addText(label, {
    x: x + 0.3,
    y: y + h / 2 - 0.2,
    w: w - 0.6,
    h: 0.4,
    fontSize: 12,
    italic: true,
    color: theme.muted,
    align: "center",
    margin: 0,
  });
}

function addKpiTable(slide, table, x, y, w) {
  const colWidths = [2.75, 1.45, 2.25, 4.05, w - 10.5];
  const rowH = 0.55;
  const rows = [table.headers, ...table.rows];

  rows.forEach((row, rowIndex) => {
    const fill = rowIndex === 0 ? "E7F7F4" : rowIndex % 2 === 0 ? "F8FAFC" : theme.white;
    let cellX = x;
    row.forEach((cell, colIndex) => {
      const status = rowIndex > 0 && colIndex === 4 ? statusPalette(String(cell)) : undefined;
      slide.addShape(shapeType.rect, {
        x: cellX,
        y: y + rowIndex * rowH,
        w: colWidths[colIndex],
        h: rowH,
        fill: { color: status?.fill || fill },
        line: { color: status?.line || theme.line, width: 0.75 },
      });
      slide.addText(String(cell), {
        x: cellX + 0.08,
        y: y + rowIndex * rowH + 0.09,
        w: colWidths[colIndex] - 0.16,
        h: rowH - 0.16,
        fontSize: rowIndex === 0 ? 8.4 : colIndex === 3 ? 6.9 : 7.6,
        bold: rowIndex === 0 || colIndex === 0 || colIndex === 4,
        color: status?.text || (rowIndex === 0 ? theme.teal : theme.ink),
        align: colIndex === 4 ? "center" : "left",
        valign: "mid",
        fit: "shrink",
        margin: 0,
      });
      cellX += colWidths[colIndex];
    });
  });
}

async function buildPptx() {
  const pptx = new pptxgen();
  pptx.layout = "LAYOUT_WIDE";
  pptx.author = presenterName;
  pptx.company = "Contract & Obligation Tracker";
  pptx.subject = "Contract & Obligation Tracker pitch";
  pptx.title = "Contract & Obligation Tracker Pitch";
  pptx.lang = "en-US";
  pptx.theme = {
    headFontFace: "Aptos Display",
    bodyFontFace: "Aptos",
    lang: "en-US",
  };
  pptx.defineLayout({ name: "CUSTOM_WIDE", width: 13.333, height: 7.5 });
  pptx.layout = "CUSTOM_WIDE";

  slides.forEach((slideDef, index) => {
    const slide = pptx.addSlide();
    slide.background = { color: index === 0 ? "F8FBFC" : theme.soft };

    if (index === 0) {
      addTitleBlock(slide, slideDef, {
        x: 0.72,
        y: 0.72,
        w: 7.2,
        titleSize: 28,
        titleH: 1.55,
        subtitleW: 6.6,
      });
      addBullets(
        slide,
        [
          "Upload and parse contracts",
          "Extract obligations with evidence",
          "Review uncertainty",
          "Track deadlines and reminders",
        ],
        0.78,
        3.2,
        5.1,
        { gap: 0.48, fontSize: 12 },
      );
      slide.addText(`${slideDef.presenter} · ${slideDef.role}`, {
        x: 0.78,
        y: 2.7,
        w: 5.6,
        h: 0.25,
        fontSize: 10,
        bold: true,
        color: theme.teal,
        margin: 0,
      });
      addImageFrame(slide, slideDef.image, 7.45, 0.55, 5.25, 5.85, "Dashboard screenshot unavailable");
      slide.addText(slideDef.foot, {
        x: 0.72,
        y: 6.25,
        w: 5.7,
        h: 0.28,
        fontSize: 9,
        color: theme.muted,
        margin: 0,
      });
      addFooter(slide, index);
      return;
    }

    addTitleBlock(slide, slideDef, { titleH: 0.78, titleSize: 23 });

    if (slideDef.flow) {
      const startX = 0.75;
      const y = 2.2;
      slideDef.flow.forEach((step, stepIndex) => {
        const x = startX + stepIndex * 2.05;
        slide.addShape(shapeType.roundRect, {
          x,
          y,
          w: 1.58,
          h: 0.78,
          rectRadius: 0.04,
          fill: { color: stepIndex % 2 === 0 ? "E7F7F4" : "EAF6FB" },
          line: { color: stepIndex % 2 === 0 ? "9EDBD2" : "9BD7E5", width: 1 },
        });
        slide.addText(step, {
          x: x + 0.13,
          y: y + 0.17,
          w: 1.32,
          h: 0.38,
          fontSize: 10,
          bold: true,
          color: theme.ink,
          align: "center",
          fit: "shrink",
          margin: 0,
        });
        if (stepIndex < slideDef.flow.length - 1) {
          slide.addShape(shapeType.chevron, {
            x: x + 1.65,
            y: y + 0.27,
            w: 0.25,
            h: 0.25,
            fill: { color: theme.teal },
            line: { color: theme.teal },
          });
        }
      });
      addBullets(slide, slideDef.bullets, 1.0, 3.75, 10.7, { gap: 0.54 });
    } else if (slideDef.image) {
      addImageFrame(slide, slideDef.image, 0.75, 1.78, 7.1, 4.85);
      addBullets(slide, slideDef.bullets, 8.25, 2.05, 4.25, { gap: 0.72, h: 0.52 });
    } else if (slideDef.metrics) {
      slideDef.metrics.forEach(([value, label], metricIndex) => {
        const row = Math.floor(metricIndex / 3);
        const col = metricIndex % 3;
        addMetricCard(
          slide,
          value,
          label,
          0.78 + col * 2.2,
          2.0 + row * 1.12,
          1.85,
          [theme.teal, theme.cyan, theme.amber][col],
        );
      });
      addBullets(slide, slideDef.bullets, 7.35, 2.0, 4.65, { gap: 0.68, h: 0.5 });
      slide.addShape(shapeType.line, {
        x: 6.95,
        y: 1.95,
        w: 0,
        h: 3.25,
        line: { color: theme.line, width: 1 },
      });
    } else if (slideDef.table) {
      addKpiTable(slide, slideDef.table, 0.78, 1.88, 11.75);
      slide.addText(
        "Targets never populate actual results. Missing repository evidence remains Not measured.",
        {
          x: 0.82,
          y: 5.72,
          w: 10.7,
          h: 0.28,
          fontSize: 10,
          color: theme.muted,
          margin: 0,
        },
      );
    } else if (slideDef.columns) {
      slideDef.columns.forEach(([heading, body], colIndex) => {
        const row = Math.floor(colIndex / 2);
        const col = colIndex % 2;
        const x = 0.78 + col * 6.05;
        const y = 2.0 + row * 1.72;
        slide.addShape(shapeType.roundRect, {
          x,
          y,
          w: 5.45,
          h: 1.25,
          rectRadius: 0.04,
          fill: { color: theme.white },
          line: { color: theme.line, width: 1 },
        });
        slide.addText(heading, {
          x: x + 0.25,
          y: y + 0.18,
          w: 4.9,
          h: 0.25,
          fontSize: 13,
          bold: true,
          color: theme.teal,
          margin: 0,
        });
        slide.addText(body, {
          x: x + 0.25,
          y: y + 0.53,
          w: 4.9,
          h: 0.5,
          fontSize: 10.5,
          color: theme.ink,
          fit: "shrink",
          margin: 0,
        });
      });
    } else {
      addBullets(slide, slideDef.bullets, 0.95, 2.05, 7.0, { gap: 0.72, h: 0.52 });
      if (slideDef.stat) {
        slide.addShape(shapeType.roundRect, {
          x: 8.6,
          y: 2.15,
          w: 3.3,
          h: 2.25,
          rectRadius: 0.06,
          fill: { color: theme.white },
          line: { color: "F5CACA", width: 1 },
        });
        slide.addText(slideDef.stat.value, {
          x: 9.0,
          y: 2.55,
          w: 2.5,
          h: 0.8,
          fontSize: 42,
          bold: true,
          color: index === slides.length - 1 ? theme.teal : theme.red,
          align: "center",
          margin: 0,
        });
        slide.addText(slideDef.stat.label, {
          x: 9.02,
          y: 3.55,
          w: 2.45,
          h: 0.45,
          fontSize: 11,
          color: theme.muted,
          align: "center",
          fit: "shrink",
          margin: 0,
        });
      }
    }

    addFooter(slide, index);
  });

  await pptx.writeFile({ fileName: pptxPath });
}

function smokeTestOutput(filePath, format) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`${format.toUpperCase()} output was not created: ${filePath}`);
  }
  const stat = fs.statSync(filePath);
  if (stat.size < 100) {
    throw new Error(`${format.toUpperCase()} output is unexpectedly small: ${stat.size} bytes`);
  }
  const header = fs.readFileSync(filePath).subarray(0, 4);
  if (format === "pdf" && header.toString("ascii") !== "%PDF") {
    throw new Error(`Invalid PDF signature: ${filePath}`);
  }
  if (format === "pptx" && !(header[0] === 0x50 && header[1] === 0x4b)) {
    throw new Error(`Invalid PPTX/ZIP signature: ${filePath}`);
  }
  return stat.size;
}

function drawPdfFooter(doc, index) {
  doc
    .moveTo(42, 399)
    .lineTo(726, 399)
    .lineWidth(0.5)
    .strokeColor(`#${theme.line}`)
    .stroke();
  doc
    .font("Helvetica")
    .fontSize(7)
    .fillColor(`#${theme.muted}`)
    .text("Contract & Obligation Tracker", 42, 407, { width: 240 })
    .text(`${generatedAt.toISOString().slice(0, 19).replace("T", " ")} UTC`, 285, 407, {
      width: 200,
      align: "center",
    })
    .text(
      `${String(index + 1).padStart(2, "0")} / ${String(slides.length).padStart(2, "0")}`,
      670,
      407,
      { width: 75, align: "right" },
    );
}

function drawPdfTitle(doc, slideDef, titleY = 52) {
  doc
    .font("Helvetica-Bold")
    .fontSize(8)
    .fillColor(`#${theme.teal}`)
    .text(slideDef.eyebrow.toUpperCase(), 42, titleY);
  doc
    .font("Helvetica-Bold")
    .fontSize(24)
    .fillColor(`#${theme.ink}`)
    .text(slideDef.title, 42, titleY + 26, {
      width: 675,
      lineGap: 2,
    });
  if (slideDef.subtitle) {
    doc
      .font("Helvetica")
      .fontSize(11)
      .fillColor(`#${theme.muted}`)
      .text(slideDef.subtitle, 42, titleY + 112, {
        width: 390,
        lineGap: 3,
      });
  }
}

function drawPdfBullets(doc, bullets, x, y, width, gap = 39) {
  bullets.forEach((bullet, idx) => {
    const cy = y + idx * gap;
    doc.circle(x + 4, cy + 6, 3).fill(`#${theme.teal}`);
    doc
      .font("Helvetica")
      .fontSize(10.5)
      .fillColor(`#${theme.ink}`)
      .text(bullet, x + 18, cy, {
        width,
        lineGap: 2,
      });
  });
}

function drawPdfImage(doc, relativePath, x, y, w, h, label = "Screenshot unavailable") {
  doc.roundedRect(x, y, w, h, 5).fillAndStroke(`#${theme.white}`, `#${theme.line}`);
  const filePath = relativePath ? assetPath(relativePath) : undefined;
  if (filePath && fs.existsSync(filePath)) {
    doc.image(filePath, x + 5, y + 5, {
      fit: [w - 10, h - 10],
      align: "center",
      valign: "center",
    });
    return;
  }
  doc.rect(x + 7, y + 7, w - 14, h - 14).fillAndStroke(`#${theme.soft}`, `#${theme.line}`);
  doc
    .font("Helvetica-Oblique")
    .fontSize(10)
    .fillColor(`#${theme.muted}`)
    .text(label, x + 20, y + h / 2 - 8, { width: w - 40, align: "center" });
}

function drawMetric(doc, value, label, x, y, color) {
  doc.roundedRect(x, y, 100, 58, 5).fillAndStroke(`#${theme.white}`, `#${theme.line}`);
  doc
    .font("Helvetica-Bold")
    .fontSize(20)
    .fillColor(`#${color}`)
    .text(value, x + 12, y + 10, { width: 78 });
  doc
    .font("Helvetica")
    .fontSize(8)
    .fillColor(`#${theme.muted}`)
    .text(label, x + 12, y + 36, { width: 78 });
}

function drawPdfKpiTable(doc, table, x, y, w) {
  const colWidths = [170, 80, 130, 235, w - 615];
  const rowH = 35;
  const rows = [table.headers, ...table.rows];

  rows.forEach((row, rowIndex) => {
    const fill = rowIndex === 0 ? "#E7F7F4" : rowIndex % 2 === 0 ? "#F8FAFC" : "#FFFFFF";
    let cellX = x;
    row.forEach((cell, colIndex) => {
      const status = rowIndex > 0 && colIndex === 4 ? statusPalette(String(cell)) : undefined;
      doc
        .rect(cellX, y + rowIndex * rowH, colWidths[colIndex], rowH)
        .fillAndStroke(status ? `#${status.fill}` : fill, `#${status?.line || theme.line}`);
      doc
        .font(rowIndex === 0 || colIndex === 0 || colIndex === 4 ? "Helvetica-Bold" : "Helvetica")
        .fontSize(rowIndex === 0 ? 7.5 : colIndex === 3 ? 5.9 : 6.7)
        .fillColor(status ? `#${status.text}` : rowIndex === 0 ? `#${theme.teal}` : `#${theme.ink}`)
        .text(String(cell), cellX + 5, y + rowIndex * rowH + 7, {
          width: colWidths[colIndex] - 10,
          height: rowH - 9,
          lineGap: 0.7,
          align: colIndex === 4 ? "center" : "left",
        });
      cellX += colWidths[colIndex];
    });
  });
}

async function buildFallbackPdf() {
  await new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: [768, 432],
      margin: 0,
      autoFirstPage: false,
      info: {
        Title: "Contract & Obligation Tracker Pitch",
        Author: presenterName,
        Subject: "Contract & Obligation Tracker project pitch",
        Creator: "PDFKit",
        CreationDate: generatedAt,
      },
    });
    const stream = fs.createWriteStream(pdfPath);
    stream.on("finish", resolve);
    stream.on("error", reject);
    doc.on("error", reject);
    doc.pipe(stream);

    slides.forEach((slideDef, index) => {
      doc.addPage();
      doc.rect(0, 0, 768, 432).fill(index === 0 ? "#F8FBFC" : `#${theme.soft}`);

      if (index === 0) {
        drawPdfTitle(doc, slideDef, 42);
        drawPdfBullets(
          doc,
          [
            "Upload and parse contracts",
            "Extract obligations with evidence",
            "Review uncertainty",
            "Track deadlines and reminders",
          ],
          45,
          222,
          330,
          27,
        );
        doc
          .font("Helvetica-Bold")
          .fontSize(8.5)
          .fillColor(`#${theme.teal}`)
          .text(`${slideDef.presenter} · ${slideDef.role}`, 45, 194, { width: 330 });
        drawPdfImage(doc, slideDef.image, 430, 32, 300, 335, "Dashboard screenshot unavailable");
        doc
          .font("Helvetica")
          .fontSize(8)
          .fillColor(`#${theme.muted}`)
          .text(slideDef.foot, 42, 380, { width: 340 });
        drawPdfFooter(doc, index);
        return;
      }

      drawPdfTitle(doc, slideDef, 36);

      if (slideDef.flow) {
        slideDef.flow.forEach((step, stepIndex) => {
          const x = 46 + stepIndex * 112;
          doc
            .roundedRect(x, 142, 88, 44, 5)
            .fillAndStroke(
              stepIndex % 2 === 0 ? "#E7F7F4" : "#EAF6FB",
              stepIndex % 2 === 0 ? "#9EDBD2" : "#9BD7E5",
            );
          doc
            .font("Helvetica-Bold")
            .fontSize(8.5)
            .fillColor(`#${theme.ink}`)
            .text(step, x + 8, 156, { width: 72, align: "center" });
          if (stepIndex < slideDef.flow.length - 1) {
            doc
              .font("Helvetica-Bold")
              .fontSize(15)
              .fillColor(`#${theme.teal}`)
              .text(">", x + 94, 154);
          }
        });
        drawPdfBullets(doc, slideDef.bullets, 58, 232, 610, 32);
      } else if (slideDef.image) {
        drawPdfImage(doc, slideDef.image, 44, 126, 410, 276);
        drawPdfBullets(doc, slideDef.bullets, 482, 142, 230, 46);
      } else if (slideDef.metrics) {
        slideDef.metrics.forEach(([value, label], metricIndex) => {
          const row = Math.floor(metricIndex / 3);
          const col = metricIndex % 3;
          drawMetric(
            doc,
            value,
            label,
            48 + col * 124,
            144 + row * 76,
            [theme.teal, theme.cyan, theme.amber][col],
          );
        });
        doc.moveTo(405, 138).lineTo(405, 350).strokeColor(`#${theme.line}`).stroke();
        drawPdfBullets(doc, slideDef.bullets, 435, 148, 260, 43);
      } else if (slideDef.table) {
        drawPdfKpiTable(doc, slideDef.table, 44, 126, 680);
        doc
          .font("Helvetica")
          .fontSize(8)
          .fillColor(`#${theme.muted}`)
          .text(
            "Targets never populate actual results. Missing repository evidence remains Not measured.",
            48,
            372,
            {
              width: 610,
            },
          );
      } else if (slideDef.columns) {
        slideDef.columns.forEach(([heading, body], colIndex) => {
          const row = Math.floor(colIndex / 2);
          const col = colIndex % 2;
          const x = 46 + col * 350;
          const y = 144 + row * 95;
          doc.roundedRect(x, y, 315, 70, 5).fillAndStroke(`#${theme.white}`, `#${theme.line}`);
          doc
            .font("Helvetica-Bold")
            .fontSize(11)
            .fillColor(`#${theme.teal}`)
            .text(heading, x + 16, y + 13, { width: 280 });
          doc
            .font("Helvetica")
            .fontSize(9)
            .fillColor(`#${theme.ink}`)
            .text(body, x + 16, y + 34, { width: 280, lineGap: 1 });
        });
      } else {
        drawPdfBullets(doc, slideDef.bullets, 55, 148, 420, 43);
        if (slideDef.stat) {
          doc
            .roundedRect(505, 155, 185, 130, 6)
            .fillAndStroke(`#${theme.white}`, index === slides.length - 1 ? "#9EDBD2" : "#F5CACA");
          doc
            .font("Helvetica-Bold")
            .fontSize(40)
            .fillColor(index === slides.length - 1 ? `#${theme.teal}` : `#${theme.red}`)
            .text(slideDef.stat.value, 525, 184, { width: 145, align: "center" });
          doc
            .font("Helvetica")
            .fontSize(10)
            .fillColor(`#${theme.muted}`)
            .text(slideDef.stat.label, 530, 248, { width: 135, align: "center" });
        }
      }

      drawPdfFooter(doc, index);
    });

    doc.end();
  });
}

async function main() {
  ensureOutputDir();

  if (slides.length < 8 || slides.length > 10) {
    throw new Error(`Expected an 8-10 slide deck, but generated ${slides.length} slides.`);
  }

  console.log(`[pitch] Source specification: ${pitchSpec.sourcePath}`);
  console.log(`[pitch] Slides: ${slides.length}`);
  console.log(`[pitch] Format: ${cli.format}`);
  console.log("[pitch] KPI evidence:");
  slides
    .find((slide) => slide.table)
    ?.table.rows.forEach(([label, , actual, , status]) => {
      console.log(`  - ${label}: ${status} (${actual})`);
    });

  if (cli.format === "pdf" || cli.format === "both") {
    await buildFallbackPdf();
    const bytes = smokeTestOutput(pdfPath, "pdf");
    console.log(`Generated PDF:  ${pdfPath} (${bytes} bytes, native PDFKit)`);
  }

  if (cli.format === "pptx" || cli.format === "both") {
    await buildPptx();
    const bytes = smokeTestOutput(pptxPath, "pptx");
    console.log(`Generated PPTX: ${pptxPath} (${bytes} bytes, editable PptxGenJS)`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
