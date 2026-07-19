import {
  BOOTCAMP_SKILLS,
  ALL_BOOTCAMP_SKILLS,
  BOOTCAMPS,
  skillsForBootcamp,
  getBootcamp,
  isBootcampId,
  getBootcampSkill,
  isBootcampSkillId,
  buildBootcampChapterMessages,
  parseBootcampChapter,
  stripBootcampAnswers,
  chapterLabSeed,
} from "./bootcamp";
import { isScenarioCategory } from "./scenarios";

describe("BOOTCAMPS", () => {
  it("offers CCNA, CCNP, Security+, Network+ and A+ camps", () => {
    expect(BOOTCAMPS.map((b) => b.id)).toEqual(["ccna", "ccnp", "secplus", "netplus", "aplus"]);
    expect(getBootcamp("secplus")?.certName).toBe("CompTIA Security+");
    expect(isBootcampId("ccnp")).toBe(true);
    expect(isBootcampId("mcse")).toBe(false);
  });

  it("every camp has skills and every skill belongs to a real camp", () => {
    for (const b of BOOTCAMPS) {
      expect(skillsForBootcamp(b.id).length).toBeGreaterThanOrEqual(10);
    }
    for (const s of ALL_BOOTCAMP_SKILLS) {
      expect(isBootcampId(s.camp)).toBe(true);
    }
  });
});

describe("BOOTCAMP_SKILLS", () => {
  it("covers all 27 CCNA skills of the study plan with globally unique ids", () => {
    expect(BOOTCAMP_SKILLS).toHaveLength(27);
    expect(new Set(ALL_BOOTCAMP_SKILLS.map((s) => s.id)).size).toBe(ALL_BOOTCAMP_SKILLS.length);
    expect(BOOTCAMP_SKILLS.map((s) => s.num)).toEqual(Array.from({ length: 27 }, (_, i) => i));
  });

  it("every skill has lessons and a valid VM lab seed", () => {
    for (const s of ALL_BOOTCAMP_SKILLS) {
      expect(s.lessons.length).toBeGreaterThan(0);
      expect(isScenarioCategory(s.labSeed.category)).toBe(true);
      expect(s.labSeed.rootCause.length).toBeGreaterThan(20);
      expect(s.labSeed.openingMessage.length).toBeGreaterThan(20);
      expect(s.labSeed.environment.os).toBeTruthy();
    }
  });

  it("looks up skills by id across camps", () => {
    expect(getBootcampSkill("s12")?.title).toContain("VLAN");
    expect(getBootcampSkill("ccnp-04")?.title).toContain("BGP");
    expect(getBootcampSkill("sec-03")?.title).toContain("Cryptography");
    expect(isBootcampSkillId("s00")).toBe(true);
    expect(isBootcampSkillId("s99")).toBe(false);
  });

  it("hands-on chapters use the matching 3D lab engine", () => {
    expect(getBootcampSkill("ap-00")?.labKind).toBe("hardware");
    expect(getBootcampSkill("ap-01")?.labKind).toBe("hardware");
    expect(getBootcampSkill("net-01")?.labKind).toBe("wiring");
    expect(getBootcampSkill("s03")?.labKind).toBe("wiring");
    expect(getBootcampSkill("s10")?.labKind).toBeUndefined();
  });
});

