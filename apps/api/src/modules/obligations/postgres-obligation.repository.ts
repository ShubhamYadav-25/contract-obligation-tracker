import type {
  TransactionContext,
  TransactionManager,
} from "../../infrastructure/database/transaction-manager.js";
import type {
  ObligationDetailRecord,
  ObligationRecord,
  ObligationSourceAnchor,
  ObligationSourceBox,
  ObligationStatus,
  ObligationTransitionHistoryRecord,
} from "./obligations.types.js";
import type {
  ExtractedObligationInput,
  ObligationDueDateRangeFilter,
  ObligationReminderFilter,
  ListObligationsResult,
  ObligationRepository,
  ObligationStatusCounts,
} from "./obligations.repository.js";
import { NotFoundError } from "../../shared/errors/not-found-error.js";

interface ObligationRow {
  readonly id: string;
  readonly contract_id: string;
  readonly contract_display_name?: string | null;
  readonly title: string;
  readonly description: string | null;
  readonly status: ObligationStatus;
  readonly due_at: Date | string | null;
  readonly reminder_status?: string | null;
  readonly next_reminder_at?: Date | string | null;
  readonly version: number | string;
  readonly anchors?: unknown;
}

interface ObligationTransitionHistoryRow {
  readonly from_status: ObligationStatus;
  readonly to_status: ObligationStatus;
  readonly actor_id: string;
  readonly occurred_at: Date | string;
}

interface ObligationCountRow {
  readonly status: ObligationStatus;
  readonly count: number | string;
}

const emptyStatusCounts: ObligationStatusCounts = {
  UPCOMING: 0,
  DUE: 0,
  MET: 0,
  MISSED: 0,
};

function toDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

function mapObligation(row: ObligationRow): ObligationRecord {
  return {
    id: row.id,
    contractId: row.contract_id,
    ...(row.contract_display_name ? { contractDisplayName: row.contract_display_name } : {}),
    title: row.title,
    description: row.description ?? "",
    status: row.status,
    ...(row.due_at ? { dueAt: toDate(row.due_at) } : {}),
    ...(row.reminder_status ? { reminderStatus: row.reminder_status } : {}),
    ...(row.next_reminder_at ? { nextReminderAt: toDate(row.next_reminder_at) } : {}),
    sourceAnchors: sourceAnchorsFromAnchors(row.anchors),
    version: Number(row.version),
  };
}

function normalizedNumber(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.max(0, Math.min(1, value));
}

function boxFromUnknown(value: unknown): ObligationSourceBox | null {
  if (!value || typeof value !== "object") return null;
  const box = value as {
    readonly x?: unknown;
    readonly y?: unknown;
    readonly width?: unknown;
    readonly height?: unknown;
  };
  const x = normalizedNumber(box.x);
  const y = normalizedNumber(box.y);
  const width = normalizedNumber(box.width);
  const height = normalizedNumber(box.height);
  if (x === null || y === null || width === null || height === null) return null;
  return { x, y, width, height };
}

function fallbackBoxFromLineOffset(lineOffset: number): ObligationSourceBox {
  const estimatedY = Math.max(0.05, Math.min(0.92, 0.08 + lineOffset * 0.024));
  return {
    x: 0.08,
    y: estimatedY,
    width: 0.84,
    height: 0.024,
  };
}

