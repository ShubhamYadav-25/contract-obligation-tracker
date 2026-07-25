/**
 * @file Contains automated tests that verify contract tracker behavior.
 */
import request from "supertest";
import { describe, expect, it } from "vitest";

import { createApp } from "../../src/app.js";

describe("health endpoint", () => {
  it("allows configured static app origins", async () => {
    const previousCorsOrigin = process.env.CORS_ORIGIN;
    process.env.CORS_ORIGIN =
      "https://contract-obligation-tracker-1.onrender.com,https://contract-obligation-tracker.onrender.com";

    try {
      const response = await request(createApp())
        .options("/health")
        .set("Origin", "https://contract-obligation-tracker-1.onrender.com")
        .set("Access-Control-Request-Method", "GET")
        .expect(204);

      expect(response.header["access-control-allow-origin"]).toBe(
        "https://contract-obligation-tracker-1.onrender.com",
      );
    } finally {
      if (previousCorsOrigin === undefined) {
        delete process.env.CORS_ORIGIN;
      } else {
        process.env.CORS_ORIGIN = previousCorsOrigin;
      }
    }
  });

  it("returns service health at the root path", async () => {
    const response = await request(createApp()).get("/").expect(200);

    expect(response.body).toEqual({
      success: true,
      data: {
        status: "ok",
        service: "contract-obligation-tracker-api",
      },
    });
  });

  it("allows root HEAD probes", async () => {
    await request(createApp()).head("/").expect(200);
  });

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
