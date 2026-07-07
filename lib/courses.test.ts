import {
  TRACKS,
  isTrackId,
  getTrack,
  tracksForCategory,
  gradeQuiz,
  certEligible,
  makeCertCode,
  QUIZ_PASS_PERCENT,
  buildCourseMessages,
  buildTutorMessages,
  buildPracticeTicketMessages,
  parseCourse,
  stripAnswers,
  type Course,
  type CourseModule,
} from "./courses";
import { isScenarioCategory } from "./scenarios";

describe("track catalog", () => {
  it("has the 16-cert cybersecurity path in order", () => {
    expect(TRACKS.map((t) => t.id)).toEqual([
      "aplus", "networkplus", "linuxplus", "cloudplus",
      "securityplus", "cysa", "pentestplus", "securityx",
      "ccna", "ccnpsec", "ceh", "sscp", "cissp", "oscp",
      "fortinet", "vmware",
    ]);
  });

  it("has unique short codes and a tier on every track", () => {
    expect(new Set(TRACKS.map((t) => t.short)).size).toBe(16);
    for (const t of TRACKS) expect(["foundation", "security", "vendor"]).toContain(t.tier);
  });

  it("maps every track category to a real scenario category", () => {
    for (const t of TRACKS) {
      for (const c of t.categories) expect(isScenarioCategory(c)).toBe(true);
    }
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

describe("buildCourseMessages", () => {
  it("is a system+user pair mentioning the track and JSON shape", () => {
    const msgs = buildCourseMessages("networkplus");
    expect(msgs).toHaveLength(2);
    expect(msgs[0].role).toBe("system");
    expect(msgs[0].content).toContain("CompTIA Network+");
    expect(msgs[0].content).toContain("answerIndex");
  });
});

describe("parseCourse", () => {
  const good = JSON.stringify({
    title: "Network+ Crash Course",
    modules: [
      {
        title: "OSI Model",
        lesson: "Layers explained...",
        quiz: [
          { question: "Layer 3?", choices: ["Network", "Data link", "Session", "Physical"], answerIndex: 0 },
          { question: "q", choices: ["a", "b", "c", "d"], answerIndex: 1 },
          { question: "q", choices: ["a", "b", "c", "d"], answerIndex: 2 },
        ],
      },
      {
        title: "Subnetting",
        lesson: "CIDR...",
        quiz: [
          { question: "q", choices: ["a", "b", "c", "d"], answerIndex: 3 },
          { question: "q", choices: ["a", "b", "c", "d"], answerIndex: 0 },
          { question: "q", choices: ["a", "b", "c", "d"], answerIndex: 1 },
        ],
      },
      {
        title: "DNS",
        lesson: "Resolution...",
        quiz: [
          { question: "q", choices: ["a", "b", "c", "d"], answerIndex: 2 },
          { question: "q", choices: ["a", "b", "c", "d"], answerIndex: 3 },
          { question: "q", choices: ["a", "b", "c", "d"], answerIndex: 0 },
        ],
      },
    ],
  });

  it("parses a valid course", () => {
    const course = parseCourse(good, "networkplus");
    expect(course.track).toBe("networkplus");
    expect(course.modules).toHaveLength(3);
    expect(course.modules[0].quiz[0].answerIndex).toBe(0);
  });

  it("rejects a course with too few modules", () => {
    const bad = JSON.stringify({ title: "T", modules: [] });
    expect(() => parseCourse(bad, "aplus")).toThrow(/modules/);
  });

  it("rejects out-of-range answerIndex", () => {
    const bad = good.replace('"answerIndex":0', '"answerIndex":7');
    expect(() => parseCourse(bad, "networkplus")).toThrow(/answerIndex/);
  });
});

describe("buildTutorMessages", () => {
  it("embeds the lesson and maps chat turns", () => {
    const module: CourseModule = { title: "DNS", lesson: "DNS resolves names.", quiz: [] };
    const msgs = buildTutorMessages("networkplus", module, [
      { role: "user", content: "What is DNS?" },
      { role: "assistant", content: "It resolves names." },
      { role: "user", content: "Why does nslookup time out?" },
    ]);
    expect(msgs[0].role).toBe("system");
    expect(msgs[0].content).toContain("DNS resolves names.");
    expect(msgs[0].content).toContain("CompTIA Network+");
    expect(msgs).toHaveLength(4);
    expect(msgs[3]).toEqual({ role: "user", content: "Why does nslookup time out?" });
  });
});

describe("buildPracticeTicketMessages", () => {
  it("constrains categories to the track and cites module titles", () => {
    const track = getTrack("securityplus");
    const msgs = buildPracticeTicketMessages(track, ["Phishing Response", "Malware Triage"]);
    expect(msgs[0].role).toBe("system");
    expect(msgs[0].content).toContain("Phishing Response");
    for (const c of track.categories) expect(msgs[0].content).toContain(`"${c}"`);
    expect(msgs[0].content).not.toContain('"hardware"');
  });
});

describe("stripAnswers", () => {
  it("removes answerIndex from every question", () => {
    const course: Course = {
      track: "aplus",
      title: "T",
      modules: [
        {
          title: "M",
          lesson: "L",
          quiz: [{ question: "q", choices: ["a", "b"], answerIndex: 1 }],
        },
      ],
    };
    const stripped = stripAnswers(course);
    expect((stripped.modules[0].quiz[0] as Record<string, unknown>).answerIndex).toBeUndefined();
    expect(stripped.modules[0].quiz[0].choices).toEqual(["a", "b"]);
  });
});
