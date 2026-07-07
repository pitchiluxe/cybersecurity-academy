import { NextResponse } from "next/server";
import { getCookieValue, verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/session";
import { callOpenRouter, MissingApiKeyError, OpenRouterRequestError } from "@/lib/openrouter";
import { buildTutorMessages, isTrackId, type Course, type TutorMessage } from "@/lib/courses";
import { getCourseRow } from "@/lib/db";

function isTutorMessage(value: unknown): value is TutorMessage {
  if (typeof value !== "object" || value === null) return false;
  const m = value as Record<string, unknown>;
  return (m.role === "user" || m.role === "assistant") && typeof m.content === "string";
}

export async function POST(request: Request) {
  const token = getCookieValue(request, SESSION_COOKIE_NAME);
  const session = token ? await verifySessionToken(token) : null;
  if (!session) {
    return NextResponse.json({ error: "Not logged in." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const track = body?.track;
  const moduleIndex = body?.moduleIndex;
  const messages = body?.messages;
  if (typeof track !== "string" || !isTrackId(track)) {
    return NextResponse.json({ error: "Unknown track" }, { status: 400 });
  }
  if (
    typeof moduleIndex !== "number" ||
    !Array.isArray(messages) ||
    messages.length === 0 ||
    !messages.every(isTutorMessage)
  ) {
    return NextResponse.json({ error: "moduleIndex and messages[] required" }, { status: 400 });
  }

  const row = getCourseRow(session.userId, track);
  if (!row) {
    return NextResponse.json({ error: "Course not generated yet" }, { status: 404 });
  }
  const course = JSON.parse(row.content_json) as Course;
  const module = course.modules[moduleIndex];
  if (!module) {
    return NextResponse.json({ error: "No such module" }, { status: 400 });
  }

  try {
    const reply = await callOpenRouter(buildTutorMessages(track, module, messages));
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
