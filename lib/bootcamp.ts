import type { ChatMessage } from "./openrouter";
import type { ScenarioSeed } from "./types";
import { extractJsonFromText, ParseError } from "./parsing";

/**
 * Certification bootcamps. Each bootcamp is a certification-length study plan
 * broken into skills; each skill is one chapter: an AI-written lesson + quiz
 * (cached per user), an AI tutor, and a simulated-VM lab themed on the skill.
 * The CCNA camp follows the Academy CCNA study plan (27 skills, Castle Rysen
 * Coffee storyline); the trainee's own start date is recorded on enrollment.
 */
export interface BootcampSkill {
  id: string;
  camp: string;
  num: number;
  title: string;
  week: string;
  blurb: string;
  lessons: string[];
  labSeed: ScenarioSeed;
}

export interface BootcampMeta {
  id: string;
  title: string;
  certName: string;
  blurb: string;
  duration: string;
}

/** A chapter quiz counts as passed at this score; passing every chapter earns the camp certificate. */
export const BOOTCAMP_PASS_SCORE = 80;

export const BOOTCAMPS: BootcampMeta[] = [
  { id: "ccna", title: "Summer of CCNA", certName: "Cisco CCNA", duration: "27 skills · ~17 weeks",
    blurb: "The full Academy CCNA plan: from 'what is a network?' to OSPF, VLANs, security and automation — building Castle Rysen Coffee's network the whole way." },
  { id: "ccnp", title: "CCNP Enterprise Bootcamp", certName: "Cisco CCNP Enterprise", duration: "12 skills · ~12 weeks",
    blurb: "Advanced routing and switching for the engineer who passed CCNA: OSPF at scale, BGP, redundancy, wireless, SD-WAN concepts, and enterprise automation." },
  { id: "secplus", title: "Security+ Bootcamp", certName: "CompTIA Security+", duration: "12 skills · ~12 weeks",
    blurb: "SY0-701 from first principles: threats and attacks, cryptography, identity, network and endpoint hardening, incident response and governance." },
  { id: "netplus", title: "Network+ Bootcamp", certName: "CompTIA Network+", duration: "10 skills · ~10 weeks",
    blurb: "N10-009 essentials: media, models, IP addressing, routing and switching basics, wireless, network services, security and troubleshooting method." },
  { id: "aplus", title: "A+ Bootcamp", certName: "CompTIA A+", duration: "10 skills · ~10 weeks",
    blurb: "The technician's foundation: hardware, operating systems, mobile devices, virtualization, networking basics, security hygiene and troubleshooting." },
];

export function getBootcamp(id: string): BootcampMeta | undefined {
  return BOOTCAMPS.find((b) => b.id === id);
}

