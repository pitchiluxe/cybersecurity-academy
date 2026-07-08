import { callOpenRouter, readOllamaStream, MissingApiKeyError, OpenRouterRequestError, friendlyProviderError } from "./openrouter";

const ORIGINAL_ENV = process.env;

beforeEach(() => {
  process.env = { ...ORIGINAL_ENV };
  process.env.ANTHROPIC_BASE_URL = "https://openrouter.ai/api";
  process.env.ANTHROPIC_AUTH_TOKEN = "test-token";
  process.env.ANTHROPIC_MODEL = "deepseek/deepseek-v4-flash:free";
  delete process.env.ANTHROPIC_FALLBACK_MODELS;
  global.fetch = jest.fn();
});

afterEach(() => {
  process.env = ORIGINAL_ENV;
  jest.resetAllMocks();
});

describe("friendlyProviderError", () => {
  const rawBody = { error: { message: "Provider returned error", code: 429, metadata: { raw: "…" } } };

  it("gives a clean, JSON-free message for a 429 without leaking the raw body", () => {
    const msg = friendlyProviderError(429, rawBody, "openrouter");
    expect(msg).toMatch(/free request cap|rate|Settings/i);
    expect(msg).not.toContain("{");
    expect(msg).not.toContain("metadata");
  });

  it("distinguishes an Ollama overload from OpenRouter limits", () => {
    expect(friendlyProviderError(429, {}, "ollama")).toMatch(/Ollama/i);
  });

  it("flags auth failures and provider outages", () => {
    expect(friendlyProviderError(401, {}, "openrouter")).toMatch(/key/i);
    expect(friendlyProviderError(503, {}, "openrouter")).toMatch(/temporarily unavailable/i);
  });
});

describe("readOllamaStream", () => {
  const enc = new TextEncoder();
  async function* chunks(...parts: string[]) {
    for (const p of parts) yield enc.encode(p);
  }

  it("accumulates message content across NDJSON lines even when chunks split a line", async () => {
    const body = chunks(
      '{"message":{"content":"Hel"},"done":false}\n{"message":{"con',
      'tent":"lo"},"done":false}\n',
      '{"message":{"content":""},"done":true}\n'
    );
    await expect(readOllamaStream(body)).resolves.toBe("Hello");
  });

  it("handles a final line without a trailing newline", async () => {
    const body = chunks('{"message":{"content":"ok"},"done":true}');
    await expect(readOllamaStream(body)).resolves.toBe("ok");
  });

  it("surfaces in-stream Ollama errors as OpenRouterRequestError", async () => {
    const body = chunks('{"error":"model \'nope\' not found"}\n');
    await expect(readOllamaStream(body)).rejects.toThrow(OpenRouterRequestError);
    await expect(readOllamaStream(chunks('{"error":"model not found"}\n'))).rejects.toThrow(/model not found/);
  });

  it("rejects malformed stream chunks", async () => {
    await expect(readOllamaStream(chunks("this is not json\n"))).rejects.toThrow(/malformed/i);
  });
});

describe("callOpenRouter", () => {
  it("posts to the v1 chat completions endpoint with the right headers and body", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ choices: [{ message: { content: "hello back" } }] }),
    });

    const result = await callOpenRouter([{ role: "user", content: "hi" }]);

    expect(result).toBe("hello back");
    expect(global.fetch).toHaveBeenCalledWith(
      "https://openrouter.ai/api/v1/chat/completions",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer test-token",
          "Content-Type": "application/json",
        }),
      })
    );
    const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
    expect(body).toEqual({
      model: "deepseek/deepseek-v4-flash:free",
      messages: [{ role: "user", content: "hi" }],
      max_tokens: 4096,
    });
  });

  it("throws MissingApiKeyError when ANTHROPIC_AUTH_TOKEN is empty", async () => {
    process.env.ANTHROPIC_AUTH_TOKEN = "";
    await expect(callOpenRouter([{ role: "user", content: "hi" }])).rejects.toThrow(MissingApiKeyError);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("retries a 429 up to three attempts, then throws with the response status", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 429,
      json: async () => ({ error: "rate limited" }),
    });

    await expect(callOpenRouter([{ role: "user", content: "hi" }])).rejects.toMatchObject({
      status: 429,
    });
    expect(global.fetch).toHaveBeenCalledTimes(3);
  });

  it("does not retry a non-retryable status such as 400", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: "bad request" }),
    });

    await expect(callOpenRouter([{ role: "user", content: "hi" }])).rejects.toMatchObject({
      status: 400,
    });
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("succeeds when a retry after a 429 returns a valid response", async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
        json: async () => ({ error: "rate limited" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ choices: [{ message: { content: "second try" } }] }),
      });

    await expect(callOpenRouter([{ role: "user", content: "hi" }])).resolves.toBe("second try");
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it("sends a models fallback array (capped at 3) when ANTHROPIC_FALLBACK_MODELS is set", async () => {
    process.env.ANTHROPIC_FALLBACK_MODELS = "model-b:free, model-c:free, model-d:free";
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ choices: [{ message: { content: "ok" } }] }),
    });

    await callOpenRouter([{ role: "user", content: "hi" }]);

    const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
    expect(body.model).toBe("deepseek/deepseek-v4-flash:free");
    expect(body.models).toEqual(["deepseek/deepseek-v4-flash:free", "model-b:free", "model-c:free"]);
  });

  it("omits the models array when no fallbacks are configured", async () => {
    delete process.env.ANTHROPIC_FALLBACK_MODELS;
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ choices: [{ message: { content: "ok" } }] }),
    });

    await callOpenRouter([{ role: "user", content: "hi" }]);

    const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
    expect(body.models).toBeUndefined();
  });

  it("throws OpenRouterRequestError when a 2xx response body fails to parse as JSON", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => {
        throw new SyntaxError("Unexpected end of JSON input");
      },
    });

    await expect(callOpenRouter([{ role: "user", content: "hi" }])).rejects.toBeInstanceOf(OpenRouterRequestError);
  });
});
