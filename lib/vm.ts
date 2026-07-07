import type { ScenarioSeed } from "./types";
import type { ChatMessage } from "./openrouter";
import { extractJsonFromText, ParseError } from "./parsing";

export interface VmSpec {
  os: string;
  hostname: string;
  username: string;
  password: string;
  settingsPanels: { title: string; entries: { label: string; value: string }[] }[];
  files: { path: string; description: string }[];
  faultSummary: string;
}

export interface VmExchange {
  command: string;
  output: string;
}

export const VM_RESOLVED_MARKER = "[FAULT_RESOLVED]";

export function buildVmInitMessages(seed: ScenarioSeed): ChatMessage[] {
  const system = `You are provisioning a simulated machine for an IT training lab. The trainee will remotely log in and troubleshoot it.
The machine belongs to ${seed.persona.name} (${seed.persona.department}): OS ${seed.environment.os}, device ${seed.environment.device}, detail: ${seed.environment.detail}.
The hidden fault on this machine is: ${seed.rootCause}.
Design a realistic machine state where that fault would plausibly exist. The settings panels and files should contain mostly-normal values with subtle clues consistent with the fault — never name the fault outright.
Respond with ONLY a JSON object, no prose, no markdown fences, matching exactly this shape:
{
  "os": "string",
  "hostname": "string, realistic corporate hostname",
  "username": "support-admin",
  "password": "string, a simple demo password like Passw0rd!",
  "settingsPanels": [ { "title": "string, e.g. Network / System / Services", "entries": [ { "label": "string", "value": "string" } ] } ],
  "files": [ { "path": "string, OS-appropriate absolute path", "description": "string, 1 sentence" } ],
  "faultSummary": "string, 1 sentence internal note about the fault (never shown to the trainee)"
}
Include 2-4 settingsPanels with 3-6 entries each and 3-6 files.`;
  return [
    { role: "system", content: system },
    { role: "user", content: "Provision the machine now." },
  ];
}

function requireStr(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new ParseError(`Expected non-empty string for "${field}"`);
  }
  return value;
}

// Models frequently emit Windows paths with single backslashes ("C:\Windows"),
// which are invalid JSON escapes; double any backslash not starting a valid one.
function repairInvalidEscapes(json: string): string {
  return json.replace(/\\(?!["\\/bfnrtu])/g, "\\\\");
}

export function parseVmSpec(text: string): VmSpec {
  const json = extractJsonFromText(text);
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    try {
      raw = JSON.parse(repairInvalidEscapes(json));
    } catch (err) {
      throw new ParseError(`Failed to JSON.parse VM spec: ${(err as Error).message}`);
    }
  }
  if (typeof raw !== "object" || raw === null) throw new ParseError("VM spec payload was not a JSON object");
  const obj = raw as Record<string, unknown>;

  const settingsPanels = Array.isArray(obj.settingsPanels)
    ? obj.settingsPanels.map((p, pi) => {
        const panel = p as Record<string, unknown>;
        const entries = Array.isArray(panel.entries)
          ? panel.entries.map((e, ei) => {
              const entry = e as Record<string, unknown>;
              return {
                label: requireStr(entry.label, `settingsPanels[${pi}].entries[${ei}].label`),
                value: requireStr(entry.value, `settingsPanels[${pi}].entries[${ei}].value`),
              };
            })
          : [];
        return { title: requireStr(panel.title, `settingsPanels[${pi}].title`), entries };
      })
    : [];

  const files = Array.isArray(obj.files)
    ? obj.files.map((f, fi) => {
        const file = f as Record<string, unknown>;
        return {
          path: requireStr(file.path, `files[${fi}].path`),
          description: requireStr(file.description, `files[${fi}].description`),
        };
      })
    : [];

  return {
    os: requireStr(obj.os, "os"),
    hostname: requireStr(obj.hostname, "hostname"),
    username: requireStr(obj.username, "username"),
    password: requireStr(obj.password, "password"),
    settingsPanels,
    files,
    faultSummary: requireStr(obj.faultSummary, "faultSummary"),
  };
}

export function buildVmExecMessages(
  seed: ScenarioSeed,
  spec: VmSpec,
  history: VmExchange[],
  command: string
): ChatMessage[] {
  const system = `You are simulating the command shell of a machine in an IT training lab.
Machine: hostname ${spec.hostname}, OS ${spec.os}, logged in as ${spec.username} with admin rights.
Machine state summary: ${JSON.stringify({ settingsPanels: spec.settingsPanels, files: spec.files })}
The hidden fault (never name it outright): ${seed.rootCause}
Rules:
- Each user message is a command typed into the shell. Respond with ONLY the raw terminal output for that command on this machine (${spec.os}-style syntax and tone). No prose, no roleplay, no markdown fences, max ~20 lines.
- Unknown or mistyped commands produce the OS's real error message.
- Stay strictly consistent with all previous outputs and with any state changes the trainee's commands made (services started, configs edited, caches flushed...).
- Symptoms and clues must remain consistent with the hidden fault until the trainee's commands have genuinely fixed it.
- When — and only when — the fault has genuinely been fixed by the trainee's commands, append this exact marker on its own final line after the command output: ${VM_RESOLVED_MARKER}`;
  const turns: ChatMessage[] = history.flatMap((h) => [
    { role: "user" as const, content: h.command },
    { role: "assistant" as const, content: h.output },
  ]);
  return [{ role: "system", content: system }, ...turns, { role: "user", content: command }];
}