export function isBootcampId(value: unknown): value is string {
  return typeof value === "string" && BOOTCAMPS.some((b) => b.id === value);
}

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
    id: "s00", camp: "ccna", num: 0, title: "Networking Fundamentals", week: "Week 1",
    blurb: "What networks, switches and routers actually do; TCP/IP vs OSI; cabling, PoE, fiber, and why port security matters.",
    lessons: ["What is a Network / Switch / Router?", "TCP/IP and OSI models with real-life examples", "Network design do's and don'ts, data center & WAN", "Home network + hybrid cloud", "Ethernet cables, PoE, fiber optics", "Port security teaser"],
    labSeed: seed("Windows 11", "Front-counter PC", "Cat5e drop to the back-office switch",
      "The PC's Ethernet cable is plugged into a switch port that was administratively shut down after a security audit",
      "The front-counter PC says 'no internet' — the cable light isn't even blinking. We swapped the cable and it's still dead."),
  },
  {
    id: "s01", camp: "ccna", num: 1, title: "Packet Tracer Basics", week: "Week 1",
    blurb: "Install Packet Tracer, build your first network, and learn the essential simulator functions.",
    lessons: ["Installing Packet Tracer", "Building your first network", "Essential Packet Tracer functions"],
    labSeed: seed("Windows 11", "Training laptop", "Packet Tracer 8.2 installed for the new hire",
      "Packet Tracer fails to launch because the user profile's temp directory is full and the app cache is corrupted",
      "I'm trying to open Packet Tracer for my CCNA practice and it crashes on the splash screen every time."),
  },
  {
    id: "s02", camp: "ccna", num: 2, title: "Network Design Overview", week: "Weeks 1-2",
    blurb: "The Castle Rysen Coffee RFP: LAN vs WAN, clients & servers, switching & wireless, routers & firewalls.",
    lessons: ["Castle Rysen Coffee RFP overview", "LAN vs WAN", "Staging the network equipment", "Clients & servers", "Switching & wireless", "Router & firewall"],
    labSeed: seed("Windows Server 2022", "Staging server", "New equipment staging VLAN for the café build-out",
      "The DHCP scope for the staging VLAN was never activated, so newly staged devices get APIPA addresses",
      "None of the new gear we're staging for the café pulls an IP address — everything comes up 169.254.x.x."),
  },
  {
    id: "s03", camp: "ccna", num: 3, title: "Standards & Cabling", week: "Weeks 2-3",
    blurb: "Network standards, bits vs bytes, copper and fiber characteristics, MDI-X, and diagramming the coffee house.",
    lessons: ["Why standards matter", "Speed: bits and bytes", "Copper cabling standards", "Straight-through, crossover, MDI-X", "Fiber optic spectrum", "Network diagrams", "Physically connecting the coffee house"],
    labSeed: seed(IOS_SW, "Catalyst 2960 — café IDF", "Uplink to the roastery over multimode fiber",
      "The fiber uplink interface is negotiated to 100Mb half-duplex because a duplex mismatch was hard-coded on one side",
      "The café-to-roastery link is crawling and the switch logs show late collisions on the uplink port."),
  },
  {
    id: "s04", camp: "ccna", num: 4, title: "Network Models & Design", week: "Week 3",
    blurb: "OSI vs TCP/IP in practice, describing communication with models, and three-tier architecture for Castle Rysen.",
    lessons: ["OSI vs TCP/IP", "Describing communication with models", "Three-tier architecture", "Castle Rysen network design"],
    labSeed: seed("Windows 11", "Barista tablet", "Connects through access → distribution → core",
      "The default gateway configured on the tablet points at the core switch SVI that no longer exists after the redesign",
      "The new tablet can see other tills on the counter but can't reach the cloud POS after the network redesign."),
  },
  {
    id: "s05", camp: "ccna", num: 5, title: "Cisco IOS Basics", week: "Weeks 3-4",
    blurb: "Console connections, navigating IOS, the boot process, base configuration, and saving/resetting configs.",
    lessons: ["Console connections", "Navigating Cisco IOS", "Device boot process", "Base configuration", "Saving & resetting configurations", "Lab: District Shop bring-up"],
    labSeed: seed(IOS_SW, "Catalyst 2960 — District Shop", "Fresh out of the box, console access only",
      "The switch boots to a blank config: it needs hostname, console+vty passwords, an SVI address on VLAN 1 and the config saved to NVRAM",
      "The District Shop's new switch arrived. Bring it up: hostname DISTRICT-SW1, secure console and vty access, management IP 192.168.9.2/24 on VLAN 1, then save it so it survives a reboot."),
  },
  {
    id: "s06", camp: "ccna", num: 6, title: "Switching & CAM Tables", week: "Weeks 4-5",
    blurb: "MAC addresses and frames, port numbering, how switches learn, and tracking devices with the CAM table.",
    lessons: ["MAC addresses and frames", "Port numbering & CAM table", "How switches switch", "Exploring MAC address tables", "Tracking devices via CAM", "Lab: Roastery West switch recon"],
    labSeed: seed(IOS_SW, "Catalyst 2960 — Roastery West", "48-port access switch, unlabeled patching",
      "A rogue personal Wi-Fi router is plugged into an access port, identifiable only by chasing its MAC through the CAM table",
      "Something on the roastery floor is handing out wrong IP addresses. Find which port the rogue device is on using the MAC table and shut that port down."),
  },
  {
    id: "s07", camp: "ccna", num: 7, title: "IP Addressing", week: "Week 5",
    blurb: "Why IPs exist, subnet masks, private vs public addressing, and the initial addressing of Castle Rysen.",
    lessons: ["Why we need IPs", "Subnet masks define networks", "Private and public IPs", "Initial Castle Rysen addressing"],
    labSeed: seed("Windows 11", "Office PC — back office", "Static IP on the ops VLAN",
      "The PC was given a static IP in the wrong subnet (10.20.31.x instead of 10.20.30.x), so it can ARP nothing useful",
      "After the addressing cleanup my back-office PC can't print or reach the file share. It has an IP, just apparently a useless one."),
  },
  {
    id: "s08", camp: "ccna", num: 8, title: "Interface Configuration", week: "Weeks 5-6",
    blurb: "Configuring switch and router interfaces, reading interface counters, and understanding speed/duplex.",
    lessons: ["Configuring switch interfaces", "Configuring router interfaces", "Interface counters", "Interface speed", "Lab: Coffee House Fallout local routing"],
    labSeed: seed(IOS_RTR, "ISR 4321 — coffee house edge", "Gi0/0/1 faces the LAN switch",
      "The router's LAN interface has the right address but was left administratively down (no 'no shutdown')",
      "The coffee house LAN can't reach the router at all. The switch says its uplink is down/down — the router end shows admin down."),
  },
  {
    id: "s09", camp: "ccna", num: 9, title: "Routing (Static & Dynamic)", week: "Weeks 6",
    blurb: "Local, static, default, and EIGRP dynamic routing; routing-table concepts and route selection.",
    lessons: ["Why routers exist", "Local routing", "Static routing", "Default routing", "EIGRP dynamic routing", "Routing table & route selection", "Documenting the routed network"],
    labSeed: seed(IOS_RTR, "ISR 4321 — Castle Rysen HQ", "Links to the café and the roastery routers",
      "The static route to the roastery subnet points at the wrong next-hop, and there is no default route toward the ISP",
      "HQ can reach the café but not the roastery, and nothing gets to the internet. Check the routing table — something's pointed the wrong way."),
  },
  {
    id: "s10", camp: "ccna", num: 10, title: "NAT", week: "Weeks 6-7",
    blurb: "How NAT works, Cisco NAT terminology, and configuring static NAT, dynamic NAT, and NAT overload (PAT).",
    lessons: ["How NAT works", "Cisco NAT terminology", "Static NAT", "Dynamic NAT", "NAT overload (PAT)"],
    labSeed: seed(IOS_RTR, "ISR 4321 — internet edge", "WAN Gi0/0/0 to ISP, LAN Gi0/0/1",
      "NAT overload is configured but the inside interface is missing 'ip nat inside', so no translations are built",
      "The whole café lost internet after last night's change window. The ISP link is up, pings from the router work, but no user traffic gets out."),
  },
  {
    id: "s11", camp: "ccna", num: 11, title: "Subnetting", week: "Weeks 7-8",
    blurb: "Binary conversion, Class C/B/A subnetting in three steps, host-based sizing, reverse-engineering masks, and VLSM.",
    lessons: ["What is subnetting?", "Decimal to binary", "Class C in three steps", "Class B and A", "Sizing by host requirements", "Reverse engineering a mask", "VLSM", "Re-addressing Castle Rysen"],
    labSeed: seed(IOS_RTR, "ISR 4321 — HQ", "New VLSM plan rolling out",
      "Two point-to-point links were given overlapping /30s from a bad VLSM worksheet, so OSPF-learned routes flap",
      "Since the re-addressing, the HQ-to-café link keeps flapping routes. I suspect two links got overlapping subnets — verify and fix the addressing."),
  },
  {
    id: "s12", camp: "ccna", num: 12, title: "VLANs & Trunking", week: "Weeks 8-9",
    blurb: "Creating and naming VLANs, trunks, inter-VLAN routing, DTP/VTP hardening, and the native VLAN.",
    lessons: ["Why VLANs", "Creating & naming VLANs", "Trunks", "Routing between VLANs", "Avoiding DTP & VTP", "Native VLAN", "Fallout Shelter network build", "Café VLAN implementation"],
    labSeed: seed(IOS_SW, "Catalyst 2960 — café access", "Trunk to the distribution switch on Gi0/1",
      "The new VOICE VLAN 40 exists on distribution but was never created on this switch and is missing from the trunk's allowed list",
      "The new VoIP phones at the café boot but never register. Data VLAN works fine. Voice VLAN traffic seems to die at this switch."),
  },
  {
    id: "s13", camp: "ccna", num: 13, title: "Spanning Tree Protocol", week: "Weeks 9-10",
    blurb: "Why STP exists, port selection rules, port states, Rapid/Multiple STP, PortFast and BPDU Guard.",
    lessons: ["Why we need STP", "Key STP concepts", "Three rules of port selection", "Port states & configuration", "Rapid & Multiple STP", "PortFast & BPDU Guard", "STP at Castle Rysen"],
    labSeed: seed(IOS_SW, "Catalyst 2960 — shelter core", "Redundant links to two access switches",
      "PortFast is enabled on an uplink port without BPDU Guard, and a looped patch cable is causing intermittent broadcast storms",
      "Every hour or so the shelter network freezes for 30 seconds — MAC flapping messages everywhere. Find the loop and lock STP down properly."),
  },
  {
    id: "s14", camp: "ccna", num: 14, title: "EtherChannel", week: "Week 10",
    blurb: "Bundling links with LACP, tuning load balancing, and deploying EtherChannel at Castle Rysen Coffee.",
    lessons: ["How EtherChannel increases bandwidth", "Configuring LACP", "Tuning load balancing", "EtherChannel at Castle Rysen"],
    labSeed: seed(IOS_SW, "Catalyst 2960 — distribution", "2x Gi uplinks to core meant to be Po1",
      "One side of the LACP bundle is set to 'on' mode while the other runs 'active', so the port-channel never forms",
      "We cabled the second uplink to double the bandwidth but the port-channel shows down and one link sits suspended."),
  },
  {
    id: "s15", camp: "ccna", num: 15, title: "OSPF", week: "Weeks 10-11",
    blurb: "Routing protocol categories, how best paths are chosen, the network command, and implementing/troubleshooting/scaling OSPF.",
    lessons: ["Advantages of routing protocols", "Categories of routing protocols", "Best-path selection", "The network command", "Implementing OSPF", "OSPF troubleshooting", "Scaling OSPF"],
    labSeed: seed(IOS_RTR, "ISR 4321 — fallout grid", "OSPF area 0 with HQ and café neighbors",
      "This router's OSPF network statement uses a wrong wildcard mask, so its LAN never gets advertised and one neighbor is stuck in INIT due to mismatched hello timers",
      "OSPF came up everywhere except this site: neighbors flap between INIT and nothing, and HQ never learns our LAN subnet."),
  },
  {
    id: "s16", camp: "ccna", num: 16, title: "First-Hop Redundancy (HSRP)", week: "Weeks 11-12",
    blurb: "When to use FHRPs, the flavors (HSRP/VRRP/GLBP), and configuring HSRPv2 at Castle Rysen.",
    lessons: ["When to use FHRPs", "Flavors of FHRPs", "Configuring HSRPv2"],
    labSeed: seed(IOS_RTR, "ISR 4321 — HQ gateway pair", "HSRPv2 group 10 with a standby peer",
      "The two HSRP routers are configured with different virtual IPs for the same group, so both go Active and hosts lose their gateway on failover",
      "During last week's failover test half the office lost internet. Both gateway routers claim to be HSRP Active. That can't be right."),
  },
  {
    id: "s17", camp: "ccna", num: 17, title: "IPv6", week: "Week 12",
    blurb: "IPv6 fundamentals, address shortcuts, and configuring the IPv6 overlay at Castle Rysen café and shelter.",
    lessons: ["IPv6, the someday protocol", "Address shortcuts", "IPv6 overlay at the café", "IPv6 at the fallout shelter"],
    labSeed: seed(IOS_RTR, "ISR 4321 — café edge", "Dual-stack rollout in progress",
      "IPv6 unicast routing was never enabled globally, so the configured interface addresses exist but nothing routes",
      "We put IPv6 addresses on every café interface but v6 pings across the router fail. v4 is fine. What did we forget?"),
  },
  {
    id: "s18", camp: "ccna", num: 18, title: "Access Control Lists", week: "Weeks 12-13",
    blurb: "The five common ACL purposes, standard vs extended configuration, and deploying access control at Castle Rysen.",
    lessons: ["Five common ACL purposes", "Standard ACL configuration", "Extended ACL configuration", "Deploying access control"],
    labSeed: seed(IOS_RTR, "ISR 4321 — HQ", "New guest-network ACL applied this morning",
      "A standard ACL applied inbound on the LAN interface ends with an implicit deny and is missing the permit for the ops subnet, blocking the POS servers",
      "Since this morning's 'guest lockdown' change, the tills can't reach the POS servers. Guests are fine — which is the opposite of what we wanted."),
  },
  {
    id: "s19", camp: "ccna", num: 19, title: "Security Fundamentals", week: "Weeks 13-14",
    blurb: "Vulnerabilities, exploits and threats; common attack types; identity and password attacks; Cisco AAA.",
    lessons: ["Vulnerabilities, exploits, threats", "Types of security threats", "Identity & password attacks", "The place of Cisco AAA"],
    labSeed: seed("Windows Server 2022", "Ops jump server", "RADIUS client for network device logins",
      "An attacker's dictionary attack succeeded against a weak local fallback account because AAA fallback was set to a shared local password and lockout was disabled",
      "The audit flagged dozens of failed logins on the jump server followed by a success at 3am from an odd IP. Figure out how they got in and close the hole."),
  },
  {
    id: "s20", camp: "ccna", num: 20, title: "Layer 2 Security", week: "Week 14",
    blurb: "Port security, DHCP snooping, and Dynamic ARP Inspection — hardening Castle Rysen's access layer.",
    lessons: ["Configuring port security", "DHCP snooping", "Dynamic ARP Inspection", "Layer 2 security deployment"],
    labSeed: seed(IOS_SW, "Catalyst 2960 — café access", "Public seating area ports",
      "DHCP snooping is enabled but the uplink to the real DHCP server was never marked trusted, so all leases are being dropped",
      "After we enabled the fancy new security features, nobody in the café can get an IP address anymore. Roll it forward, not back — fix the config."),
  },
  {
    id: "s21", camp: "ccna", num: 21, title: "Discovery Protocols", week: "Weeks 14-15",
    blurb: "Using CDP and LLDP to map the network — and knowing when to switch them off.",
    lessons: ["Cisco Discovery Protocol", "Link Layer Discovery Protocol", "Field discovery safeguards"],
    labSeed: seed(IOS_SW, "Catalyst 2960 — field site", "Undocumented closet, two mystery uplinks",
      "The switch's uplink neighbors are unknown; CDP is disabled globally and must be re-enabled to map the closet, and one neighbor advertises a mismatched native VLAN",
      "We inherited this field-site closet with zero documentation. Map what this switch connects to and flag anything dodgy you find."),
  },
  {
    id: "s22", camp: "ccna", num: 22, title: "IP Services", week: "Week 15",
    blurb: "Cisco clocks and NTP, DNS on devices, DHCP services, and SSH — deploying IP services at Castle Rysen.",
    lessons: ["Setting clocks manually", "NTP", "DNS on Cisco devices", "DHCP services on Cisco devices", "Configuring SSH", "Deploying IP services"],
    labSeed: seed(IOS_RTR, "ISR 4321 — café edge", "Device management hardening pass",
      "The vty lines still allow telnet, SSH fails because no RSA keys were generated and the domain name is missing, and NTP points at a decommissioned server",
      "Security says: SSH-only management and correct clocks on every device by Friday. This router still telnets and its clock is off by hours."),
  },
  {
    id: "s23", camp: "ccna", num: 23, title: "SNMP & Syslog", week: "Week 16",
    blurb: "What SNMP is, configuring SNMPv2c and SNMPv3, and understanding and configuring syslog.",
    lessons: ["What is SNMP?", "SNMPv2c and SNMPv3", "Understanding & configuring syslog"],
    labSeed: seed(IOS_SW, "Catalyst 2960 — shelter core", "Telemetry rollout to the new NMS",
      "Syslog is only logging to the console at severity errors, and SNMP uses the old community string the NMS no longer accepts",
      "The new monitoring server shows this switch as a grey box — no metrics, no logs. Wire its telemetry up to 10.50.1.20 properly."),
  },
  {
    id: "s24", camp: "ccna", num: 24, title: "Quality of Service", week: "Week 16",
    blurb: "QoS concepts, classification and marking, and treatment methods: queuing, shaping, policing.",
    lessons: ["QoS concepts", "Classification & marking", "Queuing, shaping, policing"],
    labSeed: seed(IOS_RTR, "ISR 4321 — café edge", "VoIP rollout with a 50Mb uplink",
      "Voice traffic is being marked but the service-policy was applied to the wrong interface, so calls break up whenever backups run",
      "Café calls sound like robots every night at 8pm when the cloud backup kicks off. The QoS policy is 'applied' — allegedly."),
  },
  {
    id: "s25", camp: "ccna", num: 25, title: "Wireless", week: "Week 17",
    blurb: "How wireless works, channel planning, WAP association, and wireless security.",
    lessons: ["How wireless works", "Planning channels", "Selecting & associating with WAPs", "Wireless security"],
    labSeed: seed("Windows 11", "Barista laptop", "Café Wi-Fi with three ceiling APs",
      "Two neighboring APs are on overlapping 2.4GHz channels (1 and 3), causing co-channel interference near the espresso bar",
      "Wi-Fi by the espresso bar is unusable at rush hour but fine at the windows. The APs all show 'up'. Something about channels?"),
  },
  {
    id: "s26", camp: "ccna", num: 26, title: "Automation & SDN", week: "Week 17",
    blurb: "Network automation and SDN, Cisco SDN platforms, RESTful APIs, and a glance at Ansible, Puppet, Chef.",
    lessons: ["Network automation & SDN", "Cisco SDN models & platforms", "RESTful APIs", "Ansible, Puppet, Chef & markup"],
    labSeed: seed("Ubuntu 22.04", "Automation jump host", "Ansible controller for network configs",
      "The Ansible playbook fails because the inventory file has a wrong ansible_network_os and SSH host-key checking blocks the first connection",
      "My first playbook to backup the switch configs dies instantly with a connection error. The switches are reachable — it's something on this controller."),
  },
];

