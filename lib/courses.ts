import { randomBytes } from "crypto";
import type { ScenarioCategory } from "./types";

export type TrackId = "aplus" | "networkplus" | "securityplus" | "ccna";

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
  categories: ScenarioCategory[];
}

export const TRACKS: TrackMeta[] = [
  {
    id: "aplus",
    title: "CompTIA A+",
    short: "APL",
    description: "PC hardware, operating systems, peripherals, and day-one desktop support skills.",
    categories: ["hardware", "printer", "app-crash"],
  },
  {
    id: "networkplus",
    title: "CompTIA Network+",
    short: "NET",
    description: "Networking fundamentals: TCP/IP, DNS, DHCP, Wi-Fi, VPNs, and troubleshooting methodology.",
    categories: ["network"],
  },
  {
    id: "securityplus",
    title: "CompTIA Security+",
    short: "SEC",
    description: "Threats, malware response, identity and access management, and security operations.",
    categories: ["malware", "password"],
  },
  {
    id: "ccna",
    title: "Cisco CCNA",
    short: "CCN",
    description: "Routing and switching, IP services, network access, and virtualization fundamentals.",
    categories: ["network", "vm"],
  },
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
