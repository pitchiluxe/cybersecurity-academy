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

  it("prompt names the skill and demands JSON", () => {
    const msgs = buildBootcampChapterMessages(BOOTCAMP_SKILLS[12]);
    expect(msgs[0].content).toContain("VLANs & Trunking");
    expect(msgs[0].content).toContain('"quiz"');
  });

  it("parses a valid chapter and strips answers for the client", () => {
    const chapter = parseBootcampChapter(JSON.stringify(valid));
    expect(chapter.quiz).toHaveLength(3);
    const client = stripBootcampAnswers(chapter);
    expect((client.quiz[0] as unknown as Record<string, unknown>).answerIndex).toBeUndefined();
  });

  it("rejects a too-short lesson and bad quiz shapes", () => {
    expect(() => parseBootcampChapter(JSON.stringify({ ...valid, lesson: "short" }))).toThrow(/lesson/);
    const badQuiz = { ...valid, quiz: [{ ...valid.quiz[0], choices: ["only", "two"] }, valid.quiz[1], valid.quiz[2]] };
    expect(() => parseBootcampChapter(JSON.stringify(badQuiz))).toThrow(/choices/);
    const badIdx = { ...valid, quiz: [{ ...valid.quiz[0], answerIndex: 7 }, valid.quiz[1], valid.quiz[2]] };
    expect(() => parseBootcampChapter(JSON.stringify(badIdx))).toThrow(/answerIndex/);
  });
});