function seedAs(name: string, department: string, os: string, device: string, detail: string, rootCause: string, openingMessage: string): ScenarioSeed {
  return { category: "network", persona: { name, department }, environment: { os, device, detail }, rootCause, openingMessage };
}

const CCNP_SKILLS: BootcampSkill[] = [
  { id: "ccnp-00", camp: "ccnp", num: 0, title: "Enterprise Architecture", week: "Week 1",
    blurb: "Campus designs, SD-Access and SD-WAN concepts, on-prem vs cloud, and high-availability building blocks.",
    lessons: ["Two-tier and three-tier campus design", "SD-Access & SD-WAN concepts", "On-prem vs cloud deployment", "FHRP & redundancy building blocks"],
    labSeed: seed(IOS_RTR, "ISR 4451 — HQ core", "Dual-core design mid-migration",
      "An interface tracking object for the WAN uplink was deleted, so the HSRP priority never decrements and traffic blackholes on WAN failure",
      "Our failover test blackholed traffic for 4 minutes: the standby core never took over when we pulled the WAN cable.") },
  { id: "ccnp-01", camp: "ccnp", num: 1, title: "Advanced Spanning Tree & L2", week: "Week 2",
    blurb: "RSTP/MST tuning, root guard, loop guard, UDLD, and taming large L2 domains.",
    lessons: ["RSTP & MST deep dive", "Root guard vs BPDU guard vs loop guard", "UDLD", "Designing stable L2 domains"],
    labSeed: seed(IOS_SW, "Catalyst 9300 — distribution", "MST region with two instances",
      "One switch has a different MST region name, splitting the region and forcing an unexpected root for instance 1",
      "Since adding the new distribution switch, VLAN 30 traffic hairpins across a slow link. MST looks 'up' but the topology is wrong.") },
  { id: "ccnp-02", camp: "ccnp", num: 2, title: "OSPF at Scale", week: "Weeks 3-4",
    blurb: "Multi-area OSPF, LSA types, stub/NSSA areas, summarization, and filtering.",
    lessons: ["Multi-area design & LSA types", "Stub, totally stubby, NSSA", "Summarization", "LSA filtering & tuning"],
    labSeed: seed(IOS_RTR, "ISR 4451 — area border router", "Areas 0, 10 (NSSA) and 20",
      "The NSSA ABR is missing the 'area 10 nssa default-information-originate' so area 10 sites lost internet when the legacy area was removed",
      "Branch sites in area 10 can reach HQ but not the internet since the cleanup. Their routing tables have no default route anymore.") },
  { id: "ccnp-03", camp: "ccnp", num: 3, title: "EIGRP Advanced", week: "Week 4",
    blurb: "DUAL internals, variance, stub routing, summarization and authentication.",
    lessons: ["DUAL & feasible successors", "Variance and unequal-cost load balancing", "EIGRP stub", "Summarization & authentication"],
    labSeed: seed(IOS_RTR, "ISR 4451 — regional hub", "EIGRP AS 100 hub-and-spoke",
      "A spoke marked as EIGRP stub 'receive-only' stopped advertising its LAN, and MD5 keys mismatch on one neighbor",
      "After hardening, one branch vanished from the routing table entirely and another neighbor keeps flapping with auth errors.") },
  { id: "ccnp-04", camp: "ccnp", num: 4, title: "BGP Fundamentals", week: "Weeks 5-6",
    blurb: "eBGP/iBGP, path attributes and best-path selection, communities, and basic policy.",
    lessons: ["eBGP vs iBGP", "Best-path selection attributes", "Local preference, MED, AS-path prepending", "Route filtering & communities"],
    labSeed: seed(IOS_RTR, "ISR 4451 — internet edge", "Dual-homed to two ISPs",
      "An inbound route-map on ISP-B sets local-preference 200 for all routes, dragging all outbound traffic onto the backup 100Mb circuit",
      "Everything egresses through our skinny backup ISP and the primary gig circuit sits idle. Started after the last policy change.") },
  { id: "ccnp-05", camp: "ccnp", num: 5, title: "Route Redistribution & Path Control", week: "Week 7",
    blurb: "Redistributing between protocols safely, tags, distribute lists, and PBR.",
    lessons: ["Redistribution pitfalls & loops", "Route tags", "Distribute/prefix lists", "Policy-based routing"],
    labSeed: seed(IOS_RTR, "ISR 4451 — merger router", "OSPF ↔ EIGRP mutual redistribution",
      "Mutual redistribution without route tags created a routing loop for two acquired-company subnets",
      "Since the merger cutover, two subnets ping-pong between sites with TTL expired errors. Classic loop symptoms.") },
  { id: "ccnp-06", camp: "ccnp", num: 6, title: "First-Hop & WAN Redundancy", week: "Week 8",
    blurb: "HSRP/VRRP/GLBP tuning, object tracking, and IP SLA-driven failover.",
    lessons: ["HSRP/VRRP/GLBP compared", "Object tracking", "IP SLA probes", "Failover design patterns"],
    labSeed: seed(IOS_RTR, "ISR 4451 — branch pair", "IP SLA tracks the MPLS next hop",
      "The IP SLA probe targets a decommissioned IP so the track is always down and the floating static route to the backup VPN is permanently active",
      "The branch has been riding its slow backup VPN for a week even though MPLS is healthy. Failback never happens.") },
  { id: "ccnp-07", camp: "ccnp", num: 7, title: "Multicast & QoS", week: "Week 9",
    blurb: "IGMP and PIM basics, QoS models, classification, queuing and policing in the enterprise.",
    lessons: ["IGMP & PIM sparse mode", "RP basics", "QoS models & trust boundaries", "Queuing, shaping, policing"],
    labSeed: seed(IOS_SW, "Catalyst 9300 — access", "Company all-hands video multicast",
      "IGMP snooping querier is missing on the video VLAN so multicast floods for 10 minutes then dies when the CAM entries age",
      "The CEO's all-hands stream works for the first minutes then freezes for everyone on the 3rd floor. Every. Single. Time.") },
  { id: "ccnp-08", camp: "ccnp", num: 8, title: "Enterprise Wireless", week: "Week 10",
    blurb: "WLC concepts, AP join process, roaming, RF fundamentals, and wireless security for the enterprise.",
    lessons: ["WLC & AP join process", "Roaming types", "RF fundamentals & channel design", "WPA2/WPA3-Enterprise"],
    labSeed: seedAs("Amara Diallo", "Facilities", "Cisco WLC 9800 CLI", "Wireless LAN Controller", "40 APs across the campus",
      "The new APs sit in downloading/join loop because the WLC's cert clock is wrong and DHCP option 43 points at the old controller",
      "The 12 new APs never come online — they join, download, reboot, repeat. The old APs are fine.") },
  { id: "ccnp-09", camp: "ccnp", num: 9, title: "Network Services & Security", week: "Week 11",
    blurb: "AAA with TACACS+/RADIUS, CoPP, device hardening, and secure management planes.",
    lessons: ["TACACS+ vs RADIUS", "AAA method lists", "Control-plane policing", "Management-plane hardening"],
    labSeed: seed(IOS_RTR, "ISR 4451 — HQ", "TACACS+ against the new ISE node",
      "The AAA method list falls back to a local account that was deleted, so when TACACS+ times out admins get locked out entirely",
      "During the ISE outage yesterday nobody could SSH into the core. That fallback was supposed to save us — it didn't.") },
  { id: "ccnp-10", camp: "ccnp", num: 10, title: "Virtualization & Overlay", week: "Week 12",
    blurb: "VRFs, GRE and IPsec tunnels, VXLAN/LISP concepts behind the SD fabrics.",
    lessons: ["VRF-lite", "GRE & IPsec tunnels", "VXLAN concepts", "LISP at a glance"],
    labSeed: seed(IOS_RTR, "ISR 4451 — shared services", "VRF GUEST and VRF CORP",
      "A static route for the guest VRF was configured in the global table, so guest traffic leaks into the corporate VRF",
      "The auditors flagged guest-network devices reaching an internal corporate subnet. VRFs were supposed to make that impossible.") },
  { id: "ccnp-11", camp: "ccnp", num: 11, title: "Automation & Assurance", week: "Week 12",
    blurb: "NETCONF/RESTCONF, model-driven telemetry, and Python/Ansible workflows for the enterprise.",
    lessons: ["NETCONF & RESTCONF", "YANG models", "Model-driven telemetry", "Ansible for IOS-XE"],
    labSeed: seedAs("Devon Park", "NetOps", "Ubuntu 22.04", "Automation controller", "Ansible + RESTCONF against IOS-XE",
      "RESTCONF calls fail with 403 because the ansible service account lost privilege 15 and the router's HTTPS server allows only a stale ACL",
      "Our nightly compliance playbook suddenly 403s on every router. Creds unchanged — something on the routers or this box.") },
];