function sourceAnchorsFromAnchors(anchors: unknown): readonly ObligationSourceAnchor[] {
  if (!Array.isArray(anchors)) return [];

  const mapped: ObligationSourceAnchor[] = [];
  for (const anchor of anchors) {
    if (!anchor || typeof anchor !== "object") continue;
    const raw = anchor as {
      readonly pageNumber?: unknown;
      readonly page_number?: unknown;
      readonly lineOffset?: unknown;
      readonly line_offset?: unknown;
      readonly quotedText?: unknown;
      readonly quoted_text?: unknown;
      readonly boxes?: unknown;
    };
    const pageNumber =
      typeof raw.pageNumber === "number"
        ? raw.pageNumber
        : typeof raw.page_number === "number"
          ? raw.page_number
          : null;
    if (!pageNumber || pageNumber < 1) continue;

    const explicitBoxes = Array.isArray(raw.boxes)
      ? raw.boxes.map(boxFromUnknown).filter((box): box is ObligationSourceBox => Boolean(box))
      : [];
    const lineOffset =
      typeof raw.lineOffset === "number"
        ? raw.lineOffset
        : typeof raw.line_offset === "number"
          ? raw.line_offset
          : null;
    const boxes =
      explicitBoxes.length > 0
        ? explicitBoxes
        : lineOffset !== null
          ? [fallbackBoxFromLineOffset(lineOffset)]
          : [];
    const quotedText =
      typeof raw.quotedText === "string"
        ? raw.quotedText
        : typeof raw.quoted_text === "string"
          ? raw.quoted_text
          : undefined;

    mapped.push({
      pageNumber,
      ...(quotedText ? { quotedText } : {}),
      boxes,
    });
  }
  return mapped;
}

function sourceTextFromAnchors(anchors: unknown, fallback: string): string {
  if (!Array.isArray(anchors)) return fallback;

  const quotedText = anchors
    .map((anchor) => {
      if (!anchor || typeof anchor !== "object") return null;
      const value =
        (anchor as { readonly quotedText?: unknown; readonly quoted_text?: unknown }).quotedText ??
        (anchor as { readonly quoted_text?: unknown }).quoted_text;
      return typeof value === "string" ? value.trim() : null;
    })
    .filter((value): value is string => Boolean(value));

  return quotedText.length > 0 ? quotedText.join("\n") : fallback;
}

function mapTransitionHistory(
  rows: readonly ObligationTransitionHistoryRow[],
): readonly ObligationTransitionHistoryRecord[] {
  return rows.map((row) => ({
    fromStatus: row.from_status,
    toStatus: row.to_status,
    actorId: row.actor_id,
    occurredAt: toDate(row.occurred_at),
  }));
}

function mapStatusCounts(rows: readonly ObligationCountRow[]): ObligationStatusCounts {
  const counts = { ...emptyStatusCounts };
  for (const row of rows) {
    counts[row.status] = Number(row.count);
  }
  return counts;
}

export class PostgresObligationRepository implements ObligationRepository {
  constructor(private readonly transactions: TransactionManager) {}

