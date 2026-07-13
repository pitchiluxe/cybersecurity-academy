import type { ChatMessage } from "./openrouter";
import type { ScenarioSeed } from "./types";
import { extractJsonFromText, ParseError } from "./parsing";

/**
 * "Summer of CCNA" bootcamp — distilled from the Academy CCNA study plan
 * (May 4 → Aug 28, 27 skills over 17 weeks, Castle Rysen Coffee storyline).
 * Each skill is one chapter: an AI-written lesson + quiz (cached per user),
 * an AI tutor, and a simulated-VM lab themed on the skill.
 */
export interface BootcampSkill {
  id: string;
  num: number;
  title: string;
  week: string;
  blurb: string;
  lessons: string[];
  labSeed: ScenarioSeed;
}

export const BOOTCAMP_START = "May 4, 2026";
export const BOOTCAMP_END = "August 28, 2026";

function seed(os: string, device: string, detail: string, rootCause: string, openingMessage: string): ScenarioSeed {
  return {
    category: "network",
    persona: { name: "Rylee Castle", department: "Castle Rysen Coffee — Ops" },
    environment: { os, device, detail },
    rootCause,
    openingMessage,
  };
}

const IOS_SW = "Cisco IOS 15.2 (switch)";
const IOS_RTR = "Cisco IOS-XE 17.9 (router)";

