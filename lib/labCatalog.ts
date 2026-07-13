import type { ChatMessage } from "./openrouter";
import { extractJsonArrayFromText, ParseError } from "./parsing";

export type LabEngine = "wiring" | "fortigate" | "router";

export interface LabBrief {
  id: string;
  engine: LabEngine;
  title: string;
  blurb: string;
  tags: string;
  /** One-sentence job seed handed to the engine so the generated scenario matches this card. */
  brief: string;
}

const LAB_ENGINES: LabEngine[] = ["wiring", "fortigate", "router"];
export const MIN_CATALOG_LABS = 8;
export const MAX_CATALOG_LABS = 14;

export function buildLabCatalogMessages(topic?: string): ChatMessage[] {
  const count = MIN_CATALOG_LABS + Math.floor(Math.random() * (MAX_CATALOG_LABS - MIN_CATALOG_LABS + 1));
  const topicLine = topic
    ? `\nThe trainee asked for jobs themed around: "${topic}". Bias industries, failure modes and briefs toward that theme.`
    : "";
  const system = `You are the lab dispatcher for an IT help-desk training platform. Invent ${count} distinct hands-on lab jobs a field technician could be sent on today.${topicLine}
Each lab uses one of three engines:
- "wiring": physical network cabling in 3D (modem, router, switch, patch panel, PC, AP, firewall). Jobs: buildouts, moves, outages, rollouts.
- "fortigate": rack + cable a FortiGate, then configure it in the FortiOS CLI. Jobs: deployments, policies, NAT, web filtering, VPN, port-forwards.
- "router": rack + cable a Cisco branch router, then configure it in the IOS CLI. Jobs: router turn-ups, replacements, DHCP/NAT rollouts, default-route repairs, inter-VLAN routing.
Mix all three engines. Vary industry (clinic, school, warehouse, hotel, retail, law firm...), scale, and failure mode so no two labs feel alike.
Respond with ONLY a JSON array, no prose, no markdown fences, of exactly ${count} objects:
[
  { "id": "kebab-case-unique-id", "engine": "wiring|fortigate|router", "title": "short punchy title", "blurb": "2 sentences selling the job to the trainee", "tags": "2-3 relevant certs, dot-separated (e.g. Network+ · CCNA)", "brief": "one sentence describing the exact job, used to generate the lab" }
]`;
  return [
    { role: "system", content: system },
    { role: "user", content: `Dispatch ${count} lab jobs now.` },
  ];
}

function requireStr(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new ParseError(`Expected non-empty string for "${field}"`);
  }
  return value;
}

export function parseLabCatalog(text: string): LabBrief[] {
  let raw: unknown;
  try {
    raw = JSON.parse(extractJsonArrayFromText(text));
  } catch (err) {
    if (err instanceof ParseError) throw err;
    throw new ParseError(`Failed to JSON.parse lab catalog: ${(err as Error).message}`);
  }
  if (!Array.isArray(raw)) throw new ParseError("Lab catalog was not a JSON array");
  if (raw.length < MIN_CATALOG_LABS) {
    throw new ParseError(`Lab catalog must contain at least ${MIN_CATALOG_LABS} labs, got ${raw.length}`);
  }

  const seen = new Set<string>();
  return raw.slice(0, MAX_CATALOG_LABS).map((l, li) => {
    const lab = l as Record<string, unknown>;
    const engine = lab.engine;
    if (typeof engine !== "string" || !LAB_ENGINES.includes(engine as LabEngine)) {
      throw new ParseError(`labs[${li}].engine invalid: ${JSON.stringify(engine)}`);
    }
    let id = requireStr(lab.id, `labs[${li}].id`);
    if (seen.has(id)) id = `${id}-${li}`;
    seen.add(id);
    return {
      id,
      engine: engine as LabEngine,
      title: requireStr(lab.title, `labs[${li}].title`),
      blurb: requireStr(lab.blurb, `labs[${li}].blurb`),
      tags: requireStr(lab.tags, `labs[${li}].tags`),
      brief: requireStr(lab.brief, `labs[${li}].brief`),
    };
  });
}

/**
 * Client-side: recover the brief stashed by the lab board for `/labs/<engine>?lab=<id>`.
 * Returns undefined when there is no param, no stash, or we're not in a browser —
 * the lab page then generates a fresh random scenario.
 */
export function readStashedBrief(labId: string | null): string | undefined {
  if (!labId || typeof window === "undefined") return undefined;
  try {
    const raw = sessionStorage.getItem(`lab:${labId}`);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as Partial<LabBrief>;
    return typeof parsed.brief === "string" && parsed.brief.trim() !== "" ? parsed.brief : undefined;
  } catch {
    return undefined;
  }
}

