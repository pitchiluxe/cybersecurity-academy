import { NextResponse } from "next/server";
import { getCookieValue, verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/session";
import { callOpenRouter, MissingApiKeyError, OpenRouterRequestError } from "@/lib/openrouter";
import { ParseError } from "@/lib/parsing";
import { buildCourseMessages, isTrackId, parseCourse, stripAnswers, type Course } from "@/lib/courses";
import { getCourseRow, getPassedModuleIndexes, hasCertificate, saveCourse } from "@/lib/db";

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

  const cached = getCourseRow(session.userId, track);
  if (cached) {
    const course = JSON.parse(cached.content_json) as Course;
    return NextResponse.json(
      {
        course: stripAnswers(course),
        passedModules: getPassedModuleIndexes(cached.id),
        certified: hasCertificate(session.userId, track),
      },
      { status: 200 }
    );
  }

  const messages = buildCourseMessages(track);

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const text = await callOpenRouter(messages);
      const course = parseCourse(text, track);
      saveCourse(session.userId, track, JSON.stringify(course));
      return NextResponse.json({ course: stripAnswers(course), passedModules: [], certified: false }, { status: 200 });
    } catch (err) {
      if (err instanceof MissingApiKeyError) {
        return NextResponse.json({ error: err.message }, { status: 503 });
      }
      if (err instanceof OpenRouterRequestError) {
        return NextResponse.json({ error: err.message }, { status: 502 });
      }
      if (err instanceof ParseError && attempt === 1) {
        return NextResponse.json({ error: `Could not parse course from model: ${err.message}` }, { status: 502 });
      }
    }
  }

  return NextResponse.json({ error: "Unreachable" }, { status: 500 });
}
