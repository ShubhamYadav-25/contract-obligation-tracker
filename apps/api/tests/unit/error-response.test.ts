import request from "supertest";
import { describe, expect, it } from "vitest";

import { createApp } from "../../src/app.js";

describe("centralized error responses", () => {
  it("maps not-found errors to the API error shape", async () => {
    const response = await request(createApp())
      .get("/missing")
      .set("x-correlation-id", "test-correlation-id")
      .expect(404);

    expect(response.body).toEqual({
      success: false,
      error: {
        code: "NOT_FOUND",
        message: "Route was not found",
        details: {
          method: "GET",
          path: "/missing",
        },
        correlationId: "test-correlation-id",
      },
    });
  });
});
