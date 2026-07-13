import { NextResponse } from "next/server";
import { getCookieValue, verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/session";
import { callOpenRouter, MissingApiKeyError, OpenRouterRequestError } from "@/lib/openrouter";
import { ParseError } from "@/lib/parsing";
import {
  getBootcampSkill,
  isBootcampSkillId,
  buildBootcampChapterMessages,
  parseBootcampChapter,
  stripBootcampAnswers,
  type BootcampChapter,
} from "@/lib/bootcamp";
import { getBootcampChapterRow, saveBootcampChapter } from "@/lib/db";

export async function POST(request: Request) {
  const token = getCookieValue(request, SESSION_COOKIE_NAME);
  const session = token ? await verifySessionToken(token) : null;
  if (!session) {
    return NextResponse.json({ error: "Not logged in." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const skillId = body?.skill;
  if (!isBootcampSkillId(skillId)) {
    return NextResponse.json({ error: "Unknown bootcamp skill" }, { status: 400 });
  }
  const skill = getBootcampSkill(skillId)!;

  const cached = await getBootcampChapterRow(session.userId, skillId);
  if (cached) {
    const chapter = JSON.parse(cached.content_json) as BootcampChapter;
    return NextResponse.json({ chapter: stripBootcampAnswers(chapter), cached: true }, { status: 200 });
  }

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const text = await callOpenRouter(buildBootcampChapterMessages(skill));
      const chapter = parseBootcampChapter(text);
      await saveBootcampChapter(session.userId, skillId, JSON.stringify(chapter));
      const stored = JSON.parse((await getBootcampChapterRow(session.userId, skillId))!.content_json) as BootcampChapter;
      return NextResponse.json({ chapter: stripBootcampAnswers(stored), cached: false }, { status: 200 });
    } catch (err) {
      if (err instanceof MissingApiKeyError) {
        return NextResponse.json({ error: err.message }, { status: 503 });
      }
      if (err instanceof OpenRouterRequestError) {
        return NextResponse.json({ error: err.message }, { status: 502 });
      }
      if (err instanceof ParseError && attempt === 1) {
        return NextResponse.json({ error: `Could not parse the chapter: ${err.message}` }, { status: 502 });
      }
    }
  }
  return NextResponse.json({ error: "Unreachable" }, { status: 500 });
}
