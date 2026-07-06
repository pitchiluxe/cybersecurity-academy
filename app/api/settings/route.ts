import { NextResponse } from "next/server";
import { getSettings, saveSettings, type AppSettings, type Provider } from "@/lib/settings";

export async function GET() {
  return NextResponse.json({ settings: getSettings() }, { status: 200 });
}

function isProvider(value: unknown): value is Provider {
  return value === "openrouter" || value === "ollama";
}

export async function PUT(request: Request) {
  const body = await request.json().catch(() => ({}));
  const update: Partial<AppSettings> = {};

  if (isProvider(body?.provider)) update.provider = body.provider;
  if (typeof body?.openrouterModel === "string" && body.openrouterModel.trim()) {
    update.openrouterModel = body.openrouterModel.trim();
  }
  if (Array.isArray(body?.openrouterFallbacks)) {
    update.openrouterFallbacks = body.openrouterFallbacks
      .filter((m: unknown): m is string => typeof m === "string")
      .map((m: string) => m.trim())
      .filter(Boolean)
      .slice(0, 2);
  }
  if (typeof body?.ollamaModel === "string" && body.ollamaModel.trim()) {
    update.ollamaModel = body.ollamaModel.trim();
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  const settings = saveSettings(update);
  return NextResponse.json({ settings }, { status: 200 });
}
