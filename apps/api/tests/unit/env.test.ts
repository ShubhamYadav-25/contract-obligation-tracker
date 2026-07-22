import { describe, expect, it } from "vitest";

import { parseEnv } from "../../src/config/env.js";

describe("environment validation", () => {
  it("applies local defaults", () => {
    const env = parseEnv({});

    expect(env.NODE_ENV).toBe("development");
    expect(env.API_PORT).toBe(3000);
    expect(env.DATABASE_SSL).toBe(true);
    expect(env.GROQ_EXTRACTION_MODEL).toBe("llama-3.1-8b-instant");
    expect(env.GROQ_EXTRACTION_MAX_ATTEMPTS).toBe(3);
  });

  it("requires JWT_SECRET in production", () => {
    expect(() =>
      parseEnv({
        NODE_ENV: "production",
      }),
    ).toThrow();
  });
});