const SECPLUS_SKILLS: BootcampSkill[] = [
  { id: "sec-00", camp: "secplus", num: 0, title: "Security Concepts & Controls", week: "Week 1",
    blurb: "CIA triad, control categories and types, zero trust, and gap analysis.",
    lessons: ["CIA triad & non-repudiation", "Control categories: managerial/operational/technical/physical", "Control types: preventive → compensating", "Zero trust concepts"],
    labSeed: seedAs("Nia Okafor", "Security Office", "Windows Server 2022", "GRC file server", "Contains the controls register",
      "NTFS permissions on the controls register share grant Everyone:Modify — a classic technical-control gap an intern introduced",
      "The audit prep found our controls register can be edited by literally anyone in the company. Find and fix the permission hole.") },
  { id: "sec-01", camp: "secplus", num: 1, title: "Threat Actors & Social Engineering", week: "Week 2",
    blurb: "Actor types and motivations, phishing and its cousins, and human-factor defenses.",
    lessons: ["Threat actors & motivations", "Phishing, vishing, smishing, BEC", "Impersonation & pretexting", "Awareness as a control"],
    labSeed: seedAs("Tomás Rivera", "Finance", "Windows 11", "Finance workstation", "Received a 'CEO' wire-transfer email",
      "A BEC email spoofed the CEO via a lookalike domain; the mail client shows the display name only, and a malicious inbox rule now forwards invoices externally",
      "Our CFO nearly wired $40k after a 'CEO' email. Check my machine and mailbox — something feels off since I clicked that link.") },
  { id: "sec-02", camp: "secplus", num: 2, title: "Malware & Attack Types", week: "Week 3",
    blurb: "Malware families, password attacks, injection, XSS, and indicators of compromise.",
    lessons: ["Malware families & behaviors", "Password attacks", "Injection & XSS at a glance", "Recognizing IoCs"],
    labSeed: seedAs("Priya Sharma", "Marketing", "Windows 11", "Marketing laptop", "Ran a 'font pack' installer",
      "A cryptominer persists via a scheduled task and a Run-key entry, throttling CPU when Task Manager opens",
      "My laptop's fans scream and the battery dies in an hour, but Task Manager shows nothing unusual. It started after I installed a font pack.") },
  { id: "sec-03", camp: "secplus", num: 3, title: "Cryptography", week: "Week 4",
    blurb: "Symmetric vs asymmetric, hashing, PKI, certificates, and TLS in practice.",
    lessons: ["Symmetric vs asymmetric", "Hashing & digital signatures", "PKI & certificate lifecycle", "TLS handshakes in practice"],
    labSeed: seedAs("Lena Fischer", "Web Ops", "Ubuntu 22.04", "Web server", "nginx serving the customer portal",
      "The portal serves an expired intermediate certificate — the leaf is valid but the chain in nginx's bundle is stale",
      "Customers report certificate warnings on some browsers but not others. Our leaf cert says it's valid until next year. Untangle the chain.") },
  { id: "sec-04", camp: "secplus", num: 4, title: "Identity & Access Management", week: "Week 5",
    blurb: "AAA, MFA factors, SSO/federation, privileged access, and account lifecycle.",
    lessons: ["Authentication factors & MFA", "SSO, SAML, OAuth at a glance", "Least privilege & PAM", "Provisioning & deprovisioning"],
    labSeed: seedAs("Marcus Webb", "IT Ops", "Windows Server 2022", "Domain controller", "AD DS for 300 users",
      "A terminated contractor's account is still enabled and a member of Domain Admins via a nested group nobody documented",
      "HR says a contractor left three weeks ago. The SIEM saw their account authenticate yesterday. Find the account and the nesting that gave it power.") },
  { id: "sec-05", camp: "secplus", num: 5, title: "Network Security", week: "Weeks 6-7",
    blurb: "Segmentation, firewalls, IDS/IPS, VPNs, and secure protocols over their insecure ancestors.",
    lessons: ["Segmentation & zones", "Firewall types & rules", "IDS vs IPS", "VPNs & secure protocol swaps"],
    labSeed: seedAs("Sofia Marino", "IT Ops", "Ubuntu 22.04", "Bastion host", "iptables + sshd for admin access",
      "sshd still permits password auth and protocol-level weak MACs, and an iptables rule exposes 0.0.0.0/0 on port 22 instead of the admin subnet",
      "Pen testers got SSH password prompts on our bastion from the guest Wi-Fi. That box was supposed to be key-only from the admin VLAN.") },
  { id: "sec-06", camp: "secplus", num: 6, title: "Endpoint & Application Hardening", week: "Week 8",
    blurb: "Baselines, patching, EDR, application allow-listing, and secure configuration.",
    lessons: ["Hardening baselines", "Patch management", "EDR & allow-listing", "Secure app configuration"],
    labSeed: seedAs("Jae-won Kim", "IT Ops", "Windows 11", "Kiosk PC", "Public lobby kiosk",
      "The kiosk runs as local admin with AutoPlay enabled and SMBv1 turned on — three baseline violations from the CIS profile",
      "Harden the lobby kiosk before Thursday's assessment: it should match our baseline, and right now it very much does not.") },
  { id: "sec-07", camp: "secplus", num: 7, title: "Vulnerability Management", week: "Week 9",
    blurb: "Scanning, CVSS, prioritization, false positives, and remediation workflow.",
    lessons: ["Scan types & credentialed scans", "CVSS & prioritization", "False positives", "Remediation & exceptions"],
    labSeed: seedAs("Elena Vasquez", "Security Office", "Ubuntu 22.04", "Internal web app server", "Flagged critical by the scanner",
      "The scanner flagged CVE-critical Apache — the package is patched via backport, but an actually exploitable outdated PHP module is buried lower in the report",
      "The scan says this box has a critical Apache hole; the sysadmin swears it's patched. Someone is right and someone is missing the real problem.") },
  { id: "sec-08", camp: "secplus", num: 8, title: "Monitoring & SIEM", week: "Week 10",
    blurb: "Log sources, SIEM correlation, alert triage and tuning.",
    lessons: ["Log sources that matter", "SIEM correlation basics", "Triage workflow", "Tuning out noise"],
    labSeed: seedAs("Omar Haddad", "SOC", "Ubuntu 22.04", "Syslog collector", "rsyslog feeding the SIEM",
      "rsyslog's disk queue filled the /var partition, so the collector silently dropped four hours of logs including a brute-force window",
      "The SIEM has a four-hour hole last night — right when someone was password-spraying us. The collector 'looks fine'. It isn't.") },
  { id: "sec-09", camp: "secplus", num: 9, title: "Incident Response & Forensics", week: "Week 11",
    blurb: "IR lifecycle, containment choices, evidence handling and chain of custody.",
    lessons: ["IR lifecycle", "Containment strategies", "Evidence & chain of custody", "Lessons learned"],
    labSeed: seedAs("Dana Whitfield", "SOC", "Windows Server 2022", "Compromised file server", "Isolated from the network for IR",
      "A webshell in an IIS upload directory plus a rogue local admin account are the artifacts to find, document and remove",
      "This server was isolated after odd outbound traffic. Work the incident: find how they got in, what persistence they left, and clean it — documenting as you go.") },
  { id: "sec-10", camp: "secplus", num: 10, title: "Resilience & Recovery", week: "Week 12",
    blurb: "Backups, RAID and redundancy, DR sites, RTO/RPO, and testing recovery.",
    lessons: ["Backup types & 3-2-1", "RAID & redundancy", "DR site types", "RTO/RPO & recovery testing"],
    labSeed: seedAs("Ivan Petrov", "IT Ops", "Windows Server 2022", "Backup server", "Nightly jobs to disk + cloud",
      "Nightly backups have silently failed for 9 days: the job's service account password expired and the alert email goes to a dead distribution list",
      "Ransomware tabletop exercise question one: 'when was the last good backup?' Nobody knows. Find out and fix whatever broke.") },
  { id: "sec-11", camp: "secplus", num: 11, title: "Governance, Risk & Compliance", week: "Week 12",
    blurb: "Policies and standards, risk register, third-party risk, and privacy basics.",
    lessons: ["Policies, standards, procedures", "Risk assessment & register", "Third-party risk", "Privacy & data roles"],
    labSeed: seedAs("Grace Lin", "Compliance", "Windows 11", "Compliance workstation", "Prepping the annual assessment",
      "The data-retention script deletes logs after 30 days while policy requires 365 — a control/policy mismatch visible in the script's config",
      "The assessor will ask for a year of logs. I have a bad feeling we only keep a month. Confirm what the systems actually do versus the policy.") },
];

