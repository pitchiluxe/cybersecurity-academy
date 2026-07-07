import {
  TRACKS,
  isTrackId,
  getTrack,
  tracksForCategory,
  gradeQuiz,
  certEligible,
  makeCertCode,
  QUIZ_PASS_PERCENT,
  type CourseModule,
} from "./courses";

describe("track catalog", () => {
  it("has the four expected tracks", () => {
    expect(TRACKS.map((t) => t.id)).toEqual(["aplus", "networkplus", "securityplus", "ccna"]);
  });

  it("isTrackId accepts known ids and rejects junk", () => {
    expect(isTrackId("securityplus")).toBe(true);
    expect(isTrackId("mcse")).toBe(false);
  });

  it("every track maps to at least one scenario category", () => {
    for (const t of TRACKS) expect(t.categories.length).toBeGreaterThan(0);
  });

  it("tracksForCategory finds tracks by category", () => {
    expect(tracksForCategory("network")).toEqual(expect.arrayContaining(["networkplus", "ccna"]));
    expect(tracksForCategory("hardware")).toEqual(["aplus"]);
  });

  it("getTrack returns the metadata", () => {
    expect(getTrack("ccna").title).toMatch(/CCNA/);
  });
});

describe("gradeQuiz", () => {
  const module: CourseModule = {
    title: "M",
    lesson: "L",
    quiz: [
      { question: "q1", choices: ["a", "b", "c", "d"], answerIndex: 0 },
      { question: "q2", choices: ["a", "b", "c", "d"], answerIndex: 1 },
      { question: "q3", choices: ["a", "b", "c", "d"], answerIndex: 2 },
      { question: "q4", choices: ["a", "b", "c", "d"], answerIndex: 3 },
      { question: "q5", choices: ["a", "b", "c", "d"], answerIndex: 0 },
    ],
  };

  it("passes at 80%+", () => {
    const r = gradeQuiz(module, [0, 1, 2, 3, 1]);
    expect(r.score).toBe(80);
    expect(r.passed).toBe(true);
    expect(r.correct).toEqual([true, true, true, true, false]);
  });

  it("fails below the threshold", () => {
    const r = gradeQuiz(module, [1, 0, 2, 3, 1]);
    expect(r.score).toBe(40);
    expect(r.passed).toBe(false);
  });

  it("treats missing answers as wrong", () => {
    const r = gradeQuiz(module, [0]);
    expect(r.correct).toEqual([true, false, false, false, false]);
  });
});

describe("certEligible", () => {
  it("requires all modules and enough tickets", () => {
    expect(certEligible(5, 5, 3)).toBe(true);
    expect(certEligible(4, 5, 3)).toBe(false);
    expect(certEligible(5, 5, 2)).toBe(false);
    expect(certEligible(0, 0, 3)).toBe(false);
  });
});

describe("makeCertCode", () => {
  it("embeds the track short code and is unique-ish", () => {
    const a = makeCertCode("securityplus");
    expect(a).toMatch(/^HDC-SEC-[0-9A-F]{6}$/);
    expect(makeCertCode("securityplus")).not.toBe(a);
  });
});

describe("constants", () => {
  it("pass threshold is 80", () => expect(QUIZ_PASS_PERCENT).toBe(80));
});
