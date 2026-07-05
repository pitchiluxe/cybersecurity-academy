import { callOpenRouter, MissingApiKeyError, OpenRouterRequestError } from "./openrouter";

const ORIGINAL_ENV = process.env;

beforeEach(() => {
  process.env = { ...ORIGINAL_ENV };
  process.env.ANTHROPIC_BASE_URL = "https://openrouter.ai/api";
  process.env.ANTHROPIC_AUTH_TOKEN = "test-token";
  process.env.ANTHROPIC_MODEL = "deepseek/deepseek-v4-flash:free";
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
    });
  });

  it("throws MissingApiKeyError when ANTHROPIC_AUTH_TOKEN is empty", async () => {
    process.env.ANTHROPIC_AUTH_TOKEN = "";
    await expect(callOpenRouter([{ role: "user", content: "hi" }])).rejects.toThrow(MissingApiKeyError);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("throws OpenRouterRequestError with the response status on a non-2xx response", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 429,
      json: async () => ({ error: "rate limited" }),
    });

    await expect(callOpenRouter([{ role: "user", content: "hi" }])).rejects.toMatchObject({
      status: 429,
    });
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
