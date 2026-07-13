import { NextResponse } from "next/server";
import { getCookieValue, verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/session";
import { callOpenRouter, MissingApiKeyError, OpenRouterRequestError } from "@/lib/openrouter";
import { isTrackId } from "@/lib/courses";
import {
  EXAM_SPECS,
  EXAM_BATCH_SIZE,
  buildExamBatchMessages,
  parseExamBatch,
  stripExamAnswers,
  type Exam,
  type ExamRecord,
  type ExamQuestion,
} from "@/lib/exam";
import { getExamRow, saveExam, deleteExam } from "@/lib/db";
import { ParseError } from "@/lib/parsing";

// Exam generation runs several sequential LLM calls (90+ questions in batches).
export const maxDuration = 300;

export async function POST(request: Request) {
  const token = getCookieValue(request, SESSION_COOKIE_NAME);
  const session = token ? await verifySessionToken(token) : null;
  if (!session) {
    return NextResponse.json({ error: "Not logged in." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const track = body?.track;
  if (typeof track !== "string" || !isTrackId(track)) {
    return NextResponse.json({ error: "Unknown track" }, { status: 400 });
  }
  const spec = EXAM_SPECS[track];

  if (body?.fresh === true) {
    await deleteExam(session.userId, track);
  }

  const cached = await getExamRow(session.userId, track);
  if (cached) {
    const record = JSON.parse(cached.content_json) as ExamRecord;
    return NextResponse.json(
      { exam: stripExamAnswers(record.exam), spec, attempts: record.attempts, cached: true },
      { status: 200 }
    );
  }

  const questions: ExamQuestion[] = [];
  const batches = Math.ceil(spec.questions / EXAM_BATCH_SIZE);
  try {
    for (let b = 0; b < batches; b++) {
      const count = Math.min(EXAM_BATCH_SIZE, spec.questions - b * EXAM_BATCH_SIZE);
      // One retry per batch on malformed JSON before giving up.
      let batch;
      try {
        batch = parseExamBatch(await callOpenRouter(buildExamBatchMessages(track, b, count), { maxTokens: 8192 }));
      } catch (err) {
        if (!(err instanceof ParseError)) throw err;
        batch = parseExamBatch(await callOpenRouter(buildExamBatchMessages(track, b, count), { maxTokens: 8192 }));
      }
      // Models sometimes over-deliver; keep exactly the requested count so the
      // exam matches the real-world question total.
      batch.slice(0, count).forEach((q) => questions.push({ ...q, id: questions.length + 1 }));
    }
  } catch (err) {
    if (err instanceof MissingApiKeyError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    if (err instanceof OpenRouterRequestError || err instanceof ParseError) {
      return NextResponse.json(
        { error: `Could not generate the exam right now (${err.message}). Try again when the AI provider is available.` },
        { status: 502 }
      );
    }
    throw err;
  }

  const exam: Exam = { track, code: spec.code, questions };
  const record: ExamRecord = { exam, attempts: [] };
  await saveExam(session.userId, track, JSON.stringify(record));

  return NextResponse.json({ exam: stripExamAnswers(exam), spec, attempts: [], cached: false }, { status: 200 });
}