  async listByOrganization(input: {
    readonly organizationId: string;
    readonly contractId?: string;
    readonly search?: string;
    readonly status?: ObligationStatus;
    readonly reminderStatus?: ObligationReminderFilter;
    readonly dueDateRange?: ObligationDueDateRangeFilter;
    readonly limit: number;
    readonly offset: number;
  }): Promise<ListObligationsResult> {
    return this.transactions.inTransaction(async ({ client }) => {
      const result = await client.query<ObligationRow>(
        `
        SELECT
          obligation.id,
          obligation.contract_id,
          contract.display_name AS contract_display_name,
          obligation.title,
          obligation.description,
          obligation.status,
          obligation.due_at,
          reminder.status AS reminder_status,
          reminder.scheduled_for AS next_reminder_at,
          obligation.anchors,
          obligation.version
        FROM obligations AS obligation
        INNER JOIN contracts AS contract
          ON contract.id = obligation.contract_id
        LEFT JOIN LATERAL (
          SELECT id, status, scheduled_for
          FROM reminders
          WHERE obligation_id = obligation.id
          ORDER BY scheduled_for ASC, created_at ASC
          LIMIT 1
        ) AS reminder ON TRUE
        WHERE contract.organization_id = $1
          AND ($2::uuid IS NULL OR obligation.contract_id = $2::uuid)
          AND (
            $5::text IS NULL
            OR obligation.title ILIKE '%' || $5 || '%'
            OR obligation.description ILIKE '%' || $5 || '%'
            OR contract.display_name ILIKE '%' || $5 || '%'
          )
          AND ($6::obligation_status IS NULL OR obligation.status = $6::obligation_status)
          AND (
            $7::text IS NULL
            OR ($7::text = 'NONE' AND reminder.id IS NULL)
            OR reminder.status::text = $7::text
          )
          AND (
            $8::text IS NULL
            OR ($8::text = 'OVERDUE' AND obligation.due_at < NOW())
            OR (
              $8::text = 'NEXT_7_DAYS'
              AND obligation.due_at >= NOW()
              AND obligation.due_at < NOW() + INTERVAL '7 days'
            )
            OR (
              $8::text = 'NEXT_30_DAYS'
              AND obligation.due_at >= NOW()
              AND obligation.due_at < NOW() + INTERVAL '30 days'
            )
          )
        ORDER BY
          obligation.due_at ASC NULLS LAST,
          obligation.created_at DESC
        LIMIT $3 OFFSET $4
      `,
        [
          input.organizationId,
          input.contractId ?? null,
          input.limit,
          input.offset,
          input.search ?? null,
          input.status ?? null,
          input.reminderStatus ?? null,
          input.dueDateRange ?? null,
        ],
      );

      const countResult = await client.query<ObligationCountRow>(
        `
          SELECT obligation.status, COUNT(*)::int AS count
          FROM obligations AS obligation
          INNER JOIN contracts AS contract
            ON contract.id = obligation.contract_id
          LEFT JOIN LATERAL (
            SELECT id, status, scheduled_for
            FROM reminders
            WHERE obligation_id = obligation.id
            ORDER BY scheduled_for ASC, created_at ASC
            LIMIT 1
          ) AS reminder ON TRUE
          WHERE contract.organization_id = $1
            AND ($2::uuid IS NULL OR obligation.contract_id = $2::uuid)
            AND (
              $3::text IS NULL
              OR obligation.title ILIKE '%' || $3 || '%'
              OR obligation.description ILIKE '%' || $3 || '%'
              OR contract.display_name ILIKE '%' || $3 || '%'
            )
            AND (
              $4::text IS NULL
              OR ($4::text = 'NONE' AND reminder.id IS NULL)
              OR reminder.status::text = $4::text
            )
            AND (
              $5::text IS NULL
              OR ($5::text = 'OVERDUE' AND obligation.due_at < NOW())
              OR (
                $5::text = 'NEXT_7_DAYS'
                AND obligation.due_at >= NOW()
                AND obligation.due_at < NOW() + INTERVAL '7 days'
              )
              OR (
                $5::text = 'NEXT_30_DAYS'
                AND obligation.due_at >= NOW()
                AND obligation.due_at < NOW() + INTERVAL '30 days'
              )
            )
          GROUP BY obligation.status
        `,
        [
          input.organizationId,
          input.contractId ?? null,
          input.search ?? null,
          input.reminderStatus ?? null,
          input.dueDateRange ?? null,
        ],
      );
      const statusCounts = mapStatusCounts(countResult.rows);
      const total = input.status
        ? statusCounts[input.status]
        : Object.values(statusCounts).reduce((sum, count) => sum + count, 0);

      return {
        items: result.rows.map(mapObligation),
        total,
        statusCounts,
      };
    });
  }

  async findById(id: string): Promise<ObligationRecord | null> {
    return this.transactions.inTransaction(async ({ client }) => {
      const result = await client.query<ObligationRow>(
        `
        SELECT id, contract_id, title, description, status, due_at, version
        FROM obligations
        WHERE id = $1
      `,
        [id],
      );

      if (result.rowCount === 0) return null;

      const row = result.rows[0];
      return row ? mapObligation(row) : null;
    });
  }

