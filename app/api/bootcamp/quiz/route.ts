import { NextResponse } from "next/server";
import { getCookieValue, verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/session";
import { isBootcampSkillId, type BootcampChapter } from "@/lib/bootcamp";
import { getBootcampChapterRow } from "@/lib/db";

export async function POST(request: Request) {
  const token = getCookieValue(request, SESSION_COOKIE_NAME);
  const session = token ? await verifySessionToken(token) : null;
  if (!session) {
    return NextResponse.json({ error: "Not logged in." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const skillId = body?.skill;
  const answers = body?.answers;
  if (!isBootcampSkillId(skillId)) {
    return NextResponse.json({ error: "Unknown bootcamp skill" }, { status: 400 });
  }
  if (!Array.isArray(answers) || !answers.every((a) => typeof a === "number" || a === null)) {
    return NextResponse.json({ error: "answers[] required" }, { status: 400 });
  }

  const row = await getBootcampChapterRow(session.userId, skillId);
  if (!row) {
    return NextResponse.json({ error: "Chapter not generated yet" }, { status: 404 });
  }
  const chapter = JSON.parse(row.content_json) as BootcampChapter;
  if (answers.length !== chapter.quiz.length) {
    return NextResponse.json({ error: `Expected ${chapter.quiz.length} answers` }, { status: 400 });
  }

  const correct = chapter.quiz.map((q, i) => answers[i] === q.answerIndex);
  const score = Math.round((correct.filter(Boolean).length / chapter.quiz.length) * 100);
  return NextResponse.json(
    { score, passed: score >= 80, correct, answerKey: chapter.quiz.map((q) => q.answerIndex) },
    { status: 200 }
  );
}