const NETPLUS_SKILLS: BootcampSkill[] = [
  { id: "net-00", camp: "netplus", num: 0, title: "Models & Appliances", week: "Week 1",
    blurb: "OSI in practice, network appliances and their placement.",
    lessons: ["OSI layer by layer", "Appliances: router, switch, firewall, LB, proxy", "Where each device lives"],
    labSeed: seedAs("Ben Carter", "Small Biz IT", "Windows 11", "Office PC", "Sits behind router + switch + AP",
      "The PC's traffic dies at layer 3: someone set a /32 subnet mask during 'troubleshooting'",
      "This PC pings itself fine but literally nothing else. Link light is on. I'm out of ideas.") },
  { id: "net-01", camp: "netplus", num: 1, title: "Cabling & Connectors", week: "Week 2",
    blurb: "Copper and fiber media, connectors, transceivers, and physical-layer troubleshooting.",
    lessons: ["Copper categories & limits", "Fiber types & connectors", "Transceivers & mismatches", "Testing tools"],
    labSeed: seed(IOS_SW, "Catalyst 2960 — office IDF", "New 90m run to the warehouse desk",
      "The new drop is ~112m of Cat5e with a coupler in the ceiling — past spec, causing CRC errors and 10Mb negotiation",
      "The warehouse desk connects at 10Mb with constant errors. The electrician swears the new cable run is 'fine'.") },
  { id: "net-02", camp: "netplus", num: 2, title: "IP Addressing & Subnetting", week: "Weeks 3-4",
    blurb: "IPv4/IPv6 addressing, subnetting, APIPA, and address planning.",
    lessons: ["IPv4 structure & classes", "Subnetting practice", "IPv6 basics", "DHCP vs static planning"],
    labSeed: seedAs("Ben Carter", "Small Biz IT", "Windows Server 2022", "DHCP server", "Serves three VLAN scopes",
      "The new scope's exclusion range covers the entire pool, so DHCP has zero leases to offer on VLAN 30",
      "Everything on the new VLAN self-assigns 169.254 addresses. The DHCP service is running and the scope shows 'active'.") },
  { id: "net-03", camp: "netplus", num: 3, title: "Routing & Switching Essentials", week: "Weeks 4-5",
    blurb: "Static and dynamic routing basics, VLANs, trunking, and STP awareness.",
    lessons: ["Static vs dynamic routing", "VLANs & trunks", "STP awareness", "NAT overview"],
    labSeed: seed(IOS_SW, "Catalyst 2960 — office", "Two VLANs, router-on-a-stick",
      "The trunk to the router strips VLAN 20 because 'switchport trunk allowed vlan 10' replaced the list instead of adding",
      "Accounting (VLAN 20) lost everything after we 'added' a VLAN to the trunk yesterday. Sales is fine.") },
  { id: "net-04", camp: "netplus", num: 4, title: "Wireless Networking", week: "Week 6",
    blurb: "Standards, frequencies, channels, SSIDs and wireless security options.",
    lessons: ["802.11 standards & bands", "Channels & interference", "SSID & roaming basics", "WPA2/WPA3 options"],
    labSeed: seedAs("Ben Carter", "Small Biz IT", "Windows 11", "Reception laptop", "Connects to OFFICE-WIFI",
      "The AP nearest reception reverted to WEP+hidden SSID after a factory reset, so modern clients silently refuse it and roam to the far AP",
      "Wi-Fi at reception is awful but great everywhere else. The AP right above the desk looks powered and 'working'.") },
  { id: "net-05", camp: "netplus", num: 5, title: "Network Services", week: "Week 7",
    blurb: "DHCP, DNS, NTP and how their failures actually look.",
    lessons: ["DHCP deep dive", "DNS records & resolution", "NTP & time sync", "Service dependency chains"],
    labSeed: seedAs("Ben Carter", "Small Biz IT", "Windows Server 2022", "DNS server", "AD-integrated DNS",
      "A stale A record and a broken conditional forwarder send intranet traffic to a decommissioned IP",
      "The intranet 'is down' — except it isn't; the web team says the server is fine and half the office can reach it by IP.") },
  { id: "net-06", camp: "netplus", num: 6, title: "Cloud & Virtualization Basics", week: "Week 8",
    blurb: "VMs, hypervisors, cloud service and deployment models, and connecting to them.",
    lessons: ["Hypervisors & VMs", "IaaS/PaaS/SaaS", "Public/private/hybrid", "VPNs to the cloud"],
    labSeed: seedAs("Ben Carter", "Small Biz IT", "Ubuntu 22.04", "On-prem VPN gateway", "Site-to-site to the cloud VPC",
      "The IPsec tunnel is up but a missing route for the new cloud subnet means only the old subnet is reachable",
      "We added a second subnet in the cloud and nobody on-prem can reach it. The old subnet works and the tunnel says 'connected'.") },
  { id: "net-07", camp: "netplus", num: 7, title: "Network Security Basics", week: "Week 9",
    blurb: "CIA, common attacks, hardening, ACLs and defense in depth for small networks.",
    lessons: ["CIA & common attacks", "Device hardening", "ACL basics", "Defense in depth"],
    labSeed: seed(IOS_RTR, "Office edge router", "Public IP with remote-work port forwards",
      "Telnet and HTTP management are exposed on the WAN interface alongside an any-any RDP forward to the bookkeeper's PC",
      "Our cyber-insurance scan failed us spectacularly. Close down whatever the router is exposing to the whole internet.") },
  { id: "net-08", camp: "netplus", num: 8, title: "Monitoring & Documentation", week: "Week 10",
    blurb: "SNMP, syslog, baselines, and the documentation that saves 3am calls.",
    lessons: ["SNMP & syslog", "Baselines & alerts", "Diagrams & docs", "Change management lite"],
    labSeed: seed(IOS_SW, "Catalyst 2960 — office", "Monitored by LibreNMS",
      "SNMP community changed during hardening but LibreNMS still polls the old string; interface alerts silently stopped",
      "The monitoring dashboard has shown this switch 'green, no data' for two weeks. That's not green, that's blind.") },
  { id: "net-09", camp: "netplus", num: 9, title: "Troubleshooting Methodology", week: "Week 10",
    blurb: "The N+ troubleshooting method applied end-to-end on messy, multi-cause problems.",
    lessons: ["The 7-step method", "Divide and conquer: layers", "Escalation & documentation", "Capstone practice"],
    labSeed: seedAs("Ben Carter", "Small Biz IT", "Windows 11", "Owner's PC", "The 'everything is broken' ticket",
      "Three stacked faults: wrong DNS server statically set, a half-duplex NIC forced, and a proxy left over from a security trial",
      "The owner's PC is 'slow, weird, and half the internet doesn't load'. Everyone else is fine. Take it step by step and fix all of it.") },
];