  async findDetailByOrganizationAndId(input: {
    readonly organizationId: string;
    readonly obligationId: string;
  }): Promise<ObligationDetailRecord | null> {
    return this.transactions.inTransaction(async ({ client }) => {
      const obligationResult = await client.query<ObligationRow>(
        `
        SELECT
          obligation.id,
          obligation.contract_id,
          contract.display_name AS contract_display_name,
          obligation.title,
          obligation.description,
          obligation.status,
          obligation.due_at,
          obligation.anchors,
          obligation.version
        FROM obligations AS obligation
        INNER JOIN contracts AS contract
          ON contract.id = obligation.contract_id
        WHERE obligation.id = $1
          AND contract.organization_id = $2
        LIMIT 1
      `,
        [input.obligationId, input.organizationId],
      );

      const obligationRow = obligationResult.rows[0];
      if (!obligationRow) return null;

      const historyResult = await client.query<ObligationTransitionHistoryRow>(
        `
        SELECT from_status, to_status, actor_id, occurred_at
        FROM obligation_transition_history
        WHERE obligation_id = $1
        ORDER BY occurred_at DESC
      `,
        [input.obligationId],
      );

      const obligation = mapObligation(obligationRow);
      return {
        ...obligation,
        sourceText: sourceTextFromAnchors(obligationRow.anchors, obligation.description),
        transitionHistory: mapTransitionHistory(historyResult.rows),
      };
    });
  }

  async updateStatus(input: {
    readonly id: string;
    readonly fromStatus: ObligationStatus;
    readonly toStatus: ObligationStatus;
    readonly expectedVersion: number;
  }): Promise<ObligationRecord> {
    return this.transactions.inTransaction(async ({ client }) => {
      const result = await client.query<ObligationRow>(
        `
        UPDATE obligations
        SET status = $3::obligation_status,
            version = version + 1,
            updated_at = NOW()
        WHERE id = $1
          AND status = $2::obligation_status
          AND version = $4
        RETURNING id, contract_id, title, description, status, due_at, version
      `,
        [input.id, input.fromStatus, input.toStatus, input.expectedVersion],
      );

      if (result.rowCount === 0) {
        // Either obligation not found, concurrent update/version mismatch, or invalid fromStatus
        const exists = await client.query(`SELECT status, version FROM obligations WHERE id = $1`, [
          input.id,
        ]);
        if (exists.rowCount === 0) {
          throw new NotFoundError("Obligation not found", { obligationId: input.id });
        }
        // Surface a clear error for invalid transition or version mismatch
        throw new Error("Obligation update failed due to status/version mismatch");
      }

      const row = result.rows[0];
      if (!row) {
        throw new Error("Obligation status update returned no row");
      }
      return mapObligation(row);
    });
  }

  async upsertExtractedForContract(
    input: {
      readonly contractId: string;
      readonly obligations: readonly ExtractedObligationInput[];
    },
    transaction: TransactionContext,
  ): Promise<readonly ObligationRecord[]> {
    const records: ObligationRecord[] = [];

    for (const obligation of input.obligations) {
      const result = await transaction.client.query<ObligationRow>(
        `
        WITH updated AS (
          UPDATE obligations
          SET description = $3,
              due_at = COALESCE($4::timestamptz, due_at),
              anchors = $5::jsonb,
              updated_at = NOW()
          WHERE id = (
            SELECT id
            FROM obligations
            WHERE contract_id = $1
              AND title = $2
            ORDER BY created_at ASC
            LIMIT 1
          )
          RETURNING id, contract_id, title, description, status, due_at, anchors, version
        ),
        inserted AS (
          INSERT INTO obligations (contract_id, title, description, due_at, anchors)
          SELECT $1, $2, $3, $4::timestamptz, $5::jsonb
          WHERE NOT EXISTS (SELECT 1 FROM updated)
            AND NOT EXISTS (
              SELECT 1
              FROM obligations
              WHERE contract_id = $1
                AND title = $2
            )
          RETURNING id, contract_id, title, description, status, due_at, anchors, version
        )
        SELECT id, contract_id, title, description, status, due_at, anchors, version
        FROM updated
        UNION ALL
        SELECT id, contract_id, title, description, status, due_at, anchors, version
        FROM inserted
        LIMIT 1
      `,
        [
          input.contractId,
          obligation.title,
          obligation.description,
          obligation.dueAt ?? null,
          JSON.stringify(obligation.anchors),
        ],
      );

      const row = result.rows[0];
      if (row) {
        records.push(mapObligation(row));
      }
    }

    return records;
  }
}