export const BOOTCAMP_SKILLS: BootcampSkill[] = [
  {
    id: "s00", num: 0, title: "Networking Fundamentals", week: "Week 1",
    blurb: "What networks, switches and routers actually do; TCP/IP vs OSI; cabling, PoE, fiber, and why port security matters.",
    lessons: ["What is a Network / Switch / Router?", "TCP/IP and OSI models with real-life examples", "Network design do's and don'ts, data center & WAN", "Home network + hybrid cloud", "Ethernet cables, PoE, fiber optics", "Port security teaser"],
    labSeed: seed("Windows 11", "Front-counter PC", "Cat5e drop to the back-office switch",
      "The PC's Ethernet cable is plugged into a switch port that was administratively shut down after a security audit",
      "The front-counter PC says 'no internet' — the cable light isn't even blinking. We swapped the cable and it's still dead."),
  },
  {
    id: "s01", num: 1, title: "Packet Tracer Basics", week: "Week 1",
    blurb: "Install Packet Tracer, build your first network, and learn the essential simulator functions.",
    lessons: ["Installing Packet Tracer", "Building your first network", "Essential Packet Tracer functions"],
    labSeed: seed("Windows 11", "Training laptop", "Packet Tracer 8.2 installed for the new hire",
      "Packet Tracer fails to launch because the user profile's temp directory is full and the app cache is corrupted",
      "I'm trying to open Packet Tracer for my CCNA practice and it crashes on the splash screen every time."),
  },
  {
    id: "s02", num: 2, title: "Network Design Overview", week: "Weeks 1-2",
    blurb: "The Castle Rysen Coffee RFP: LAN vs WAN, clients & servers, switching & wireless, routers & firewalls.",
    lessons: ["Castle Rysen Coffee RFP overview", "LAN vs WAN", "Staging the network equipment", "Clients & servers", "Switching & wireless", "Router & firewall"],
    labSeed: seed("Windows Server 2022", "Staging server", "New equipment staging VLAN for the café build-out",
      "The DHCP scope for the staging VLAN was never activated, so newly staged devices get APIPA addresses",
      "None of the new gear we're staging for the café pulls an IP address — everything comes up 169.254.x.x."),
  },
  {
    id: "s03", num: 3, title: "Standards & Cabling", week: "Weeks 2-3",
    blurb: "Network standards, bits vs bytes, copper and fiber characteristics, MDI-X, and diagramming the coffee house.",
    lessons: ["Why standards matter", "Speed: bits and bytes", "Copper cabling standards", "Straight-through, crossover, MDI-X", "Fiber optic spectrum", "Network diagrams", "Physically connecting the coffee house"],
    labSeed: seed(IOS_SW, "Catalyst 2960 — café IDF", "Uplink to the roastery over multimode fiber",
      "The fiber uplink interface is negotiated to 100Mb half-duplex because a duplex mismatch was hard-coded on one side",
      "The café-to-roastery link is crawling and the switch logs show late collisions on the uplink port."),
  },
  {
    id: "s04", num: 4, title: "Network Models & Design", week: "Week 3",
    blurb: "OSI vs TCP/IP in practice, describing communication with models, and three-tier architecture for Castle Rysen.",
    lessons: ["OSI vs TCP/IP", "Describing communication with models", "Three-tier architecture", "Castle Rysen network design"],
    labSeed: seed("Windows 11", "Barista tablet", "Connects through access → distribution → core",
      "The default gateway configured on the tablet points at the core switch SVI that no longer exists after the redesign",
      "The new tablet can see other tills on the counter but can't reach the cloud POS after the network redesign."),
  },
  {
    id: "s05", num: 5, title: "Cisco IOS Basics", week: "Weeks 3-4",
    blurb: "Console connections, navigating IOS, the boot process, base configuration, and saving/resetting configs.",
    lessons: ["Console connections", "Navigating Cisco IOS", "Device boot process", "Base configuration", "Saving & resetting configurations", "Lab: District Shop bring-up"],
    labSeed: seed(IOS_SW, "Catalyst 2960 — District Shop", "Fresh out of the box, console access only",
      "The switch boots to a blank config: it needs hostname, console+vty passwords, an SVI address on VLAN 1 and the config saved to NVRAM",
      "The District Shop's new switch arrived. Bring it up: hostname DISTRICT-SW1, secure console and vty access, management IP 192.168.9.2/24 on VLAN 1, then save it so it survives a reboot."),
  },
  {
    id: "s06", num: 6, title: "Switching & CAM Tables", week: "Weeks 4-5",
    blurb: "MAC addresses and frames, port numbering, how switches learn, and tracking devices with the CAM table.",
    lessons: ["MAC addresses and frames", "Port numbering & CAM table", "How switches switch", "Exploring MAC address tables", "Tracking devices via CAM", "Lab: Roastery West switch recon"],
    labSeed: seed(IOS_SW, "Catalyst 2960 — Roastery West", "48-port access switch, unlabeled patching",
      "A rogue personal Wi-Fi router is plugged into an access port, identifiable only by chasing its MAC through the CAM table",
      "Something on the roastery floor is handing out wrong IP addresses. Find which port the rogue device is on using the MAC table and shut that port down."),
  },
  {
    id: "s07", num: 7, title: "IP Addressing", week: "Week 5",
    blurb: "Why IPs exist, subnet masks, private vs public addressing, and the initial addressing of Castle Rysen.",
    lessons: ["Why we need IPs", "Subnet masks define networks", "Private and public IPs", "Initial Castle Rysen addressing"],
    labSeed: seed("Windows 11", "Office PC — back office", "Static IP on the ops VLAN",
      "The PC was given a static IP in the wrong subnet (10.20.31.x instead of 10.20.30.x), so it can ARP nothing useful",
      "After the addressing cleanup my back-office PC can't print or reach the file share. It has an IP, just apparently a useless one."),
  },
  {
    id: "s08", num: 8, title: "Interface Configuration", week: "Weeks 5-6",
    blurb: "Configuring switch and router interfaces, reading interface counters, and understanding speed/duplex.",
    lessons: ["Configuring switch interfaces", "Configuring router interfaces", "Interface counters", "Interface speed", "Lab: Coffee House Fallout local routing"],
    labSeed: seed(IOS_RTR, "ISR 4321 — coffee house edge", "Gi0/0/1 faces the LAN switch",
      "The router's LAN interface has the right address but was left administratively down (no 'no shutdown')",
      "The coffee house LAN can't reach the router at all. The switch says its uplink is down/down — the router end shows admin down."),
  },
  {
    id: "s09", num: 9, title: "Routing (Static & Dynamic)", week: "Weeks 6",
    blurb: "Local, static, default, and EIGRP dynamic routing; routing-table concepts and route selection.",
    lessons: ["Why routers exist", "Local routing", "Static routing", "Default routing", "EIGRP dynamic routing", "Routing table & route selection", "Documenting the routed network"],
    labSeed: seed(IOS_RTR, "ISR 4321 — Castle Rysen HQ", "Links to the café and the roastery routers",
      "The static route to the roastery subnet points at the wrong next-hop, and there is no default route toward the ISP",
      "HQ can reach the café but not the roastery, and nothing gets to the internet. Check the routing table — something's pointed the wrong way."),
  },
  {
    id: "s10", num: 10, title: "NAT", week: "Weeks 6-7",
    blurb: "How NAT works, Cisco NAT terminology, and configuring static NAT, dynamic NAT, and NAT overload (PAT).",
    lessons: ["How NAT works", "Cisco NAT terminology", "Static NAT", "Dynamic NAT", "NAT overload (PAT)"],
    labSeed: seed(IOS_RTR, "ISR 4321 — internet edge", "WAN Gi0/0/0 to ISP, LAN Gi0/0/1",
      "NAT overload is configured but the inside interface is missing 'ip nat inside', so no translations are built",
      "The whole café lost internet after last night's change window. The ISP link is up, pings from the router work, but no user traffic gets out."),
  },
  {
    id: "s11", num: 11, title: "Subnetting", week: "Weeks 7-8",
    blurb: "Binary conversion, Class C/B/A subnetting in three steps, host-based sizing, reverse-engineering masks, and VLSM.",
    lessons: ["What is subnetting?", "Decimal to binary", "Class C in three steps", "Class B and A", "Sizing by host requirements", "Reverse engineering a mask", "VLSM", "Re-addressing Castle Rysen"],
    labSeed: seed(IOS_RTR, "ISR 4321 — HQ", "New VLSM plan rolling out",
      "Two point-to-point links were given overlapping /30s from a bad VLSM worksheet, so OSPF-learned routes flap",
      "Since the re-addressing, the HQ-to-café link keeps flapping routes. I suspect two links got overlapping subnets — verify and fix the addressing."),
  },
  {
    id: "s12", num: 12, title: "VLANs & Trunking", week: "Weeks 8-9",
    blurb: "Creating and naming VLANs, trunks, inter-VLAN routing, DTP/VTP hardening, and the native VLAN.",
    lessons: ["Why VLANs", "Creating & naming VLANs", "Trunks", "Routing between VLANs", "Avoiding DTP & VTP", "Native VLAN", "Fallout Shelter network build", "Café VLAN implementation"],
    labSeed: seed(IOS_SW, "Catalyst 2960 — café access", "Trunk to the distribution switch on Gi0/1",
      "The new VOICE VLAN 40 exists on distribution but was never created on this switch and is missing from the trunk's allowed list",
      "The new VoIP phones at the café boot but never register. Data VLAN works fine. Voice VLAN traffic seems to die at this switch."),
  },
  {
    id: "s13", num: 13, title: "Spanning Tree Protocol", week: "Weeks 9-10",
    blurb: "Why STP exists, port selection rules, port states, Rapid/Multiple STP, PortFast and BPDU Guard.",
    lessons: ["Why we need STP", "Key STP concepts", "Three rules of port selection", "Port states & configuration", "Rapid & Multiple STP", "PortFast & BPDU Guard", "STP at Castle Rysen"],
    labSeed: seed(IOS_SW, "Catalyst 2960 — shelter core", "Redundant links to two access switches",
      "PortFast is enabled on an uplink port without BPDU Guard, and a looped patch cable is causing intermittent broadcast storms",
      "Every hour or so the shelter network freezes for 30 seconds — MAC flapping messages everywhere. Find the loop and lock STP down properly."),
  },
  {
    id: "s14", num: 14, title: "EtherChannel", week: "Week 10",
    blurb: "Bundling links with LACP, tuning load balancing, and deploying EtherChannel at Castle Rysen Coffee.",
    lessons: ["How EtherChannel increases bandwidth", "Configuring LACP", "Tuning load balancing", "EtherChannel at Castle Rysen"],
    labSeed: seed(IOS_SW, "Catalyst 2960 — distribution", "2x Gi uplinks to core meant to be Po1",
      "One side of the LACP bundle is set to 'on' mode while the other runs 'active', so the port-channel never forms",
      "We cabled the second uplink to double the bandwidth but the port-channel shows down and one link sits suspended."),
  },
  {
    id: "s15", num: 15, title: "OSPF", week: "Weeks 10-11",
    blurb: "Routing protocol categories, how best paths are chosen, the network command, and implementing/troubleshooting/scaling OSPF.",
    lessons: ["Advantages of routing protocols", "Categories of routing protocols", "Best-path selection", "The network command", "Implementing OSPF", "OSPF troubleshooting", "Scaling OSPF"],
    labSeed: seed(IOS_RTR, "ISR 4321 — fallout grid", "OSPF area 0 with HQ and café neighbors",
      "This router's OSPF network statement uses a wrong wildcard mask, so its LAN never gets advertised and one neighbor is stuck in INIT due to mismatched hello timers",
      "OSPF came up everywhere except this site: neighbors flap between INIT and nothing, and HQ never learns our LAN subnet."),
  },
  {
    id: "s16", num: 16, title: "First-Hop Redundancy (HSRP)", week: "Weeks 11-12",
    blurb: "When to use FHRPs, the flavors (HSRP/VRRP/GLBP), and configuring HSRPv2 at Castle Rysen.",
    lessons: ["When to use FHRPs", "Flavors of FHRPs", "Configuring HSRPv2"],
    labSeed: seed(IOS_RTR, "ISR 4321 — HQ gateway pair", "HSRPv2 group 10 with a standby peer",
      "The two HSRP routers are configured with different virtual IPs for the same group, so both go Active and hosts lose their gateway on failover",
      "During last week's failover test half the office lost internet. Both gateway routers claim to be HSRP Active. That can't be right."),
  },
  {
    id: "s17", num: 17, title: "IPv6", week: "Week 12",
    blurb: "IPv6 fundamentals, address shortcuts, and configuring the IPv6 overlay at Castle Rysen café and shelter.",
    lessons: ["IPv6, the someday protocol", "Address shortcuts", "IPv6 overlay at the café", "IPv6 at the fallout shelter"],
    labSeed: seed(IOS_RTR, "ISR 4321 — café edge", "Dual-stack rollout in progress",
      "IPv6 unicast routing was never enabled globally, so the configured interface addresses exist but nothing routes",
      "We put IPv6 addresses on every café interface but v6 pings across the router fail. v4 is fine. What did we forget?"),
  },
  {
    id: "s18", num: 18, title: "Access Control Lists", week: "Weeks 12-13",
    blurb: "The five common ACL purposes, standard vs extended configuration, and deploying access control at Castle Rysen.",
    lessons: ["Five common ACL purposes", "Standard ACL configuration", "Extended ACL configuration", "Deploying access control"],
    labSeed: seed(IOS_RTR, "ISR 4321 — HQ", "New guest-network ACL applied this morning",
      "A standard ACL applied inbound on the LAN interface ends with an implicit deny and is missing the permit for the ops subnet, blocking the POS servers",
      "Since this morning's 'guest lockdown' change, the tills can't reach the POS servers. Guests are fine — which is the opposite of what we wanted."),
  },
  {
    id: "s19", num: 19, title: "Security Fundamentals", week: "Weeks 13-14",
    blurb: "Vulnerabilities, exploits and threats; common attack types; identity and password attacks; Cisco AAA.",
    lessons: ["Vulnerabilities, exploits, threats", "Types of security threats", "Identity & password attacks", "The place of Cisco AAA"],
    labSeed: seed("Windows Server 2022", "Ops jump server", "RADIUS client for network device logins",
      "An attacker's dictionary attack succeeded against a weak local fallback account because AAA fallback was set to a shared local password and lockout was disabled",
      "The audit flagged dozens of failed logins on the jump server followed by a success at 3am from an odd IP. Figure out how they got in and close the hole."),
  },
  {
    id: "s20", num: 20, title: "Layer 2 Security", week: "Week 14",
    blurb: "Port security, DHCP snooping, and Dynamic ARP Inspection — hardening Castle Rysen's access layer.",
    lessons: ["Configuring port security", "DHCP snooping", "Dynamic ARP Inspection", "Layer 2 security deployment"],
    labSeed: seed(IOS_SW, "Catalyst 2960 — café access", "Public seating area ports",
      "DHCP snooping is enabled but the uplink to the real DHCP server was never marked trusted, so all leases are being dropped",
      "After we enabled the fancy new security features, nobody in the café can get an IP address anymore. Roll it forward, not back — fix the config."),
  },
  {
    id: "s21", num: 21, title: "Discovery Protocols", week: "Weeks 14-15",
    blurb: "Using CDP and LLDP to map the network — and knowing when to switch them off.",
    lessons: ["Cisco Discovery Protocol", "Link Layer Discovery Protocol", "Field discovery safeguards"],
    labSeed: seed(IOS_SW, "Catalyst 2960 — field site", "Undocumented closet, two mystery uplinks",
      "The switch's uplink neighbors are unknown; CDP is disabled globally and must be re-enabled to map the closet, and one neighbor advertises a mismatched native VLAN",
      "We inherited this field-site closet with zero documentation. Map what this switch connects to and flag anything dodgy you find."),
  },
  {
    id: "s22", num: 22, title: "IP Services", week: "Week 15",
    blurb: "Cisco clocks and NTP, DNS on devices, DHCP services, and SSH — deploying IP services at Castle Rysen.",
    lessons: ["Setting clocks manually", "NTP", "DNS on Cisco devices", "DHCP services on Cisco devices", "Configuring SSH", "Deploying IP services"],
    labSeed: seed(IOS_RTR, "ISR 4321 — café edge", "Device management hardening pass",
      "The vty lines still allow telnet, SSH fails because no RSA keys were generated and the domain name is missing, and NTP points at a decommissioned server",
      "Security says: SSH-only management and correct clocks on every device by Friday. This router still telnets and its clock is off by hours."),
  },
  {
    id: "s23", num: 23, title: "SNMP & Syslog", week: "Week 16",
    blurb: "What SNMP is, configuring SNMPv2c and SNMPv3, and understanding and configuring syslog.",
    lessons: ["What is SNMP?", "SNMPv2c and SNMPv3", "Understanding & configuring syslog"],
    labSeed: seed(IOS_SW, "Catalyst 2960 — shelter core", "Telemetry rollout to the new NMS",
      "Syslog is only logging to the console at severity errors, and SNMP uses the old community string the NMS no longer accepts",
      "The new monitoring server shows this switch as a grey box — no metrics, no logs. Wire its telemetry up to 10.50.1.20 properly."),
  },
  {
    id: "s24", num: 24, title: "Quality of Service", week: "Week 16",
    blurb: "QoS concepts, classification and marking, and treatment methods: queuing, shaping, policing.",
    lessons: ["QoS concepts", "Classification & marking", "Queuing, shaping, policing"],
    labSeed: seed(IOS_RTR, "ISR 4321 — café edge", "VoIP rollout with a 50Mb uplink",
      "Voice traffic is being marked but the service-policy was applied to the wrong interface, so calls break up whenever backups run",
      "Café calls sound like robots every night at 8pm when the cloud backup kicks off. The QoS policy is 'applied' — allegedly."),
  },
  {
    id: "s25", num: 25, title: "Wireless", week: "Week 17",
    blurb: "How wireless works, channel planning, WAP association, and wireless security.",
    lessons: ["How wireless works", "Planning channels", "Selecting & associating with WAPs", "Wireless security"],
    labSeed: seed("Windows 11", "Barista laptop", "Café Wi-Fi with three ceiling APs",
      "Two neighboring APs are on overlapping 2.4GHz channels (1 and 3), causing co-channel interference near the espresso bar",
      "Wi-Fi by the espresso bar is unusable at rush hour but fine at the windows. The APs all show 'up'. Something about channels?"),
  },
  {
    id: "s26", num: 26, title: "Automation & SDN", week: "Week 17",
    blurb: "Network automation and SDN, Cisco SDN platforms, RESTful APIs, and a glance at Ansible, Puppet, Chef.",
    lessons: ["Network automation & SDN", "Cisco SDN models & platforms", "RESTful APIs", "Ansible, Puppet, Chef & markup"],
    labSeed: seed("Ubuntu 22.04", "Automation jump host", "Ansible controller for network configs",
      "The Ansible playbook fails because the inventory file has a wrong ansible_network_os and SSH host-key checking blocks the first connection",
      "My first playbook to backup the switch configs dies instantly with a connection error. The switches are reachable — it's something on this controller."),
  },
];

