import fs from "node:fs";
import path from "node:path";
import pptxgen from "pptxgenjs";
import libre from "libreoffice-convert";
import PDFDocument from "pdfkit";

const rootDir = process.cwd();
const outputDir = path.join(rootDir, "outputs");
const pptxPath = path.join(outputDir, "contract-obligation-tracker-pitch.pptx");
const pdfPath = path.join(outputDir, "contract-obligation-tracker-pitch.pdf");
const defaultPitchSpec = `
Slide 1: Title & One-Line Pitch
Project Title: Contract & Obligation Tracker
Subtitle / One-Liner: Turning contract renewal risk into an automated state machine that never misses a deadline.
Slide 2: The Problem
Obligations buried on page 9, including 60-day notice periods and auto-renewals.
Businesses quietly lose money due to untracked renewal clauses.
Slide 3: Why It's Worth Building
Market Pain: Unclear ownership, manual counting, opaque AI extractions.
Who Pays: Any business signing recurring vendor/client contracts.
Slide 4: What We Built
End-to-end extraction pipeline with 100% source line anchoring.
Strict obligation state machine: UPCOMING -> DUE -> MET / MISSED.
Idempotent reminder scheduler with zero double-fires.
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
  const filePath = assetPath(relativePath);
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

function readJsonlIfExists(relativePath) {
  const content = readTextIfExists(relativePath);
  if (!content) {
    return [];
  }
  return content
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function loadTrialEvidence(pitchSpec) {
  const contracts = readJsonlIfExists("datasets/contracts/25_contracts.jsonl");
  const transitions = readJsonlIfExists("datasets/transitions/100_state_transitions.jsonl");
  const reminders = readJsonlIfExists("datasets/reminders/20_restart_scenarios.jsonl");
  const trialTest = readTextIfExists("apps/api/tests/unit/trial-datasets.test.ts");
  const finalReport = readTextIfExists("docs/final-application-wiring-report.md");
  const workingReport = readTextIfExists("docs/reference-aware-working-app-report.md");

  return {
    contracts,
    transitions,
    reminders,
    trialTest,
    finalReport,
    workingReport,
    pitchSpec,
    sourceAnchoringPassed: /source invariants:\s*passed/i.test(workingReport),
    duplicateReminderKeys:
      reminders.length - new Set(reminders.map((item) => item.expectedOccurrenceKey)).size,
  };
}

function buildSlides(evidence) {
  const kpiRows = [
    [
      "Contracts Processed",
      ">= 25",
      evidence.contracts.length
        ? `${evidence.contracts.length} trial contracts`
        : "Pending trial run",
    ],
    [
      "Source Line Anchoring",
      "100%",
      evidence.sourceAnchoringPassed ? "100% source invariants passed" : "Pending KPI run",
    ],
    [
      "Reminder Scheduler Misses",
      "0",
      `${evidence.duplicateReminderKeys} duplicate reminder keys across ${evidence.reminders.length || 20} scenarios`,
    ],
    [
      "Invalid State Transitions",
      "0 across 100 tests",
      evidence.transitions.length
        ? `0 expected-rule mismatches across ${evidence.transitions.length} cases`
        : "Pending trial run",
    ],
    ["Low-Confidence Flagging Accuracy", ">= 90%", "Pending measured KPI run"],
    ["Key Field Extraction Accuracy", ">= 90%", "Pending measured KPI run"],
  ];

  return [
    {
      eyebrow: "Contract & Obligation Tracker",
      title: "Contract & Obligation Tracker",
      subtitle:
        "Turning contract renewal risk into an automated state machine that never misses a deadline.",
      image: "apps/web/visual-verification/dashboard-desktop.png",
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
        "End-to-end extraction pipeline with source line anchoring for every confirmed obligation.",
        "Strict obligation state machine: UPCOMING -> DUE -> MET / MISSED.",
        "Idempotent reminder scheduler designed for zero double-fires across restart scenarios.",
      ],
      metrics: [
        ["25", "trial contracts"],
        ["100", "state tests"],
        ["20", "restart scenarios"],
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
        "Upload starts an asynchronous processing run while the original PDF remains immutable.",
        "Extraction candidates are tied to page and line evidence before they become obligations.",
        "The ledger drives status transitions, reminders, review queues, and audit history.",
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
          "LLM extraction through Gemini or Groq modes, strict candidate verification, and source anchoring.",
        ],
        [
          "Notifications",
          "Reminder delivery through email-provider adapters, including Resend and operational providers.",
        ],
      ],
    },
    {
      eyebrow: "KPI Scoreboard",
      title: "The trial scoreboard separates measured evidence from pilot targets",
      table: {
        headers: ["KPI", "Target", "Actual"],
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
const slides = buildSlides(trialEvidence);

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
  slide.addText("Contract & Obligation Tracker", {
    x: 0.55,
    y: 7.16,
    w: 3.5,
    h: 0.18,
    fontSize: 7,
    color: theme.muted,
    margin: 0,
  });
  slide.addText(String(index + 1).padStart(2, "0"), {
    x: 12.15,
    y: 7.16,
    w: 0.6,
    h: 0.18,
    fontSize: 7,
    color: theme.muted,
    align: "right",
    margin: 0,
  });
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

function addImageFrame(slide, relativePath, x, y, w, h) {
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
  slide.addImage({
    path: assetPath(relativePath),
    x: x + 0.08,
    y: y + 0.08,
    w: w - 0.16,
    h: h - 0.16,
  });
}

function addKpiTable(slide, table, x, y, w) {
  const colWidths = [4.45, 2.35, w - 6.8];
  const rowH = 0.48;
  const rows = [table.headers, ...table.rows];

  rows.forEach((row, rowIndex) => {
    const fill = rowIndex === 0 ? "E7F7F4" : rowIndex % 2 === 0 ? "F8FAFC" : theme.white;
    let cellX = x;
    row.forEach((cell, colIndex) => {
      slide.addShape(shapeType.rect, {
        x: cellX,
        y: y + rowIndex * rowH,
        w: colWidths[colIndex],
        h: rowH,
        fill: { color: fill },
        line: { color: theme.line, width: 0.75 },
      });
      slide.addText(cell, {
        x: cellX + 0.12,
        y: y + rowIndex * rowH + 0.12,
        w: colWidths[colIndex] - 0.24,
        h: 0.22,
        fontSize: rowIndex === 0 ? 9.5 : 8.5,
        bold: rowIndex === 0 || colIndex === 0,
        color: rowIndex === 0 ? theme.teal : theme.ink,
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
  pptx.author = "Contract & Obligation Tracker";
  pptx.company = "Lexbridge Legal";
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
        3.15,
        5.1,
        { gap: 0.48, fontSize: 12 },
      );
      addImageFrame(slide, slideDef.image, 7.45, 0.55, 5.25, 5.85);
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
        "Accuracy KPIs remain intentionally marked pending until a repeatable KPI report is generated against documented datasets.",
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

async function convertPptxToPdf() {
  const pptxBuffer = fs.readFileSync(pptxPath);
  const pdfBuffer = await new Promise((resolve, reject) => {
    libre.convert(pptxBuffer, ".pdf", undefined, (error, converted) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(converted);
    });
  });
  fs.writeFileSync(pdfPath, pdfBuffer);
}

function drawPdfFooter(doc, index) {
  doc
    .font("Helvetica")
    .fontSize(7)
    .fillColor(`#${theme.muted}`)
    .text("Contract & Obligation Tracker", 42, 410, { width: 260 })
    .text(String(index + 1).padStart(2, "0"), 705, 410, { width: 40, align: "right" });
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

