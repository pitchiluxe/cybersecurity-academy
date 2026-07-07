import { NextResponse } from "next/server";
import { getCookieValue, verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/session";
import { callOpenRouter, MissingApiKeyError, OpenRouterRequestError } from "@/lib/openrouter";
import { parseScenarioQueue, ParseError } from "@/lib/parsing";
import { buildPracticeTicketMessages, getTrack, isTrackId, type Course } from "@/lib/courses";
import { getCategoryMeta } from "@/lib/scenarios";
import { getCourseRow } from "@/lib/db";
import type { TicketPreview } from "@/lib/types";

export async function POST(request: Request) {
  const token = getCookieValue(request, SESSION_COOKIE_NAME);
  const session = token ? await verifySessionToken(token) : null;
  if (!session) {
    return NextResponse.json({ error: "Not logged in." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const track = body?.track;
  if (typeof track !== "string" || !isTrackId(track)) {
    return NextResponse.json({ error: "Unknown track" }, { status: 400 });
  }
  const row = await getCourseRow(session.userId, track);
  if (!row) {
    return NextResponse.json({ error: "Take the course first — practice tickets are built from your modules." }, { status: 404 });
  }

  const meta = getTrack(track);
  const course = JSON.parse(row.content_json) as Course;
  const messages = buildPracticeTicketMessages(meta, course.modules.map((m) => m.title));

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const text = await callOpenRouter(messages);
      const seeds = parseScenarioQueue(text, (c) => (meta.categories as string[]).includes(c));
      const tickets: TicketPreview[] = seeds.slice(0, 3).map((seed) => ({
        ...seed,
        ticketId: `PRX-${1000 + Math.floor(Math.random() * 9000)}`,
        priority: getCategoryMeta(seed.category).priority,
      }));
      return NextResponse.json({ tickets }, { status: 200 });
    } catch (err) {
      if (err instanceof MissingApiKeyError) {
        return NextResponse.json({ error: err.message }, { status: 503 });
      }
      if (err instanceof OpenRouterRequestError) {
        return NextResponse.json({ error: err.message }, { status: 502 });
      }
      if (err instanceof ParseError && attempt === 1) {
        return NextResponse.json({ error: `Could not parse practice tickets: ${err.message}` }, { status: 502 });
      }
    }
  }
  return NextResponse.json({ error: "Unreachable" }, { status: 500 });
}