export function getBootcampSkill(id: string): BootcampSkill | undefined {
  return BOOTCAMP_SKILLS.find((s) => s.id === id);
}

export function isBootcampSkillId(value: unknown): value is string {
  return typeof value === "string" && BOOTCAMP_SKILLS.some((s) => s.id === value);
}

// ---- AI chapter content (lesson + quiz), cached per user ------------------

export interface BootcampQuizQuestion {
  question: string;
  choices: string[];
  answerIndex: number;
}

export interface BootcampChapter {
  lesson: string;
  quiz: BootcampQuizQuestion[];
}

export function buildBootcampChapterMessages(skill: BootcampSkill): ChatMessage[] {
  const system = `You are writing one chapter of a CCNA bootcamp ("Summer of CCNA", Castle Rysen Coffee storyline) for an IT trainee.
Chapter: Skill ${String(skill.num).padStart(2, "0")} — ${skill.title}. Scope: ${skill.blurb}
Topics to cover, in order: ${skill.lessons.join("; ")}.
Write:
- "lesson": a 400-600 word lesson in plain text (short paragraphs, no markdown headers) that teaches these topics with concrete Cisco CLI examples where relevant and ties back to the Castle Rysen Coffee scenario.
- "quiz": 5 multiple-choice questions on this chapter, CCNA exam style, exactly 4 choices each, one correct.
Respond with ONLY a JSON object, no prose, no markdown fences:
{ "lesson": "string", "quiz": [ { "question": "string", "choices": ["a","b","c","d"], "answerIndex": 0 } ] }`;
  return [
    { role: "system", content: system },
    { role: "user", content: "Write the chapter now." },
  ];
}

