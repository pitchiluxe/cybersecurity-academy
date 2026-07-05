export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export class MissingApiKeyError extends Error {
  constructor() {
    super("ANTHROPIC_AUTH_TOKEN is not set. Add it to .env.local.");
    this.name = "MissingApiKeyError";
  }
}

export class OpenRouterRequestError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "OpenRouterRequestError";
    this.status = status;
  }
}

export async function callOpenRouter(messages: ChatMessage[]): Promise<string> {
  const baseUrl = process.env.ANTHROPIC_BASE_URL;
  const token = process.env.ANTHROPIC_AUTH_TOKEN;
  const model = process.env.ANTHROPIC_MODEL;

  if (!token) {
    throw new MissingApiKeyError();
  }
  if (!baseUrl || !model) {
    throw new OpenRouterRequestError(500, "ANTHROPIC_BASE_URL or ANTHROPIC_MODEL is not configured");
  }

  const url = `${baseUrl.replace(/\/$/, "")}/v1/chat/completions`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model, messages }),
  });

  if (!response.ok) {
    const errBody = await response.json().catch(() => ({}));
    throw new OpenRouterRequestError(
      response.status,
      `OpenRouter request failed (${response.status}): ${JSON.stringify(errBody)}`
    );
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== "string") {
    throw new OpenRouterRequestError(502, "OpenRouter response had no message content");
  }
  return content;
}
