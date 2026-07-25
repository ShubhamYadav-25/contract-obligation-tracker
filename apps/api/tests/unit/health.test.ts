/**
 * @file Contains automated tests that verify contract tracker behavior.
 */
import request from "supertest";
import { describe, expect, it } from "vitest";

import { createApp } from "../../src/app.js";

describe("health endpoint", () => {
  it("returns service health", async () => {
    const response = await request(createApp()).get("/health").expect(200);

    expect(response.body).toEqual({
      success: true,
      data: {
        status: "ok",
        service: "contract-obligation-tracker-api",
      },
    });
  });
});
