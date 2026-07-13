import {
  EXAM_SPECS,
  EXAM_BATCH_SIZE,
  buildExamBatchMessages,
  parseExamBatch,
  stripExamAnswers,
  gradeExam,
  type Exam,
  type ExamQuestion,
} from "./exam";
import { TRACKS } from "./courses";

function makeQuestion(id: number, over: Partial<ExamQuestion> = {}): ExamQuestion {
  return {
    id,
    domain: "Network Fundamentals",
    question: `Question ${id}?`,
    choices: ["A", "B", "C", "D"],
    answerIndex: 0,
    explanation: "A is right.",
    ...over,
  };
}

describe("EXAM_SPECS", () => {
  it("covers every course track", () => {
    for (const t of TRACKS) {
      expect(EXAM_SPECS[t.id]).toBeDefined();
    }
  });

  it("mirrors real-world question counts and pass marks", () => {
    expect(EXAM_SPECS.aplus).toMatchObject({ questions: 90, passMark: 675, scaleMax: 900 });
    expect(EXAM_SPECS.securityplus).toMatchObject({ questions: 90, passMark: 750 });
    expect(EXAM_SPECS.networkplus).toMatchObject({ questions: 90, passMark: 720 });
    expect(EXAM_SPECS.ccna).toMatchObject({ questions: 100, passMark: 825, scaleMax: 1000 });
    expect(EXAM_SPECS.ceh).toMatchObject({ questions: 125, passMark: 70 });
    expect(EXAM_SPECS.cissp).toMatchObject({ questions: 150, passMark: 700 });
  });
});

describe("buildExamBatchMessages", () => {
  it("asks for the batch size with the real exam code and JSON-only output", () => {
    const msgs = buildExamBatchMessages("securityplus", 1, EXAM_BATCH_SIZE);
    expect(msgs[0].role).toBe("system");
    expect(msgs[0].content).toContain("SY0-701");
    expect(msgs[0].content).toContain(`${EXAM_BATCH_SIZE}`);
    expect(msgs[0].content).toContain("batch 2");
  });
});

describe("parseExamBatch", () => {
  const valid = [
    { domain: "General Security Concepts", question: "Which control type is a fence?", choices: ["Physical", "Managerial", "Operational", "Technical"], answerIndex: 0, explanation: "Fences are physical controls." },
  ];

  it("parses a valid batch", () => {
    const qs = parseExamBatch(JSON.stringify(valid));
    expect(qs).toHaveLength(1);
    expect(qs[0].domain).toContain("Security");
  });

  it("rejects a question without exactly 4 choices", () => {
    const bad = [{ ...valid[0], choices: ["A", "B"] }];
    expect(() => parseExamBatch(JSON.stringify(bad))).toThrow(/choices/);
  });

  it("rejects an out-of-range answerIndex", () => {
    const bad = [{ ...valid[0], answerIndex: 4 }];
    expect(() => parseExamBatch(JSON.stringify(bad))).toThrow(/answerIndex/);
  });
});

describe("stripExamAnswers", () => {
  it("removes answer keys and explanations", () => {
    const exam: Exam = { track: "securityplus", code: "SY0-701", questions: [makeQuestion(1)] };
    const client = stripExamAnswers(exam);
    const q = client.questions[0] as unknown as Record<string, unknown>;
    expect(q.answerIndex).toBeUndefined();
    expect(q.explanation).toBeUndefined();
    expect(q.question).toBe("Question 1?");
  });
});

describe("gradeExam", () => {
  const questions = Array.from({ length: 10 }, (_, i) =>
    makeQuestion(i + 1, { domain: i < 5 ? "Domain One" : "Domain Two" })
  );
  const exam: Exam = { track: "securityplus", code: "SY0-701", questions };

  it("projects a perfect raw score to the top of the vendor scale", () => {
    const r = gradeExam("securityplus", exam, Array(10).fill(0));
    expect(r.correct).toBe(10);
    expect(r.scaled).toBe(900);
    expect(r.passed).toBe(true);
    expect(r.review).toHaveLength(0);
  });

  it("projects a zero raw score to the bottom of the scale and fails", () => {
    const r = gradeExam("securityplus", exam, Array(10).fill(3));
    expect(r.scaled).toBe(100);
    expect(r.passed).toBe(false);
    expect(r.review).toHaveLength(10);
  });

  it("uses the real pass mark as the boundary", () => {
    // securityplus: scaled = 100 + (correct/10) * 800; pass mark 750 → needs ≥ 8.125 correct.
    const eight = gradeExam("securityplus", exam, [...Array(8).fill(0), 3, 3]);
    expect(eight.scaled).toBe(740);
    expect(eight.passed).toBe(false);
    const nine = gradeExam("securityplus", exam, [...Array(9).fill(0), 3]);
    expect(nine.scaled).toBe(820);
    expect(nine.passed).toBe(true);
  });

  it("breaks results down by exam domain and treats missing answers as wrong", () => {
    const r = gradeExam("securityplus", exam, [0, 0, 0, 0, 0, -1, -1, -1, -1, -1]);
    expect(r.domains).toEqual(
      expect.arrayContaining([
        { domain: "Domain One", correct: 5, total: 5 },
        { domain: "Domain Two", correct: 0, total: 5 },
      ])
    );
    expect(r.review.every((v) => v.yourIndex === -1)).toBe(true);
  });
});
