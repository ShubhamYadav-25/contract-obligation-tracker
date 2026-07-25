/**
 * @file Contains automated tests that verify contract tracker behavior.
 */
import { describe, expect, it, vi } from "vitest";

import { ApiError } from "./api-error.js";
import { apiRequest, getApiBaseUrl } from "./api-client.js";

describe("api client error mapping", () => {
  it("maps structured backend errors with correlation ids", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              success: false,
              error: {
                code: "INVALID_STATE_TRANSITION",
                message: "Transition is not allowed",
                details: { from: "MISSED", to: "MET" },
                correlationId: "corr-1",
              },
            }),
            { status: 409, headers: { "content-type": "application/json" } },
          ),
      ),
    );

    await expect(apiRequest("/api/obligations/1")).rejects.toMatchObject({
      status: 409,
      code: "INVALID_STATE_TRANSITION",
      correlationId: "corr-1",
    } satisfies Partial<ApiError>);
  });

  it("validates API base URLs", () => {
    expect(() => getApiBaseUrl("not-a-url")).toThrow("VITE_API_BASE_URL");
  });
});
