import { NextResponse } from "next/server";
import { getCookieValue, verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/session";
import { gradeQuiz, isTrackId, type Course } from "@/lib/courses";
import { checkAndIssueCertificate } from "@/lib/certification";
import { getCourseRow, recordModulePass } from "@/lib/db";

export async function POST(request: Request) {
  const token = getCookieValue(request, SESSION_COOKIE_NAME);
  const session = token ? await verifySessionToken(token) : null;
  if (!session) {
    return NextResponse.json({ error: "Not logged in." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const track = body?.track;
  const moduleIndex = body?.moduleIndex;
  const answers = body?.answers;
  if (typeof track !== "string" || !isTrackId(track)) {
    return NextResponse.json({ error: "Unknown track" }, { status: 400 });
  }
  if (typeof moduleIndex !== "number" || !Array.isArray(answers) || !answers.every((a) => typeof a === "number")) {
    return NextResponse.json({ error: "moduleIndex and numeric answers[] required" }, { status: 400 });
  }

  const row = await getCourseRow(session.userId, track);
  if (!row) {
    return NextResponse.json({ error: "Course not generated yet" }, { status: 404 });
  }
  const course = JSON.parse(row.content_json) as Course;
  const module = course.modules[moduleIndex];
  if (!module) {
    return NextResponse.json({ error: "No such module" }, { status: 400 });
  }

  const result = gradeQuiz(module, answers);
  let certIssued = false;
  if (result.passed) {
    await recordModulePass(row.id, moduleIndex, result.score);
    certIssued = await checkAndIssueCertificate(session.userId, track);
  }

  return NextResponse.json({ ...result, certIssued }, { status: 200 });
}
