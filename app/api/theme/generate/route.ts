import { NextResponse } from "next/server";
import { getCookieValue, verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/session";
import { callOpenRouter, MissingApiKeyError, OpenRouterRequestError } from "@/lib/openrouter";
import { buildThemeMessages, parseGeneratedTheme } from "@/lib/themeGen";
import { ParseError } from "@/lib/parsing";

export async function POST(request: Request) {
  const token = getCookieValue(request, SESSION_COOKIE_NAME);
  const session = token ? await verifySessionToken(token) : null;
  if (!session) {
    return NextResponse.json({ error: "Not logged in." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const vibe = typeof body?.vibe === "string" && body.vibe.trim() !== "" ? body.vibe.trim().slice(0, 120) : "surprise me — pick a striking mood that still reads professionally";

  try {
    // One retry on malformed output before giving up.
    let theme;
    try {
      theme = parseGeneratedTheme(await callOpenRouter(buildThemeMessages(vibe)));
    } catch (err) {
      if (!(err instanceof ParseError)) throw err;
      theme = parseGeneratedTheme(await callOpenRouter(buildThemeMessages(vibe)));
    }
    return NextResponse.json({ theme }, { status: 200 });
  } catch (err) {
    if (err instanceof MissingApiKeyError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    if (err instanceof OpenRouterRequestError || err instanceof ParseError) {
      return NextResponse.json({ error: err.message }, { status: 502 });
    }
    throw err;
  }
}