export const FALLBACK_LAB_CATALOG: LabBrief[] = [
  {
    id: "branch-buildout",
    engine: "wiring",
    title: "New branch office buildout",
    blurb: "Sales just moved into a new branch and nothing behind the ISP handoff is wired. Bring the front desk and Wi-Fi online.",
    tags: "Network+ · CCNA",
    brief: "Wire a brand-new branch office: ISP modem, edge router, access switch, front-desk PC, and a ceiling AP.",
  },
  {
    id: "clinic-dead-uplink",
    engine: "wiring",
    title: "Clinic floor offline after move",
    blurb: "Facilities relocated the comms cabinet over the weekend and left the patch panel unplugged. The whole clinic floor is dark.",
    tags: "Network+ · CCNP Security",
    brief: "Restore the uplink chain in a medical clinic: fiber ONT, perimeter firewall, patch panel, floor switch.",
  },
  {
    id: "school-ap-rollout",
    engine: "wiring",
    title: "School Wi-Fi rollout",
    blurb: "Two new classrooms need Wi-Fi before term starts. Switch capacity is ready — wire the APs and verify the uplink chain.",
    tags: "Network+ · CCNA",
    brief: "Wire two new PoE access points into a school's PoE switch and verify the core router uplink.",
  },
  {
    id: "warehouse-camera-drop",
    engine: "wiring",
    title: "Warehouse camera network",
    blurb: "Security wants the loading-dock cameras on their own switch. Cable the NVR, cameras, and uplink without touching production.",
    tags: "Network+ · SecurityX",
    brief: "Wire a warehouse camera segment: dedicated PoE switch, two IP cameras, an NVR PC, and an uplink to the core router.",
  },
  {
    id: "hotel-fgt-deploy",
    engine: "fortigate",
    title: "Hotel FortiGate deployment",
    blurb: "A boutique hotel just received a factory-fresh FortiGate. Cable it in, bring WAN up, and get guest traffic flowing securely.",
    tags: "Fortinet FCP · CCNP Security",
    brief: "Deploy a new FortiGate at a hotel: WAN1 via DHCP, LAN addressing, and a NAT policy for guest internet.",
  },
  {
    id: "lawfirm-webfilter",
    engine: "fortigate",
    title: "Law firm web filtering",
    blurb: "The managing partner wants social media and streaming blocked firm-wide. Wire the FortiGate and roll out the web filter.",
    tags: "Fortinet FCP · SecurityX",
    brief: "Configure FortiGate web filtering at a law firm: block social-media and streaming categories on the LAN-to-WAN policy.",
  },
  {
    id: "retail-port-forward",
    engine: "fortigate",
    title: "Retail camera NVR port-forward",
    blurb: "Head office needs remote access to the store's camera NVR. Publish it safely through the FortiGate with a VIP and tight policy.",
    tags: "Fortinet FCP · Network+",
    brief: "Create a FortiGate virtual IP and firewall policy that port-forwards HTTPS from WAN1 to the store's camera NVR.",
  },
  {
    id: "branch-vpn-repair",
    engine: "fortigate",
    title: "Branch VPN tunnel repair",
    blurb: "The site-to-site tunnel to HQ dropped after an ISP change and won't come back. Re-cable WAN and rebuild the IPsec config.",
    tags: "Fortinet FCP · CCNP Security",
    brief: "Repair a FortiGate IPsec site-to-site tunnel after a WAN change: fix WAN1 addressing and rebuild phase1/phase2.",
  },
  {
    id: "branch-router-turnup",
    engine: "router",
    title: "Branch router turn-up",
    blurb: "A replacement Cisco ISR just arrived after the old router died in a power surge. Cable it in and bring the branch back online from the IOS CLI.",
    tags: "CCNA · Network+",
    brief: "Turn up a replacement Cisco ISR at a branch: WAN via DHCP, LAN addressing, DHCP pool, and NAT overload.",
  },
  {
    id: "cafe-router-dhcp-nat",
    engine: "router",
    title: "Café guest network rollout",
    blurb: "A café wants guest Wi-Fi behind its new router. Wire it up, then configure DHCP and NAT so guests actually get online.",
    tags: "CCNA · Network+",
    brief: "Configure a café's Cisco router: LAN interface addressing, a guest DHCP pool, a default route, and NAT overload to the WAN.",
  },
];
