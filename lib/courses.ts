import { randomBytes } from "crypto";
import type { ScenarioCategory } from "./types";
import type { ChatMessage } from "./openrouter";
import { extractJsonFromText, ParseError } from "./parsing";

export type TrackId =
  | "aplus" | "networkplus" | "linuxplus" | "cloudplus"
  | "securityplus" | "cysa" | "pentestplus" | "securityx"
  | "ccna" | "ccnpsec" | "ceh" | "sscp" | "cissp" | "oscp"
  | "fortinet" | "vmware";

export interface QuizQuestion {
  question: string;
  choices: string[];
  answerIndex: number;
}

export interface CourseModule {
  title: string;
  lesson: string;
  quiz: QuizQuestion[];
}

export interface Course {
  track: TrackId;
  title: string;
  modules: CourseModule[];
}

export interface TrackMeta {
  id: TrackId;
  title: string;
  short: string;
  description: string;
  tier: "foundation" | "security" | "vendor";
  categories: ScenarioCategory[];
}

export const TRACKS: TrackMeta[] = [
  { id: "aplus", title: "CompTIA A+", short: "APL", tier: "foundation",
    description: "PC hardware, operating systems, peripherals, and day-one desktop support skills.",
    categories: ["hardware", "printer", "app-crash"] },
  { id: "networkplus", title: "CompTIA Network+", short: "NET", tier: "foundation",
    description: "Networking fundamentals: TCP/IP, DNS, DHCP, Wi-Fi, VPNs, and troubleshooting methodology.",
    categories: ["network"] },
  { id: "linuxplus", title: "CompTIA Linux+", short: "LNX", tier: "foundation",
    description: "Linux administration: services, permissions, storage, shell scripting, and hardening.",
    categories: ["linux"] },
  { id: "cloudplus", title: "CompTIA Cloud+", short: "CLD", tier: "foundation",
    description: "Cloud architecture, deployment, SaaS operations, and troubleshooting hybrid environments.",
    categories: ["cloud"] },
  { id: "securityplus", title: "CompTIA Security+", short: "SEC", tier: "security",
    description: "Threats, malware response, identity and access management, and security operations.",
    categories: ["malware", "password", "phishing"] },
  { id: "cysa", title: "CompTIA CySA+", short: "CSA", tier: "security",
    description: "Security analytics: SIEM triage, threat hunting, incident response, and detection tuning.",
    categories: ["siem", "malware"] },
  { id: "pentestplus", title: "CompTIA PenTest+", short: "PEN", tier: "security",
    description: "Penetration testing: scoping, scanning, exploitation, and reporting findings.",
    categories: ["pentest"] },
  { id: "securityx", title: "CompTIA SecurityX (CASP+)", short: "CSX", tier: "security",
    description: "Advanced security architecture and engineering across enterprise networks.",
    categories: ["firewall", "siem", "access"] },
  { id: "ccna", title: "Cisco CCNA", short: "CCN", tier: "vendor",
    description: "Routing and switching, IP services, network access, and virtualization fundamentals.",
    categories: ["network", "vm"] },
  { id: "ccnpsec", title: "Cisco CCNP Security", short: "CNS", tier: "vendor",
    description: "Enterprise network security: firewalls, VPNs, secure access, and visibility.",
    categories: ["firewall", "network"] },
  { id: "ceh", title: "EC-Council CEH", short: "CEH", tier: "vendor",
    description: "Ethical hacking: attack techniques, social engineering, and countermeasures.",
    categories: ["pentest", "phishing"] },
  { id: "sscp", title: "ISC2 SSCP", short: "SSC", tier: "vendor",
    description: "Security operations and administration: access controls, monitoring, and response.",
    categories: ["access", "password"] },
  { id: "cissp", title: "ISC2 CISSP", short: "CIS", tier: "vendor",
    description: "Security leadership across eight domains: architecture, IAM, operations, and risk.",
    categories: ["access", "siem", "cloud"] },
  { id: "oscp", title: "OffSec OSCP", short: "OSC", tier: "vendor",
    description: "Hands-on offensive security: enumeration, exploitation, and privilege escalation.",
    categories: ["pentest", "linux"] },
  { id: "fortinet", title: "Fortinet FCP (NSE 4)", short: "FTN", tier: "vendor",
    description: "FortiGate administration: interfaces, policies, NAT, VPNs, and security profiles.",
    categories: ["firewall"] },
  { id: "vmware", title: "VMware VCP-DCV", short: "VMW", tier: "vendor",
    description: "vSphere data center virtualization: ESXi, vCenter, storage, vMotion, and HA.",
    categories: ["vm"] },
];

export const QUIZ_PASS_PERCENT = 80;
export const CERT_MIN_TICKETS = 3;
export const CERT_MIN_GRADE = 70;

export function isTrackId(value: string): value is TrackId {
  return TRACKS.some((t) => t.id === value);
}

export function getTrack(id: TrackId): TrackMeta {
  return TRACKS.find((t) => t.id === id)!;
}

export function tracksForCategory(category: ScenarioCategory): TrackId[] {
  return TRACKS.filter((t) => t.categories.includes(category)).map((t) => t.id);
}

export function gradeQuiz(
  module: CourseModule,
  answers: number[]
): { score: number; correct: boolean[]; passed: boolean } {
  const correct = module.quiz.map((q, i) => answers[i] === q.answerIndex);
  const score = Math.round((correct.filter(Boolean).length / module.quiz.length) * 100);
  return { score, correct, passed: score >= QUIZ_PASS_PERCENT };
}

