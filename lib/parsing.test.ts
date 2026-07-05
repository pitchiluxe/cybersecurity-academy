import { extractJsonFromText, parseScenarioSeed, parseScenarioQueue, parseGradeResult, ParseError } from "./parsing";

describe("extractJsonFromText", () => {
  it("returns the text unchanged when it is already bare JSON", () => {
    const input = '{"a":1}';
    expect(extractJsonFromText(input)).toBe('{"a":1}');
  });

  it("strips a markdown fenced json block", () => {
    const input = 'Sure, here you go:\n```json\n{"a":1}\n```\nHope that helps!';
    expect(extractJsonFromText(input)).toBe('{"a":1}');
  });

  it("extracts the outermost braces when there is surrounding prose with no fence", () => {
    const input = 'Here is the object: {"a":1} — let me know if you need more.';
    expect(extractJsonFromText(input)).toBe('{"a":1}');
  });

  it("throws ParseError when no JSON object is present", () => {
    expect(() => extractJsonFromText("no json here")).toThrow(ParseError);
  });
});

describe("parseScenarioSeed", () => {
  const validPayload = JSON.stringify({
    persona: { name: "Maria Chen", department: "Marketing" },
    environment: { os: "Windows 11", device: "Latitude 5540", detail: "GlobalProtect 6.2.1" },
    rootCause: "TAP adapter driver corrupted by cumulative update",
    openingMessage: "My VPN won't connect this morning.",
  });

  it("parses a valid payload into a ScenarioSeed with the given category", () => {
    const seed = parseScenarioSeed(validPayload, "network");
    expect(seed).toEqual({
      category: "network",
      persona: { name: "Maria Chen", department: "Marketing" },
      environment: { os: "Windows 11", device: "Latitude 5540", detail: "GlobalProtect 6.2.1" },
      rootCause: "TAP adapter driver corrupted by cumulative update",
      openingMessage: "My VPN won't connect this morning.",
    });
  });

  it("throws ParseError when a required field is missing", () => {
    const missingField = JSON.stringify({
      persona: { name: "Maria Chen", department: "Marketing" },
      environment: { os: "Windows 11", device: "Latitude 5540", detail: "x" },
      openingMessage: "My VPN won't connect.",
      // rootCause missing
    });
    expect(() => parseScenarioSeed(missingField, "network")).toThrow(ParseError);
  });
});

describe("parseScenarioQueue", () => {
  const isValidCategory = (v: string) => ["network", "printer"].includes(v);

  const validPayload = JSON.stringify([
    {
      category: "network",
      persona: { name: "Maria Chen", department: "Marketing" },
      environment: { os: "Windows 11", device: "Latitude 5540", detail: "GlobalProtect 6.2.1" },
      rootCause: "TAP adapter driver corrupted by cumulative update",
      openingMessage: "My VPN won't connect this morning.",
    },
    {
      category: "printer",
      persona: { name: "Alex Kim", department: "Finance" },
      environment: { os: "macOS 14", device: "MacBook Pro", detail: "n/a" },
      rootCause: "Print spooler service crashed",
      openingMessage: "Nothing prints, the queue just sits there.",
    },
  ]);

  it("parses a valid array into ScenarioSeed entries using each item's own category", () => {
    const seeds = parseScenarioQueue(validPayload, isValidCategory);
    expect(seeds).toHaveLength(2);
    expect(seeds[0].category).toBe("network");
    expect(seeds[1].category).toBe("printer");
    expect(seeds[1].persona.name).toBe("Alex Kim");
  });

  it("throws ParseError when the payload is not an array", () => {
    expect(() => parseScenarioQueue(JSON.stringify({ a: 1 }), isValidCategory)).toThrow(ParseError);
  });

  it("throws ParseError when an entry has an invalid category", () => {
    const bad = JSON.stringify([
      {
        category: "spaceship",
        persona: { name: "Maria Chen", department: "Marketing" },
        environment: { os: "Windows 11", device: "Latitude 5540", detail: "x" },
        rootCause: "x",
        openingMessage: "x",
      },
    ]);
    expect(() => parseScenarioQueue(bad, isValidCategory)).toThrow(ParseError);
  });
});

describe("parseGradeResult", () => {
  const validPayload = JSON.stringify({
    score: 82,
    resolved: true,
    rubric: [{ item: "Asked clarifying questions", met: true, note: "Asked about OS and error text." }],
    feedback: "Solid diagnostic path, verified the fix before closing.",
  });

  it("parses a valid payload into a GradeResult", () => {
    const result = parseGradeResult(validPayload);
    expect(result.score).toBe(82);
    expect(result.resolved).toBe(true);
    expect(result.rubric).toHaveLength(1);
    expect(result.feedback).toContain("Solid diagnostic path");
  });

  it("throws ParseError when score is out of range", () => {
    const badScore = JSON.stringify({ score: 150, resolved: true, rubric: [], feedback: "x" });
    expect(() => parseGradeResult(badScore)).toThrow(ParseError);
  });

  it("throws ParseError when rubric is not an array", () => {
    const badRubric = JSON.stringify({ score: 50, resolved: false, rubric: "none", feedback: "x" });
    expect(() => parseGradeResult(badRubric)).toThrow(ParseError);
  });
});
