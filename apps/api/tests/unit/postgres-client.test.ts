/**
 * @file Contains automated tests that verify contract tracker behavior.
 */
import { describe, expect, it, vi } from "vitest";

import {
  DatabaseConnectionError,
  PgPoolClient,
} from "../../src/infrastructure/database/postgres-client.js";

describe("PgPoolClient", () => {
  it("registers an idle pool error handler so connection resets do not crash the process", async () => {
    const client = new PgPoolClient({
      connectionString: "postgres://user:pass@localhost:5432/postgres",
      ssl: false,
      poolMax: 1,
      connectionTimeoutMilliseconds: 100,
      idleTimeoutMilliseconds: 100,
    });

    expect(client.pool.listenerCount("error")).toBeGreaterThan(0);
    client.pool.emit("error", new Error("Connection terminated unexpectedly"));

    await client.close();
  });

  it("maps transient pool query failures to a 503 database error", async () => {
    const client = new PgPoolClient({
      connectionString: "postgres://user:pass@localhost:5432/postgres",
      ssl: false,
      poolMax: 1,
      connectionTimeoutMilliseconds: 100,
      idleTimeoutMilliseconds: 100,
    });
    const lookupFailure = Object.assign(
      new Error("getaddrinfo ENOTFOUND aws-0-ap-southeast-1.pooler.supabase.com"),
      { code: "ENOTFOUND" },
    );
    vi.spyOn(client.pool, "query").mockRejectedValue(lookupFailure);

    await expect(client.query("SELECT 1")).rejects.toMatchObject({
      code: "DATABASE_UNAVAILABLE",
      statusCode: 503,
      details: { reason: "DNS_LOOKUP_FAILED" },
    });

    await client.close();
  });

  it("retries a transient query failure once before succeeding", async () => {
    const client = new PgPoolClient({
      connectionString: "postgres://user:pass@localhost:5432/postgres",
      ssl: false,
      poolMax: 1,
      connectionTimeoutMilliseconds: 100,
      idleTimeoutMilliseconds: 100,
    });
    const query = vi
      .spyOn(client.pool, "query")
      .mockRejectedValueOnce(new Error("Connection terminated unexpectedly"))
      .mockResolvedValueOnce({ rows: [{ ok: true }], rowCount: 1 } as never);

    await expect(client.query("SELECT 1")).resolves.toEqual({
      rows: [{ ok: true }],
      rowCount: 1,
    });
    expect(query).toHaveBeenCalledTimes(2);

    await client.close();
  });

  it("preserves explicit database unavailable errors", () => {
    const error = new DatabaseConnectionError(new Error("Connection terminated due to timeout"));

    expect(error.code).toBe("DATABASE_UNAVAILABLE");
    expect(error.statusCode).toBe(503);
    expect(error.details.reason).toBe("CONNECTION_TIMEOUT");
  });
});
