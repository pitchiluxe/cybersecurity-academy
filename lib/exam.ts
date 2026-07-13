import type { ChatMessage } from "./openrouter";
import { extractJsonArrayFromText, ParseError } from "./parsing";
import { getTrack, type TrackId } from "./courses";

/**
 * Real-world exam blueprints: question count, duration, score scale, and pass
 * mark mirror the actual certification exams as published by each vendor.
 */
export interface ExamSpec {
  code: string;
  questions: number;
  minutes: number;
  scaleMin: number;
  scaleMax: number;
  passMark: number;
}

export const EXAM_SPECS: Record<TrackId, ExamSpec> = {
  aplus:        { code: "220-1201 Core 1", questions: 90, minutes: 90, scaleMin: 100, scaleMax: 900, passMark: 675 },
  networkplus:  { code: "N10-009", questions: 90, minutes: 90, scaleMin: 100, scaleMax: 900, passMark: 720 },
  linuxplus:    { code: "XK0-005", questions: 90, minutes: 90, scaleMin: 100, scaleMax: 900, passMark: 720 },
  cloudplus:    { code: "CV0-004", questions: 90, minutes: 90, scaleMin: 100, scaleMax: 900, passMark: 750 },
  securityplus: { code: "SY0-701", questions: 90, minutes: 90, scaleMin: 100, scaleMax: 900, passMark: 750 },
  cysa:         { code: "CS0-003", questions: 85, minutes: 165, scaleMin: 100, scaleMax: 900, passMark: 750 },
  pentestplus:  { code: "PT0-003", questions: 85, minutes: 165, scaleMin: 100, scaleMax: 900, passMark: 750 },
  securityx:    { code: "CAS-005", questions: 90, minutes: 165, scaleMin: 100, scaleMax: 900, passMark: 750 },
  ccna:         { code: "200-301", questions: 100, minutes: 120, scaleMin: 300, scaleMax: 1000, passMark: 825 },
  ccnpsec:      { code: "350-701 SCOR", questions: 100, minutes: 120, scaleMin: 300, scaleMax: 1000, passMark: 825 },
  ceh:          { code: "312-50", questions: 125, minutes: 240, scaleMin: 0, scaleMax: 100, passMark: 70 },
  sscp:         { code: "SSCP", questions: 125, minutes: 180, scaleMin: 0, scaleMax: 1000, passMark: 700 },
  cissp:        { code: "CISSP CAT", questions: 150, minutes: 180, scaleMin: 0, scaleMax: 1000, passMark: 700 },
  oscp:         { code: "OSCP written sim", questions: 80, minutes: 240, scaleMin: 0, scaleMax: 100, passMark: 70 },
  fortinet:     { code: "FCP_FGT_AD-7.4", questions: 60, minutes: 105, scaleMin: 0, scaleMax: 100, passMark: 70 },
  vmware:       { code: "2V0-21.23", questions: 70, minutes: 135, scaleMin: 100, scaleMax: 500, passMark: 300 },
};

export const EXAM_BATCH_SIZE = 25;

export interface ExamQuestion {
  id: number;
  domain: string;
  question: string;
  choices: string[];
  answerIndex: number;
  explanation: string;
}

export interface Exam {
  track: TrackId;
  code: string;
  questions: ExamQuestion[];
}

export interface ExamAttempt {
  date: string;
  scaled: number;
  percent: number;
  passed: boolean;
}

/** What the exams table row stores: the exam plus every graded attempt. */
export interface ExamRecord {
  exam: Exam;
  attempts: ExamAttempt[];
}

export function buildExamBatchMessages(track: TrackId, batchIndex: number, count: number): ChatMessage[] {
  const meta = getTrack(track);
  const spec = EXAM_SPECS[track];
  const system = `You are a certification exam item writer producing practice questions for the real ${meta.title} exam (${spec.code}).
Write ${count} exam-quality multiple-choice questions modeled on the current official ${spec.code} objectives (this is batch ${batchIndex + 1}, so cover different objectives than earlier batches and avoid repeating stems).
Requirements:
- Real-world, scenario-based stems where the objective allows ("A technician...", "An administrator notices...").
- Exactly 4 choices, one correct; distractors must be plausible mistakes a real candidate makes.
- Tag each question with its official exam domain name.
- One-sentence explanation of why the correct answer is right.
Respond with ONLY a JSON array of exactly ${count} objects, no prose, no markdown fences:
[
  { "domain": "string", "question": "string", "choices": ["string","string","string","string"], "answerIndex": 0, "explanation": "string" }
]`;
  return [
    { role: "system", content: system },
    { role: "user", content: `Write batch ${batchIndex + 1} (${count} questions) now.` },
  ];
}

