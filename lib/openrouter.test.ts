import { callOpenRouter, MissingApiKeyError, OpenRouterRequestError } from "./openrouter";

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
