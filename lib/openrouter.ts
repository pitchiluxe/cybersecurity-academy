import { getSettings, type Provider } from "./settings";

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

const MAX_ATTEMPTS = 3;
// Free-model pools are often congested (429) or briefly down (5xx); both are
// worth one short retry before giving up.
const RETRYABLE_STATUSES = new Set([429, 502, 503]);

// Turn raw provider error payloads into a short, human message. The upstream
// 429 body is a deeply nested blob of provider retries — never show it as-is.
export function friendlyProviderError(status: number, body: unknown, provider: Provider): string {
  if (status === 429) {
    if (provider === "ollama") {
      return "Your local Ollama server is overloaded. Wait a moment and try again.";
    }
    return (
      "The free AI tier is busy or you've hit today's free request cap. " +
      "Wait a minute and try again, switch models in Settings, or add your own " +
      "OpenRouter API key (Settings) to lift the limit."
    );
  }
  if (status === 401 || status === 403) {
    return "The AI provider rejected the API key. Check your token in Settings / .env.local.";
  }
  if (status >= 500) {
    return "The AI provider is temporarily unavailable. Please try again in a moment.";
  }
  // 4xx we don't specifically handle — surface the provider's own message if any.
  const msg =
    typeof body === "object" && body !== null && "error" in body
      ? // OpenRouter shape is { error: { message } } or { error: string }
        (() => {
          const e = (body as { error: unknown }).error;
          if (typeof e === "string") return e;
          if (typeof e === "object" && e !== null && "message" in e && typeof (e as { message: unknown }).message === "string") {
            return (e as { message: string }).message;
          }
          return null;
        })()
      : null;
  return msg ? `AI request failed (${status}): ${msg}` : `AI request failed (${status}).`;
}

function getRetryDelayMs(attempt: number): number {
  if (process.env.NODE_ENV === "test") return 0;
  return 1500 * (attempt + 1);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface ProviderRequest {
  url: string;
  headers: Record<string, string>;
  payload: Record<string, unknown>;
}

// OpenRouter caps the `models` fallback-routing array at 3 entries.
function buildOpenRouterRequest(messages: ChatMessage[]): ProviderRequest {
  const baseUrl = process.env.ANTHROPIC_BASE_URL;
  const token = process.env.ANTHROPIC_AUTH_TOKEN;
  const settings = getSettings();
  const model = settings.openrouterModel;

  if (!token) {
    throw new MissingApiKeyError();
  }
  if (!baseUrl || !model) {
    throw new OpenRouterRequestError(500, "ANTHROPIC_BASE_URL or ANTHROPIC_MODEL is not configured");
  }

  const modelList = [model, ...settings.openrouterFallbacks.filter((m) => m !== model)].slice(0, 3);
  const payload: Record<string, unknown> = { model, messages, max_tokens: 4096 };
  if (modelList.length > 1) {
    payload.models = modelList;
  }

  return {
    url: `${baseUrl.replace(/\/$/, "")}/v1/chat/completions`,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    payload,
  };
}

// Ollama exposes an OpenAI-compatible endpoint; no API key needed.
function buildOllamaRequest(messages: ChatMessage[]): ProviderRequest {
  const settings = getSettings();
  if (!settings.ollamaModel) {
    throw new OpenRouterRequestError(500, "No Ollama model selected. Pick one in Settings.");
  }
  return {
    url: `${settings.ollamaBaseUrl.replace(/\/$/, "")}/v1/chat/completions`,
    headers: { "Content-Type": "application/json" },
    payload: { model: settings.ollamaModel, messages, max_tokens: 4096 },
  };
}

// Named for its original backend; now routes to OpenRouter or local Ollama
// depending on saved settings.
export async function callOpenRouter(messages: ChatMessage[]): Promise<string> {
  const provider = getSettings().provider;
  const request = provider === "ollama" ? buildOllamaRequest(messages) : buildOpenRouterRequest(messages);

  let lastError: OpenRouterRequestError | null = null;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    let response: Response;
    try {
      response = await fetch(request.url, {
        method: "POST",
        headers: request.headers,
        body: JSON.stringify(request.payload),
      });
    } catch (err) {
      // Connection refused (e.g. Ollama not running) — not retryable.
      throw new OpenRouterRequestError(
        503,
        provider === "ollama"
          ? `Could not reach Ollama at ${request.url}. Is the Ollama app running?`
          : `Could not reach the AI provider: ${err instanceof Error ? err.message : String(err)}`
      );
    }

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      lastError = new OpenRouterRequestError(
        response.status,
        friendlyProviderError(response.status, errBody, provider)
      );
      if (RETRYABLE_STATUSES.has(response.status) && attempt < MAX_ATTEMPTS - 1) {
        await sleep(getRetryDelayMs(attempt));
        continue;
      }
      throw lastError;
    }

    const data = await response.json().catch(() => ({}));
    const content = data?.choices?.[0]?.message?.content;
    if (typeof content !== "string" || content.length === 0) {
      throw new OpenRouterRequestError(502, "OpenRouter response had no message content");
    }
    return content;
  }

  throw lastError ?? new OpenRouterRequestError(500, "OpenRouter request failed");
}
