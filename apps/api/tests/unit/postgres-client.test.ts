import { describe, expect, it } from "vitest";

import { PgPoolClient } from "../../src/infrastructure/database/postgres-client.js";

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
});
