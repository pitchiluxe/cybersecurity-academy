import { NextResponse } from "next/server";
import { getCookieValue, verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/session";
import { isTrackId } from "@/lib/courses";
import { gradeExam, type ExamRecord } from "@/lib/exam";
import { getExamRow, updateExamJson } from "@/lib/db";

export async function POST(request: Request) {
  const token = getCookieValue(request, SESSION_COOKIE_NAME);
  const session = token ? await verifySessionToken(token) : null;
  if (!session) {
    return NextResponse.json({ error: "Not logged in." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const track = body?.track;
  const answers = body?.answers;
  if (typeof track !== "string" || !isTrackId(track)) {
    return NextResponse.json({ error: "Unknown track" }, { status: 400 });
  }
  if (!Array.isArray(answers) || !answers.every((a) => typeof a === "number" || a === null)) {
    return NextResponse.json({ error: "answers[] required" }, { status: 400 });
  }

  const row = await getExamRow(session.userId, track);
  if (!row) {
    return NextResponse.json({ error: "Exam not generated yet" }, { status: 404 });
  }
  const record = JSON.parse(row.content_json) as ExamRecord;
  if (answers.length !== record.exam.questions.length) {
    return NextResponse.json(
      { error: `Expected ${record.exam.questions.length} answers, got ${answers.length}` },
      { status: 400 }
    );
  }

  const result = gradeExam(track, record.exam, answers.map((a: number | null) => (a === null ? -1 : a)));
  record.attempts.push({
    date: new Date().toISOString(),
    scaled: result.scaled,
    percent: result.percent,
    passed: result.passed,
  });
  await updateExamJson(session.userId, track, JSON.stringify(record));

  return NextResponse.json({ result, attempts: record.attempts }, { status: 200 });
}