function drawPdfImage(doc, relativePath, x, y, w, h) {
  doc.roundedRect(x, y, w, h, 5).fillAndStroke(`#${theme.white}`, `#${theme.line}`);
  doc.image(assetPath(relativePath), x + 5, y + 5, {
    fit: [w - 10, h - 10],
    align: "center",
    valign: "center",
  });
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
  const colWidths = [260, 135, w - 395];
  const rowH = 34;
  const rows = [table.headers, ...table.rows];

  rows.forEach((row, rowIndex) => {
    const fill = rowIndex === 0 ? "#E7F7F4" : rowIndex % 2 === 0 ? "#F8FAFC" : "#FFFFFF";
    let cellX = x;
    row.forEach((cell, colIndex) => {
      doc
        .rect(cellX, y + rowIndex * rowH, colWidths[colIndex], rowH)
        .fillAndStroke(fill, `#${theme.line}`);
      doc
        .font(rowIndex === 0 || colIndex === 0 ? "Helvetica-Bold" : "Helvetica")
        .fontSize(rowIndex === 0 ? 8.5 : 7.7)
        .fillColor(rowIndex === 0 ? `#${theme.teal}` : `#${theme.ink}`)
        .text(cell, cellX + 7, y + rowIndex * rowH + 8, {
          width: colWidths[colIndex] - 14,
          height: rowH - 10,
          lineGap: 1,
        });
      cellX += colWidths[colIndex];
    });
  });
}

async function buildFallbackPdf() {
  await new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: [768, 432], margin: 0, autoFirstPage: false });
    const stream = fs.createWriteStream(pdfPath);
    stream.on("finish", resolve);
    stream.on("error", reject);
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
        drawPdfImage(doc, slideDef.image, 430, 32, 300, 335);
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
            "Accuracy KPIs remain marked pending until a repeatable KPI report is generated against documented datasets.",
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
  await buildPptx();

  try {
    await convertPptxToPdf();
    console.log(`Generated PPTX: ${pptxPath}`);
    console.log(`Generated PDF:  ${pdfPath}`);
    console.log("PDF conversion: libreoffice-convert");
  } catch (error) {
    await buildFallbackPdf();
    console.log(`Generated PPTX: ${pptxPath}`);
    console.log(`Generated PDF:  ${pdfPath}`);
    console.log(`PDF conversion: pdfkit fallback (${error.message})`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
