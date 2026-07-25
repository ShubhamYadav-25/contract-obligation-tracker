/**
 * @file Contains automated tests that verify contract tracker behavior.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

import { GroqLlmAdapter } from "../../src/infrastructure/llm/groq.adapter.js";

describe("GroqLlmAdapter", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("calls Groq chat completions and parses JSON content", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      text: async () =>
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({ obligations: [] }),
              },
            },
          ],
        }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    const adapter = new GroqLlmAdapter({
      apiKey: "test-groq-key",
      defaultModel: "llama-3.1-8b-instant",
      temperature: 0.2,
      maxTokens: 1_024,
    });

    const result = await adapter.generateStructured({
      prompt: "Extract obligations",
      responseSchemaName: "contract_obligation_extraction",
      systemInstruction: "Return JSON only.",
      timeoutMilliseconds: 1_000,
    });

    expect(result).toEqual({
      rawText: JSON.stringify({ obligations: [] }),
      parsedJson: { obligations: [] },
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.groq.com/openai/v1/chat/completions",
      expect.objectContaining({
        method: "POST",
        headers: {
          authorization: "Bearer test-groq-key",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: "llama-3.1-8b-instant",
          messages: [
            { role: "system", content: "Return JSON only." },
            { role: "user", content: "Extract obligations" },
          ],
          temperature: 0.2,
          max_tokens: 1_024,
        }),
      }),
    );
  });

  it("marks Groq rate limits as retryable provider errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        status: 429,
        statusText: "Too Many Requests",
        text: async () =>
          JSON.stringify({ error: { message: "rate limited", type: "rate_limit" } }),
      })),
    );

    const adapter = new GroqLlmAdapter({
      apiKey: "test-groq-key",
      defaultModel: "llama-3.1-8b-instant",
      temperature: 0.1,
      maxTokens: 512,
    });

    await expect(
      adapter.generateStructured({
        prompt: "Extract obligations",
        responseSchemaName: "contract_obligation_extraction",
      }),
    ).rejects.toMatchObject({
      message: "Groq structured generation failed",
      details: expect.objectContaining({
        retryable: true,
        providerMessage: "rate limited",
      }),
    });
  });
});