export function parseBootcampChapter(text: string): BootcampChapter {
  let raw: unknown;
  try {
    raw = JSON.parse(extractJsonFromText(text));
  } catch (err) {
    if (err instanceof ParseError) throw err;
    throw new ParseError(`Failed to JSON.parse bootcamp chapter: ${(err as Error).message}`);
  }
  if (typeof raw !== "object" || raw === null) throw new ParseError("Chapter was not a JSON object");
  const obj = raw as Record<string, unknown>;
  if (typeof obj.lesson !== "string" || obj.lesson.trim().length < 100) {
    throw new ParseError("Chapter lesson missing or too short");
  }
  if (!Array.isArray(obj.quiz) || obj.quiz.length < 3) {
    throw new ParseError("Chapter quiz must have at least 3 questions");
  }
  const quiz: BootcampQuizQuestion[] = obj.quiz.map((q, qi) => {
    const question = q as Record<string, unknown>;
    if (!Array.isArray(question.choices) || question.choices.length !== 4 || !question.choices.every((c) => typeof c === "string" && c.trim() !== "")) {
      throw new ParseError(`quiz[${qi}].choices must be exactly 4 non-empty strings`);
    }
    const answerIndex = question.answerIndex;
    if (typeof answerIndex !== "number" || !Number.isInteger(answerIndex) || answerIndex < 0 || answerIndex > 3) {
      throw new ParseError(`quiz[${qi}].answerIndex out of range`);
    }
    if (typeof question.question !== "string" || question.question.trim() === "") {
      throw new ParseError(`quiz[${qi}].question missing`);
    }
    return { question: question.question, choices: question.choices as string[], answerIndex };
  });
  return { lesson: obj.lesson, quiz };
}

export type ClientBootcampChapter = { lesson: string; quiz: { question: string; choices: string[] }[] };

/** Quiz answer keys stay on the server. */
export function stripBootcampAnswers(chapter: BootcampChapter): ClientBootcampChapter {
  return {
    lesson: chapter.lesson,
    quiz: chapter.quiz.map(({ question, choices }) => ({ question, choices })),
  };
}
