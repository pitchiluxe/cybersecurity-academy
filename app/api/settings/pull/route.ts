import { NextResponse } from "next/server";
import { getSettings } from "@/lib/settings";

export const maxDuration = 300;

// Ollama model names: repo[:tag], e.g. "llama3.2:3b" or "qwen2.5:7b-instruct".
const MODEL_NAME_PATTERN = /^[a-z0-9][a-z0-9._\/-]*(:[a-z0-9][a-z0-9._-]*)?$/i;

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const name = typeof body?.name === "string" ? body.name.trim() : "";

  if (!name || !MODEL_NAME_PATTERN.test(name)) {
    return NextResponse.json({ error: "Enter a valid Ollama model name, e.g. llama3.2:3b" }, { status: 400 });
  }

  const baseUrl = getSettings().ollamaBaseUrl.replace(/\/$/, "");

  try {
    // stream:false blocks until the pull finishes (can take minutes for big models).
    const res = await fetch(`${baseUrl}/api/pull`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, stream: false }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || (typeof data?.status === "string" && data.status !== "success")) {
      const detail = data?.error ?? data?.status ?? `HTTP ${res.status}`;
      return NextResponse.json({ error: `Ollama pull failed: ${detail}` }, { status: 502 });
    }
    return NextResponse.json({ ok: true, name }, { status: 200 });
  } catch {
    return NextResponse.json(
      { error: "Could not reach Ollama. Make sure the Ollama app is running." },
      { status: 503 }
    );
  }
}
