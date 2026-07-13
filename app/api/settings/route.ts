import { NextResponse } from "next/server";
import { getSettings, saveSettings, isProvider, type AppSettings } from "@/lib/settings";

// Without this, Next statically optimizes the GET at build time — the deployed
// route then serves a frozen response and rejects PUT with a 405.
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const settings = await getSettings();
  // Temporary diagnostics for the hosted deployment (?debug=1): which store the
  // runtime actually reads. Remove once the Vercel settings issue is closed.
  if (new URL(request.url).searchParams.get("debug") === "1") {
    const debug: Record<string, unknown> = {
      dbHost: (process.env.TURSO_DATABASE_URL ?? "file").slice(0, 64),
      vercel: !!process.env.VERCEL,
    };
    try {
      const { getAppSettingsJson, saveAppSettingsJson, countRows } = await import("@/lib/db");
      await saveAppSettingsJson(JSON.stringify({ probe: Date.now() }));
      debug.readAfterWrite = (await getAppSettingsJson())?.slice(0, 60) ?? null;
      debug.userCount = await countRows("users");
      debug.settingsCount = await countRows("app_settings");
    } catch (err) {
      debug.dbError = err instanceof Error ? err.message : String(err);
    }
    return NextResponse.json({ settings, debug }, { status: 200 });
  }
  return NextResponse.json({ settings }, { status: 200 });
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

  const settings = await saveSettings(update);
  return NextResponse.json({ settings }, { status: 200 });
}