const APLUS_SKILLS: BootcampSkill[] = [
  { id: "ap-00", camp: "aplus", num: 0, title: "PC Hardware", week: "Week 1",
    blurb: "Motherboards, CPUs, RAM, storage, power — and what failure looks like for each.",
    lessons: ["Motherboards & CPUs", "RAM types & channels", "Storage: HDD/SSD/NVMe", "PSUs & POST codes"],
    labSeed: seedAs("Rosa Mendez", "Front Desk", "Windows 11", "Desktop PC", "Random freezes reported",
      "One of two RAM sticks is failing — event logs show WHEA memory errors and the system crashes under load",
      "My PC freezes a few times a day, usually when I have lots of tabs open. IT already 'reinstalled everything' once.") },
  { id: "ap-01", camp: "aplus", num: 1, title: "Storage & File Systems", week: "Week 2",
    blurb: "Partitions, file systems, disk health, SMART, and recovering from disk problems.",
    lessons: ["Partitions & file systems", "SMART & disk health", "Disk management tools", "Backup basics"],
    labSeed: seedAs("Hank Miller", "Warehouse", "Windows 11", "Shared warehouse PC", "C: drive nearly full",
      "The disk is 99% full from an old user profile and a runaway log folder; SMART also shows pending sector warnings worth flagging",
      "This PC takes ten minutes to boot and yells about disk space nonstop. Can you clean it up and tell me if the drive is dying?") },
  { id: "ap-02", camp: "aplus", num: 2, title: "Mobile Devices & Laptops", week: "Week 3",
    blurb: "Laptop components, displays, batteries, and mobile device management basics.",
    lessons: ["Laptop internals", "Displays & inverters", "Batteries & charging", "MDM basics"],
    labSeed: seedAs("Yuki Tanaka", "Sales", "Windows 11", "Sales laptop", "Battery drains overnight",
      "Fast startup plus a stuck 'modern standby' app keeps the laptop awake in the bag; powercfg reports the culprit",
      "My laptop is dead every morning even though I shut the lid at 100%. It's also warm when I take it out of the bag. Spooky.") },
  { id: "ap-03", camp: "aplus", num: 3, title: "Operating Systems", week: "Weeks 4-5",
    blurb: "Windows editions and tools, basic Linux/macOS awareness, user profiles and services.",
    lessons: ["Windows editions & tools", "Services & startup", "User profiles", "Linux/macOS basics"],
    labSeed: seedAs("Aaron Blake", "HR", "Windows 11", "HR workstation", "Login takes five minutes",
      "A corrupt roaming profile plus a startup app pointing at an unreachable network share stall every login",
      "Logging in takes forever — the circle just spins. Once I'm in, everything's fine. Started after the file-server migration.") },
  { id: "ap-04", camp: "aplus", num: 4, title: "Networking for Technicians", week: "Week 6",
    blurb: "TCP/IP config, common ports, Wi-Fi setup, and SOHO router configuration.",
    lessons: ["TCP/IP config & tools", "Common ports", "SOHO router setup", "Wi-Fi troubleshooting"],
    labSeed: seedAs("Rosa Mendez", "Front Desk", "Windows 11", "Front desk PC", "Can't reach the label printer",
      "The PC's static IP collides with the label printer's address — intermittent connectivity for both, visible via arp",
      "The shipping label printer works, then vanishes, then works. Sometimes my PC drops off too. It's haunted, obviously.") },
  { id: "ap-05", camp: "aplus", num: 5, title: "Virtualization & Cloud Basics", week: "Week 7",
    blurb: "Client-side virtualization, VMs for testing, and cloud concepts a tech must know.",
    lessons: ["Client hypervisors", "VM resource planning", "Cloud models for techs", "Sync & storage apps"],
    labSeed: seedAs("Devon Park", "IT Intern", "Windows 11", "Test bench PC", "VirtualBox lab machine",
      "Virtualization is disabled in UEFI and Hyper-V holds VT-x, so the intern's VMs crash with VERR_VMX errors",
      "My study VMs won't start — some VT-x error. The PC is brand new and 'should' support all this.") },
  { id: "ap-06", camp: "aplus", num: 6, title: "Security for Technicians", week: "Week 8",
    blurb: "Malware removal, Windows security settings, physical security, and safe disposal.",
    lessons: ["Malware removal steps", "Windows security settings", "Physical security", "Data disposal"],
    labSeed: seedAs("Priya Sharma", "Marketing", "Windows 11", "Marketing PC", "Browser 'acting possessed'",
      "A malicious browser extension plus a hijacked hosts file redirect search traffic; removal must follow the malware-removal order",
      "Every search takes me somewhere weird and there are popups for antivirus software I never installed. Fix it and tell me what I did wrong.") },
  { id: "ap-07", camp: "aplus", num: 7, title: "Windows Troubleshooting", week: "Week 9",
    blurb: "Boot problems, blue screens, update failures, and the recovery toolchain.",
    lessons: ["Boot process & repair", "BSOD analysis", "Update troubleshooting", "System restore & reset"],
    labSeed: seedAs("Hank Miller", "Warehouse", "Windows 11", "Warehouse PC", "Boot loops after an update",
      "A failed update left a pending.xml stuck: the fix is running the update troubleshooter steps / DISM + SFC from safe mode",
      "This PC restarts, says 'undoing changes', and loops forever. We need it working before the morning shift.") },
  { id: "ap-08", camp: "aplus", num: 8, title: "Printers & Peripherals", week: "Week 10",
    blurb: "Printer technologies, drivers, queues, and the eternal war with paper.",
    lessons: ["Laser vs inkjet vs thermal", "Drivers & queues", "Network printing", "Scanners & peripherals"],
    labSeed: seedAs("Rosa Mendez", "Front Desk", "Windows 11", "Front desk PC", "Office laser printer troubles",
      "The print spooler is jammed by a corrupt job and the driver was swapped to a wrong PCL version during 'fixing'",
      "Nothing prints, the queue shows a job from Tuesday that won't delete, and now everything comes out as hieroglyphics when it does print.") },
  { id: "ap-09", camp: "aplus", num: 9, title: "Operational Procedures", week: "Week 10",
    blurb: "Ticketing done right, documentation, change control, safety and professionalism.",
    lessons: ["Ticket hygiene & notes", "Documentation", "Change control lite", "Safety & professionalism"],
    labSeed: seedAs("Aaron Blake", "HR", "Windows 11", "HR workstation", "Follow-the-runbook exercise",
      "The previous tech's 'fix' disabled the antivirus service and left a scheduled reboot at noon — undocumented changes to find and revert",
      "Whatever the last tech did 'fixed' my issue but now the PC reboots at lunch and the security tool icon is gone. Untangle their mess — and document properly this time.") },
];

