import { NextResponse } from "next/server";
import { getCookieValue, verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/session";
import { callOpenRouter, MissingApiKeyError, OpenRouterRequestError } from "@/lib/openrouter";
import { buildLabTutorMessages, isLabTutorContext, isLabTutorTurn } from "@/lib/labTutor";

export async function POST(request: Request) {
  const token = getCookieValue(request, SESSION_COOKIE_NAME);
  const session = token ? await verifySessionToken(token) : null;
  if (!session) {
    return NextResponse.json({ error: "Not logged in." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const context = body?.context;
  const messages = body?.messages;
  if (!isLabTutorContext(context)) {
    return NextResponse.json({ error: "context required" }, { status: 400 });
  }
  if (!Array.isArray(messages) || messages.length === 0 || !messages.every(isLabTutorTurn)) {
    return NextResponse.json({ error: "messages[] required" }, { status: 400 });
  }

  try {
    const reply = await callOpenRouter(buildLabTutorMessages(context, messages));
    return NextResponse.json({ reply }, { status: 200 });
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
