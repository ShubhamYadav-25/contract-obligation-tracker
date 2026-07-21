import { describe, expect, it } from "vitest";

import { parseEnv } from "../../src/config/env.js";

describe("environment validation", () => {
  it("applies local defaults", () => {
    const env = parseEnv({});

    expect(env.NODE_ENV).toBe("development");
    expect(env.API_PORT).toBe(3000);
    expect(env.DATABASE_SSL).toBe(true);
  });

  it("requires JWT_SECRET in production", () => {
    expect(() =>
      parseEnv({
        NODE_ENV: "production",
      }),
    ).toThrow();
  });
});
