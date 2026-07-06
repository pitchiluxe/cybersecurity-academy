export type ScenarioCategory =
  | "network"
  | "printer"
  | "password"
  | "app-crash"
  | "malware"
  | "hardware"
  | "vm";

export interface ScenarioSeed {
  category: ScenarioCategory;
  persona: { name: string; department: string };
  environment: { os: string; device: string; detail: string };
  rootCause: string;
  openingMessage: string;
}

export interface TicketPreview extends ScenarioSeed {
  ticketId: string;
  priority: "P1" | "P2" | "P3";
}

export interface TranscriptMessage {
  role: "tech" | "enduser";
  content: string;
}

export interface RubricItem {
  item: string;
  met: boolean;
  note: string;
}

export interface GradeResult {
  score: number;
  resolved: boolean;
  rubric: RubricItem[];
  feedback: string;
}
