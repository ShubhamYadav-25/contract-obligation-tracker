import type { PostgreSqlClient } from "./postgres-client.js";

export class DatabaseHealthCheck {
  constructor(private readonly client: PostgreSqlClient) {}

  async check(): Promise<{ readonly ok: boolean }> {
    await this.client.query("select 1 as ok");
    return { ok: true };
  }
}
