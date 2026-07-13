import { NextResponse } from "next/server";
import { getSettings } from "@/lib/settings";

interface OllamaTag {
  name: string;
  size?: number;
}

async function fetchOpenRouterFreeModels(): Promise<string[]> {
  const baseUrl = process.env.ANTHROPIC_BASE_URL ?? "https://openrouter.ai/api";
  try {
    const res = await fetch(`${baseUrl.replace(/\/$/, "")}/v1/models`, {
      // Model catalog changes slowly; avoid hammering it on every settings visit.
      next: { revalidate: 300 },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data?.data ?? [])
      .map((m: { id?: string }) => m?.id)
      .filter((id: unknown): id is string => typeof id === "string" && id.endsWith(":free"))
      .sort();
  } catch {
    return [];
  }
}

async function fetchOllamaModels(baseUrl: string): Promise<{ available: boolean; models: string[] }> {
  try {
    const res = await fetch(`${baseUrl.replace(/\/$/, "")}/api/tags`, { cache: "no-store" });
    if (!res.ok) return { available: false, models: [] };
    const data = await res.json();
    const models = ((data?.models ?? []) as OllamaTag[])
      .map((m) => m.name)
      .filter((n): n is string => typeof n === "string")
      .sort();
    return { available: true, models };
  } catch {
    return { available: false, models: [] };
  }
}

export const dynamic = "force-dynamic";

export async function GET() {
  const settings = await getSettings();
  const [openrouter, ollama] = await Promise.all([
    fetchOpenRouterFreeModels(),
    fetchOllamaModels(settings.ollamaBaseUrl),
  ]);
  // On a hosted deployment the server's "localhost" is not the user's machine —
  // local Ollama is only usable when the app itself runs on the user's computer.
  return NextResponse.json({ openrouter, ollama, hosted: !!process.env.VERCEL }, { status: 200 });
}
