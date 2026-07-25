/**
 * @file Defines backend kpi module contracts, services, routes, or persistence logic.
 */
import type { Request, Response } from "express";

import type { PostgreSqlClient } from "../../infrastructure/database/postgres-client.js";

interface KpiCountRow {
  readonly total_contracts: string | number;
  readonly completed_contracts: string | number;
  readonly failed_contracts: string | number;
  readonly total_obligations: string | number;
  readonly overdue_obligations: string | number;
}

/**
 * @description Performs the number from row helper operation for this module.
 * @param {string | number} value - Input value for value.
 * @returns {number} Result of the number from row operation.
 */
function numberFromRow(value: string | number): number {
  return typeof value === "number" ? value : Number(value);
}

/**
 * @description Performs the metric helper operation for this module.
 * @param {{ readonly kpi: string; readonly target: string; readonly actual?: string; readonly status: "PASS" | "WARN" | "FAIL" | "NOT_MEASURED"; readonly sampleSize?: number; readonly measurementMethod: string; readonly measuredAt: Date; }} input - Input value for input.
 * @returns {unknown} Result of the metric operation.
 */
function metric(input: {
  readonly kpi: string;
  readonly target: string;
  readonly actual?: string;
  readonly status: "PASS" | "WARN" | "FAIL" | "NOT_MEASURED";
  readonly sampleSize?: number;
  readonly measurementMethod: string;
  readonly measuredAt: Date;
}) {
  return {
    kpi: input.kpi,
    target: input.target,
    ...(input.actual !== undefined ? { actual: input.actual } : {}),
    status: input.status,
    ...(input.sampleSize !== undefined ? { sampleSize: input.sampleSize } : {}),
    measurementMethod: input.measurementMethod,
    measuredAt: input.measuredAt.toISOString(),
  };
}

export class KpiController {
  /**
   * @description Implements the constructor method for this service or adapter.
   * @param {PostgreSqlClient} database - Input value for database.
   * @returns {unknown} Result of the constructor operation.
   */
  constructor(private readonly database: PostgreSqlClient) {}

  /**
   * @description Implements the latest method for this service or adapter.
   * @param {Request} _request - Input value for request.
   * @param {Response} response - Input value for response.
   * @returns {Promise<void>} Result of the latest operation.
   */
  async latest(_request: Request, response: Response): Promise<void> {
    const result = await this.database.query<KpiCountRow>(
      `
        SELECT
          (SELECT COUNT(*) FROM contracts) AS total_contracts,
          (
            SELECT COUNT(*)
            FROM contract_processing_runs
            WHERE status = 'COMPLETED'
          ) AS completed_contracts,
          (
            SELECT COUNT(*)
            FROM contract_processing_runs
            WHERE status = 'FAILED'
          ) AS failed_contracts,
          (SELECT COUNT(*) FROM obligations) AS total_obligations,
          (
            SELECT COUNT(*)
            FROM obligations
            WHERE status IN ('DUE', 'MISSED')
              OR (due_at IS NOT NULL AND due_at < NOW() AND status <> 'MET')
          ) AS overdue_obligations
      `,
    );

    const row = result.rows[0];
    const measuredAt = new Date();
    const totalContracts = numberFromRow(row?.total_contracts ?? 0);
    const completedContracts = numberFromRow(row?.completed_contracts ?? 0);
    const failedContracts = numberFromRow(row?.failed_contracts ?? 0);
    const totalObligations = numberFromRow(row?.total_obligations ?? 0);
    const overdueObligations = numberFromRow(row?.overdue_obligations ?? 0);

    response.json({
      success: true,
      data: [
        metric({
          kpi: "Contracts stored",
          target: "At least one stored contract",
          actual: String(totalContracts),
          status: totalContracts > 0 ? "PASS" : "NOT_MEASURED",
          sampleSize: totalContracts,
          measurementMethod: "COUNT(*) from contracts",
          measuredAt,
        }),
        metric({
          kpi: "Processing completion",
          target: "No failed processing runs",
          actual: `${completedContracts} completed / ${failedContracts} failed`,
          status: failedContracts > 0 ? "WARN" : "PASS",
          sampleSize: completedContracts + failedContracts,
          measurementMethod: "COUNT(*) from contract_processing_runs by terminal status",
          measuredAt,
        }),
        metric({
          kpi: "Obligations extracted",
          target: "At least one persisted obligation",
          actual: String(totalObligations),
          status: totalObligations > 0 ? "PASS" : "NOT_MEASURED",
          sampleSize: totalObligations,
          measurementMethod: "COUNT(*) from obligations",
          measuredAt,
        }),
        metric({
          kpi: "Open overdue obligations",
          target: "0 due or missed obligations",
          actual: String(overdueObligations),
          status: overdueObligations > 0 ? "WARN" : "PASS",
          sampleSize: totalObligations,
          measurementMethod: "COUNT(*) from obligations by status and due_at",
          measuredAt,
        }),
      ],
      meta: {
        requestId: String(response.locals.correlationId ?? "unknown"),
      },
    });
  }
}