function requireStr(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new ParseError(`Expected non-empty string for "${field}"`);
  }
  return value;
}

/** Parses one generated batch; ids are assigned by the caller when batches are combined. */
export function parseExamBatch(text: string): Omit<ExamQuestion, "id">[] {
  let raw: unknown;
  try {
    raw = JSON.parse(extractJsonArrayFromText(text));
  } catch (err) {
    if (err instanceof ParseError) throw err;
    throw new ParseError(`Failed to JSON.parse exam batch: ${(err as Error).message}`);
  }
  if (!Array.isArray(raw) || raw.length === 0) throw new ParseError("Exam batch was not a non-empty JSON array");

  return raw.map((q, qi) => {
    const obj = q as Record<string, unknown>;
    if (!Array.isArray(obj.choices) || obj.choices.length !== 4 || !obj.choices.every((c) => typeof c === "string" && c.trim() !== "")) {
      throw new ParseError(`batch[${qi}].choices must be exactly 4 non-empty strings`);
    }
    const answerIndex = obj.answerIndex;
    if (typeof answerIndex !== "number" || !Number.isInteger(answerIndex) || answerIndex < 0 || answerIndex > 3) {
      throw new ParseError(`batch[${qi}].answerIndex out of range`);
    }
    return {
      domain: requireStr(obj.domain, `batch[${qi}].domain`),
      question: requireStr(obj.question, `batch[${qi}].question`),
      choices: obj.choices as string[],
      answerIndex,
      explanation: requireStr(obj.explanation, `batch[${qi}].explanation`),
    };
  });
}

export type ClientExamQuestion = Omit<ExamQuestion, "answerIndex" | "explanation">;

/** Answer keys never leave the server before grading. */
export function stripExamAnswers(exam: Exam): { track: TrackId; code: string; questions: ClientExamQuestion[] } {
  return {
    track: exam.track,
    code: exam.code,
    questions: exam.questions.map(({ id, domain, question, choices }) => ({ id, domain, question, choices })),
  };
}

export interface ExamResult {
  correct: number;
  total: number;
  percent: number;
  scaled: number;
  passMark: number;
  passed: boolean;
  domains: { domain: string; correct: number; total: number }[];
  review: { id: number; correctIndex: number; yourIndex: number; explanation: string }[];
}

/** Grades like the real exam: raw % projected onto the vendor's score scale. */
export function gradeExam(track: TrackId, exam: Exam, answers: number[]): ExamResult {
  const spec = EXAM_SPECS[track];
  const total = exam.questions.length;
  let correct = 0;
  const domainMap = new Map<string, { correct: number; total: number }>();
  const review: ExamResult["review"] = [];

  exam.questions.forEach((q, i) => {
    const got = answers[i];
    const isRight = got === q.answerIndex;
    if (isRight) correct++;
    const d = domainMap.get(q.domain) ?? { correct: 0, total: 0 };
    d.total++;
    if (isRight) d.correct++;
    domainMap.set(q.domain, d);
    if (!isRight) {
      review.push({ id: q.id, correctIndex: q.answerIndex, yourIndex: typeof got === "number" ? got : -1, explanation: q.explanation });
    }
  });

  const percent = total === 0 ? 0 : Math.round((correct / total) * 100);
  const scaled = Math.round(spec.scaleMin + (correct / Math.max(1, total)) * (spec.scaleMax - spec.scaleMin));
  return {
    correct,
    total,
    percent,
    scaled,
    passMark: spec.passMark,
    passed: scaled >= spec.passMark,
    domains: [...domainMap.entries()].map(([domain, v]) => ({ domain, ...v })),
    review,
  };
}
