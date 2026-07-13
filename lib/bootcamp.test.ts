import {
  BOOTCAMP_SKILLS,
  getBootcampSkill,
  isBootcampSkillId,
  buildBootcampChapterMessages,
  parseBootcampChapter,
  stripBootcampAnswers,
} from "./bootcamp";
import { isScenarioCategory } from "./scenarios";

describe("BOOTCAMP_SKILLS", () => {
  it("covers all 27 skills of the study plan with unique ids", () => {
    expect(BOOTCAMP_SKILLS).toHaveLength(27);
    expect(new Set(BOOTCAMP_SKILLS.map((s) => s.id)).size).toBe(27);
    expect(BOOTCAMP_SKILLS.map((s) => s.num)).toEqual(Array.from({ length: 27 }, (_, i) => i));
  });

  it("every skill has lessons and a valid VM lab seed", () => {
    for (const s of BOOTCAMP_SKILLS) {
      expect(s.lessons.length).toBeGreaterThan(0);
      expect(isScenarioCategory(s.labSeed.category)).toBe(true);
      expect(s.labSeed.rootCause.length).toBeGreaterThan(20);
      expect(s.labSeed.openingMessage.length).toBeGreaterThan(20);
      expect(s.labSeed.environment.os).toBeTruthy();
    }
  });

  it("looks up skills by id", () => {
    expect(getBootcampSkill("s12")?.title).toContain("VLAN");
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