export function certEligible(modulesPassed: number, totalModules: number, qualifyingTickets: number): boolean {
  return totalModules > 0 && modulesPassed >= totalModules && qualifyingTickets >= CERT_MIN_TICKETS;
}

export function makeCertCode(track: TrackId): string {
  return `HDC-${getTrack(track).short}-${randomBytes(3).toString("hex").toUpperCase()}`;
}

export function buildCourseMessages(track: TrackId): ChatMessage[] {
  const meta = getTrack(track);
  const system = `You are an expert IT instructor writing a self-paced mini-course preparing a helpdesk trainee for the ${meta.title} certification.
Focus: ${meta.description}
Write 4 to 6 modules. Each module has a substantial lesson (400-700 words of plain text — paragraphs separated by blank lines, simple "- " bullet lists allowed, no markdown headings or code fences) grounded in real-world troubleshooting the trainee will face on the job, followed by a 5-question multiple-choice quiz.
Respond with ONLY a JSON object, no prose, no markdown fences, matching exactly this shape:
{
  "title": "string, course title",
  "modules": [
    {
      "title": "string",
      "lesson": "string, the full lesson text",
      "quiz": [
        { "question": "string", "choices": ["string", "string", "string", "string"], "answerIndex": 0-3 }
      ]
    }
  ]
}`;
  return [
    { role: "system", content: system },
    { role: "user", content: "Generate the course now." },
  ];
}

function requireStr(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new ParseError(`Expected non-empty string for "${field}"`);
  }
  return value;
}

export function parseCourse(text: string, track: TrackId): Course {
  let raw: unknown;
  try {
    raw = JSON.parse(extractJsonFromText(text));
  } catch (err) {
    if (err instanceof ParseError) throw err;
    throw new ParseError(`Failed to JSON.parse course: ${(err as Error).message}`);
  }
  if (typeof raw !== "object" || raw === null) throw new ParseError("Course payload was not a JSON object");
  const obj = raw as Record<string, unknown>;
  const title = requireStr(obj.title, "title");
  if (!Array.isArray(obj.modules) || obj.modules.length < 3 || obj.modules.length > 8) {
    throw new ParseError(
      `"modules" must be an array of 3-8 modules, got ${Array.isArray(obj.modules) ? obj.modules.length : typeof obj.modules}`
    );
  }

  const modules: CourseModule[] = obj.modules.map((entry, mi) => {
    if (typeof entry !== "object" || entry === null) throw new ParseError(`modules[${mi}] is not an object`);
    const m = entry as Record<string, unknown>;
    if (!Array.isArray(m.quiz) || m.quiz.length < 3) {
      throw new ParseError(`modules[${mi}].quiz must be an array of at least 3 questions`);
    }
    const quiz: QuizQuestion[] = m.quiz.map((q, qi) => {
      if (typeof q !== "object" || q === null) throw new ParseError(`modules[${mi}].quiz[${qi}] is not an object`);
      const question = q as Record<string, unknown>;
      const choices = question.choices;
      if (!Array.isArray(choices) || choices.length < 2 || !choices.every((c) => typeof c === "string")) {
        throw new ParseError(`modules[${mi}].quiz[${qi}].choices must be an array of strings`);
      }
      const answerIndex = question.answerIndex;
      if (
        typeof answerIndex !== "number" ||
        !Number.isInteger(answerIndex) ||
        answerIndex < 0 ||
        answerIndex >= choices.length
      ) {
        throw new ParseError(`modules[${mi}].quiz[${qi}].answerIndex out of range`);
      }
      return {
        question: requireStr(question.question, `modules[${mi}].quiz[${qi}].question`),
        choices: choices as string[],
        answerIndex,
      };
    });
    return {
      title: requireStr(m.title, `modules[${mi}].title`),
      lesson: requireStr(m.lesson, `modules[${mi}].lesson`),
      quiz,
    };
  });

  return { track, title, modules };
}

export interface TutorMessage {
  role: "user" | "assistant";
  content: string;
}

export function buildTutorMessages(track: TrackId, module: CourseModule, chat: TutorMessage[]): ChatMessage[] {
  const meta = getTrack(track);
  const system = `You are a patient, encouraging IT instructor tutoring a helpdesk trainee through a ${meta.title} course module titled "${module.title}".
The lesson text the trainee is currently reading:
---
${module.lesson}
---
Explain concepts clearly, answer questions about the material, and always connect ideas to real-world troubleshooting the trainee will do on the job (concrete commands, symptoms, and fixes) so they are ready for real tickets. If asked something outside the lesson, still help, but relate it back to ${meta.title} objectives. Keep replies under 200 words unless a step-by-step walkthrough is needed. Never reveal quiz answers.`;
  return [{ role: "system", content: system }, ...chat];
}

export type ClientCourse = {
  track: TrackId;
  title: string;
  modules: { title: string; lesson: string; quiz: { question: string; choices: string[] }[] }[];
};

export function stripAnswers(course: Course): ClientCourse {
  return {
    track: course.track,
    title: course.title,
    modules: course.modules.map((m) => ({
      title: m.title,
      lesson: m.lesson,
      quiz: m.quiz.map((q) => ({ question: q.question, choices: q.choices })),
    })),
  };
}
