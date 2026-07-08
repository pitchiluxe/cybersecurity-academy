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

export interface CallOptions {
  /** Response token budget; bump for large structured outputs (e.g. 10-20 ticket queues). Default 4096. */
  maxTokens?: number;
}

// OpenRouter caps the `models` fallback-routing array at 3 entries.
function buildOpenRouterRequest(messages: ChatMessage[], maxTokens: number): ProviderRequest {
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
  const payload: Record<string, unknown> = { model, messages, max_tokens: maxTokens };
  if (modelList.length > 1) {
    payload.models = modelList;
  }

  return {
    url: `${baseUrl.replace(/\/$/, "")}/v1/chat/completions`,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    payload,
  };
}

// Ollama native chat endpoint, streamed. Local CPU generation can take minutes;
// a non-streaming request sends zero bytes until it finishes, which trips Node
// fetch's 300s header timeout. Streaming NDJSON keeps the connection alive.
function buildOllamaRequest(messages: ChatMessage[], maxTokens: number): ProviderRequest {
  const settings = getSettings();
  if (!settings.ollamaModel) {
    throw new OpenRouterRequestError(500, "No Ollama model selected. Pick one in Settings.");
  }
  return {
    url: `${settings.ollamaBaseUrl.replace(/\/$/, "")}/api/chat`,
    headers: { "Content-Type": "application/json" },
    payload: { model: settings.ollamaModel, messages, stream: true, options: { num_predict: maxTokens } },
  };
}

// Accumulates the `message.content` fields of an Ollama NDJSON stream.
export async function readOllamaStream(body: AsyncIterable<Uint8Array>): Promise<string> {
  const decoder = new TextDecoder();
  let buffer = "";
  let content = "";
  const consumeLine = (line: string) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    let evt: unknown;
    try {
      evt = JSON.parse(trimmed);
    } catch {
      throw new OpenRouterRequestError(502, "Ollama sent a malformed stream chunk");
    }
    const err = (evt as { error?: unknown }).error;
    if (typeof err === "string" && err) {
      throw new OpenRouterRequestError(502, `Ollama error: ${err}`);
    }
    const piece = (evt as { message?: { content?: unknown } }).message?.content;
    if (typeof piece === "string") content += piece;
  };
  for await (const chunk of body) {
    buffer += decoder.decode(chunk, { stream: true });
    let newline;
    while ((newline = buffer.indexOf("\n")) !== -1) {
      consumeLine(buffer.slice(0, newline));
      buffer = buffer.slice(newline + 1);
    }
  }
  consumeLine(buffer);
  return content;
}

// Named for its original backend; now routes to OpenRouter or local Ollama
// depending on saved settings.
export async function callOpenRouter(messages: ChatMessage[], options: CallOptions = {}): Promise<string> {
  const provider = getSettings().provider;
  const maxTokens = options.maxTokens ?? 4096;

  // "auto" = best free cloud models first, local Ollama as the safety net.
  const chain: ("openrouter" | "ollama")[] = provider === "auto" ? ["openrouter", "ollama"] : [provider];
  const failures: string[] = [];
  let lastError: MissingApiKeyError | OpenRouterRequestError | null = null;

  for (const p of chain) {
    try {
      return await callProvider(p, messages, maxTokens);
    } catch (err) {
      if (err instanceof MissingApiKeyError || err instanceof OpenRouterRequestError) {
        lastError = err;
        failures.push(`${p === "ollama" ? "local Ollama" : "OpenRouter"}: ${err.message}`);
        continue;
      }
      throw err;
    }
  }

  if (chain.length > 1) {
    throw new OpenRouterRequestError(503, `All AI providers failed — ${failures.join(" · ")}`);
  }
  throw lastError ?? new OpenRouterRequestError(500, "OpenRouter request failed");
}

async function callProvider(
  provider: "openrouter" | "ollama",
  messages: ChatMessage[],
  maxTokens: number
): Promise<string> {
  const request = provider === "ollama" ? buildOllamaRequest(messages, maxTokens) : buildOpenRouterRequest(messages, maxTokens);

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

    if (provider === "ollama") {
      if (!response.body) {
        throw new OpenRouterRequestError(502, "Ollama response had no body");
      }
      const content = await readOllamaStream(response.body as unknown as AsyncIterable<Uint8Array>);
      if (content.length === 0) {
        throw new OpenRouterRequestError(502, "Ollama response had no message content");
      }
      return content;
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
