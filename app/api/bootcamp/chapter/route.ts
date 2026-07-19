import { NextResponse } from "next/server";
import { getCookieValue, verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/session";
import { callOpenRouter, MissingApiKeyError } from "@/lib/openrouter";
import {
  getBootcampSkill,
  isBootcampSkillId,
  buildBootcampChapterMessages,
  parseBootcampChapter,
  stripBootcampAnswers,
  chapterLabSeed,
  type BootcampChapter,
} from "@/lib/bootcamp";
import { getBootcampChapterRow, saveBootcampChapter } from "@/lib/db";

// Every open writes a FRESH chapter (new lesson angles, new quiz questions,
// new lesson-matched VM lab) and overwrites the stored copy so quiz grading
// always matches what the trainee is looking at. The previous copy is the
// fallback when the daily model quota or a parse failure blocks generation.
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

  let lastError: Error | null = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      // Lesson + quiz + lab spec is a long structured output; give it headroom
      // so free-tier models don't truncate mid-JSON.
      const text = await callOpenRouter(buildBootcampChapterMessages(skill), { maxTokens: 8192 });
      let chapter;
      try {
        chapter = parseBootcampChapter(text);
      } catch (err) {
        console.error(`[chapter] parse failed (len=${text.length}): ${(err as Error).message}\nhead: ${text.slice(0, 300)}\ntail: ${text.slice(-300)}`);
        throw err;
      }
      await saveBootcampChapter(session.userId, skillId, JSON.stringify(chapter));
      return NextResponse.json(
        { chapter: stripBootcampAnswers(chapter), labSeed: chapterLabSeed(skill, chapter), cached: false },
        { status: 200 }
      );
    } catch (err) {
      if (err instanceof MissingApiKeyError) {
        return NextResponse.json({ error: err.message }, { status: 503 });
      }
      lastError = err as Error;
    }
  }

  const cached = await getBootcampChapterRow(session.userId, skillId);
  if (cached) {
    const chapter = JSON.parse(cached.content_json) as BootcampChapter;
    return NextResponse.json(
      { chapter: stripBootcampAnswers(chapter), labSeed: chapterLabSeed(skill, chapter), cached: true },
      { status: 200 }
    );
  }

  return NextResponse.json(
    { error: lastError?.message ?? "Could not generate the chapter." },
    { status: 502 }
  );
}
