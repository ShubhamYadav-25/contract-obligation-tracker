import { describe, expect, it } from "vitest";

import { getApplicationDatabase } from "../../src/infrastructure/database/app-database.js";

describe("application database", () => {
  it("reuses one PostgreSQL pool throughout the API process", () => {
    expect(getApplicationDatabase()).toBe(getApplicationDatabase());
  });
});
