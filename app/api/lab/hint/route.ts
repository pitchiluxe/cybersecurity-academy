import { NextResponse } from "next/server";
import { getCookieValue, verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/session";
import { callOpenRouter, MissingApiKeyError, OpenRouterRequestError } from "@/lib/openrouter";
import { buildLabHintMessages, isLabTutorContext } from "@/lib/labTutor";

export async function POST(request: Request) {
  const token = getCookieValue(request, SESSION_COOKIE_NAME);
  const session = token ? await verifySessionToken(token) : null;
  if (!session) {
    return NextResponse.json({ error: "Not logged in." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const context = body?.context;
  const openTasks = body?.openTasks;
  const recentConsole = body?.recentConsole;
  if (!isLabTutorContext(context) || !Array.isArray(openTasks) || !openTasks.every((t) => typeof t === "string")) {
    return NextResponse.json({ error: "context and openTasks[] required" }, { status: 400 });
  }
  const console3 = (Array.isArray(recentConsole) ? recentConsole : [])
    .filter((h): h is { command: string; output: string } =>
      typeof h === "object" && h !== null && typeof (h as Record<string, unknown>).command === "string" && typeof (h as Record<string, unknown>).output === "string")
    .slice(-3);

  try {
    const hint = await callOpenRouter(buildLabHintMessages(context, openTasks, console3));
    return NextResponse.json({ hint }, { status: 200 });
  } catch (err) {
    if (err instanceof MissingApiKeyError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    if (err instanceof OpenRouterRequestError) {
      return NextResponse.json({ error: err.message }, { status: 502 });
    }
    throw err;
  }
}