describe("chapter generation plumbing", () => {
  const valid = {
    lesson: "L".repeat(150),
    quiz: [
      { question: "Which layer is IP?", choices: ["1", "2", "3", "4"], answerIndex: 2 },
      { question: "Which device floods unknown unicast?", choices: ["Router", "Switch", "Hub", "Firewall"], answerIndex: 1 },
      { question: "What does SVI stand for?", choices: ["a", "b", "c", "d"], answerIndex: 0 },
    ],
  };

  it("prompt names the skill, demands JSON, and varies per call", () => {
    const msgs = buildBootcampChapterMessages(BOOTCAMP_SKILLS[12]);
    expect(msgs[0].content).toContain("VLANs & Trunking");
    expect(msgs[0].content).toContain('"quiz"');
    expect(msgs[0].content).toContain('"lab"');
    // The variation seed makes every generation request unique.
    const again = buildBootcampChapterMessages(BOOTCAMP_SKILLS[12]);
    expect(again[0].content).not.toBe(msgs[0].content);
  });

  it("parses a valid chapter and strips answers for the client", () => {
    const chapter = parseBootcampChapter(JSON.stringify(valid));
    expect(chapter.quiz).toHaveLength(3);
    const client = stripBootcampAnswers(chapter);
    expect((client.quiz[0] as unknown as Record<string, unknown>).answerIndex).toBeUndefined();
  });

  it("parses the chapter lab when present and builds a lesson-matched seed", () => {
    const lab = {
      os: "Windows 11",
      device: "Front-desk PC",
      detail: "New build on the bench",
      rootCause: "One DDR4 stick is seated in the wrong channel, so the board falls back to single channel",
      openingMessage: "The new PC feels way slower than the identical one next to it. Same parts, same everything.",
    };
    const chapter = parseBootcampChapter(JSON.stringify({ ...valid, lab }));
    expect(chapter.lab?.rootCause).toContain("single channel");

    const skill = getBootcampSkill("ap-00")!;
    const seed = chapterLabSeed(skill, chapter);
    expect(seed.rootCause).toBe(lab.rootCause);
    expect(seed.environment.os).toBe("Windows 11");
    expect(seed.persona).toEqual(skill.labSeed.persona);
    // Without a generated lab we fall back to the hand-written seed.
    expect(chapterLabSeed(skill, parseBootcampChapter(JSON.stringify(valid)))).toEqual(skill.labSeed);
  });

  it("repairs raw newlines inside JSON string literals", () => {
    const withRawNewlines = JSON.stringify(valid).replace('"L', '"First line.\nSecond line. L');
    expect(() => JSON.parse(withRawNewlines)).toThrow();
    const chapter = parseBootcampChapter(withRawNewlines);
    expect(chapter.lesson).toContain("First line.\nSecond line.");
  });

  it("repairs invalid Windows-path escapes in model JSON", () => {
    const withBadEscapes = JSON.stringify(valid).replace('"L', '"Check C:\\\\Windows\\\\System32 first. L').replace(/\\\\/g, "\\");
    // Sanity: the raw string is now invalid JSON.
    expect(() => JSON.parse(withBadEscapes)).toThrow();
    const chapter = parseBootcampChapter(withBadEscapes);
    expect(chapter.lesson).toContain("C:\\Windows\\System32");
  });

  it("rejects a too-short lesson and salvages what it can from a drifting quiz", () => {
    expect(() => parseBootcampChapter(JSON.stringify({ ...valid, lesson: "short" }))).toThrow(/lesson/);
    // Malformed questions are skipped; the chapter fails only below 3 usable ones.
    const badQuiz = { ...valid, quiz: [{ ...valid.quiz[0], choices: ["only-one"] }, valid.quiz[1], valid.quiz[2]] };
    expect(() => parseBootcampChapter(JSON.stringify(badQuiz))).toThrow(/usable questions/);
    const oneBad = { ...valid, quiz: [...valid.quiz, { ...valid.quiz[0], answerIndex: 7 }] };
    expect(parseBootcampChapter(JSON.stringify(oneBad)).quiz).toHaveLength(3);
    // Weak free models sometimes emit 3 choices — that's still a usable question.
    const threeChoices = { ...valid, quiz: [{ ...valid.quiz[0], choices: ["a", "b", "c"], answerIndex: 2 }, valid.quiz[1], valid.quiz[2]] };
    expect(parseBootcampChapter(JSON.stringify(threeChoices)).quiz[0].choices).toHaveLength(3);
  });
});
