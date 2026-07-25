/**
 * @file Contains unit tests for Brevo email API delivery.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

import { BrevoEmailAdapter } from "../../src/infrastructure/email/brevo.adapter.js";

describe("BrevoEmailAdapter", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("verifies the Brevo account with the configured API key", async () => {
    const fetchMock = vi.fn(async (..._args: Parameters<typeof fetch>) =>
      new Response(JSON.stringify({ email: "sender@test.dev" })),
    );
    vi.stubGlobal("fetch", fetchMock);
    const adapter = new BrevoEmailAdapter({
      apiKey: "test-key",
      senderEmail: "sender@test.dev",
      senderName: "Contract Tracker",
    });

    const result = await adapter.verifyAccount();

    expect(result.status).toBe("verified");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.brevo.com/v3/account",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({ "api-key": "test-key" }),
      }),
    );
  });

  it("posts a Brevo transactional email payload", async () => {
    const fetchMock = vi.fn(async (..._args: Parameters<typeof fetch>) =>
      new Response(JSON.stringify({ messageId: "brevo-1" })),
    );
    vi.stubGlobal("fetch", fetchMock);
    const adapter = new BrevoEmailAdapter({
      apiKey: "test-key",
      senderEmail: "sender@test.dev",
      senderName: "Contract Tracker",
    });

    const result = await adapter.send({
      recipient: "reviewer@test.dev",
      subject: "Reminder",
      bodyText: "Plain body",
      bodyHtml: "<p>HTML body</p>",
    });

    const request = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
    expect(result).toEqual({ status: "accepted", providerMessageId: "brevo-1" });
    expect(JSON.parse(String(request?.body ?? "{}"))).toMatchObject({
      sender: { name: "Contract Tracker", email: "sender@test.dev" },
      to: [{ email: "reviewer@test.dev" }],
      subject: "Reminder",
      htmlContent: "<p>HTML body</p>",
      textContent: "Plain body",
    });
  });

  it("throws a service error when Brevo rejects the send request", async () => {
    const fetchMock = vi.fn(
      async (..._args: Parameters<typeof fetch>) =>
        new Response(JSON.stringify({ message: "invalid api key" }), {
          status: 401,
        }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const adapter = new BrevoEmailAdapter({
      apiKey: "bad-key",
      senderEmail: "sender@test.dev",
      senderName: "Contract Tracker",
    });

    await expect(
      adapter.send({
        recipient: "reviewer@test.dev",
        subject: "Reminder",
        bodyText: "Plain body",
      }),
    ).rejects.toThrow("Brevo email sending failed");
  });
});