export const ALL_BOOTCAMP_SKILLS: BootcampSkill[] = [
  ...BOOTCAMP_SKILLS,
  ...CCNP_SKILLS,
  ...SECPLUS_SKILLS,
  ...NETPLUS_SKILLS,
  ...APLUS_SKILLS,
];

export function skillsForBootcamp(camp: string): BootcampSkill[] {
  return ALL_BOOTCAMP_SKILLS.filter((s) => s.camp === camp);
}

export function getBootcampSkill(id: string): BootcampSkill | undefined {
  return ALL_BOOTCAMP_SKILLS.find((s) => s.id === id);
}

export function isBootcampSkillId(value: unknown): value is string {
  return typeof value === "string" && ALL_BOOTCAMP_SKILLS.some((s) => s.id === value);
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
  const camp = getBootcamp(skill.camp);
  const certName = camp?.certName ?? "certification";
  const storyLine = skill.camp === "ccna" ? ' Tie examples back to the Castle Rysen Coffee storyline ("Summer of CCNA").' : "";
  const system = `You are writing one chapter of a ${certName} bootcamp for an IT trainee.
Chapter: Skill ${String(skill.num).padStart(2, "0")} — ${skill.title}. Scope: ${skill.blurb}
Topics to cover, in order: ${skill.lessons.join("; ")}.
Write:
- "lesson": a 400-600 word lesson in plain text (short paragraphs, no markdown headers) that teaches these topics with concrete, exam-relevant examples (CLI commands, tool output, or real workflows where they fit).${storyLine}
- "quiz": 5 multiple-choice questions on this chapter, ${certName} exam style, exactly 4 choices each, one correct.
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
