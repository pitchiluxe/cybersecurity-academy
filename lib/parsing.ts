import type { ScenarioCategory, ScenarioSeed, GradeResult } from "./types";

export class ParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ParseError";
  }
}

export function extractJsonFromText(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const candidate = fenced ? fenced[1] : text;

  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) {
    throw new ParseError(`No JSON object found in text: ${text.slice(0, 200)}`);
  }
  return candidate.slice(start, end + 1);
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new ParseError(`Expected non-empty string for "${field}", got: ${JSON.stringify(value)}`);
  }
  return value;
}

export function parseScenarioSeed(text: string, category: ScenarioCategory): ScenarioSeed {
  let raw: unknown;
  try {
    raw = JSON.parse(extractJsonFromText(text));
  } catch (err) {
    if (err instanceof ParseError) throw err;
    throw new ParseError(`Failed to JSON.parse scenario seed: ${(err as Error).message}`);
  }

  if (typeof raw !== "object" || raw === null) {
    throw new ParseError("Scenario seed payload was not a JSON object");
  }
  const obj = raw as Record<string, unknown>;

  const persona = obj.persona as Record<string, unknown> | undefined;
  const environment = obj.environment as Record<string, unknown> | undefined;
  if (typeof persona !== "object" || persona === null) {
    throw new ParseError('Missing or invalid "persona" object');
  }
  if (typeof environment !== "object" || environment === null) {
    throw new ParseError('Missing or invalid "environment" object');
  }

  return {
    category,
    persona: {
      name: requireString(persona.name, "persona.name"),
      department: requireString(persona.department, "persona.department"),
    },
    environment: {
      os: requireString(environment.os, "environment.os"),
      device: requireString(environment.device, "environment.device"),
      detail: requireString(environment.detail, "environment.detail"),
    },
    rootCause: requireString(obj.rootCause, "rootCause"),
    openingMessage: requireString(obj.openingMessage, "openingMessage"),
  };
}

export function parseGradeResult(text: string): GradeResult {
  let raw: unknown;
  try {
    raw = JSON.parse(extractJsonFromText(text));
  } catch (err) {
    if (err instanceof ParseError) throw err;
    throw new ParseError(`Failed to JSON.parse grade result: ${(err as Error).message}`);
  }

  if (typeof raw !== "object" || raw === null) {
    throw new ParseError("Grade result payload was not a JSON object");
  }
  const obj = raw as Record<string, unknown>;

  if (typeof obj.score !== "number" || obj.score < 0 || obj.score > 100) {
    throw new ParseError(`"score" must be a number 0-100, got: ${JSON.stringify(obj.score)}`);
  }
  if (typeof obj.resolved !== "boolean") {
    throw new ParseError(`"resolved" must be a boolean, got: ${JSON.stringify(obj.resolved)}`);
  }
  if (!Array.isArray(obj.rubric)) {
    throw new ParseError(`"rubric" must be an array, got: ${JSON.stringify(obj.rubric)}`);
  }
  if (typeof obj.feedback !== "string" || obj.feedback.trim() === "") {
    throw new ParseError('"feedback" must be a non-empty string');
  }

  const rubric = obj.rubric.map((entry, i) => {
    if (typeof entry !== "object" || entry === null) {
      throw new ParseError(`rubric[${i}] is not an object`);
    }
    const e = entry as Record<string, unknown>;
    return {
      item: requireString(e.item, `rubric[${i}].item`),
      met: Boolean(e.met),
      note: requireString(e.note, `rubric[${i}].note`),
    };
  });

  return { score: obj.score, resolved: obj.resolved, rubric, feedback: obj.feedback };
}
