import type { ScenarioSeed } from "./types";

// Hand-written scenario bank served when the AI provider is unavailable
// (rate limit, missing key, malformed output). Root causes stay hidden from
// the trainee exactly like AI-generated ones.
export const FALLBACK_SEEDS: ScenarioSeed[] = [
  {
    category: "network",
    persona: { name: "Priya Nair", department: "Sales" },
    environment: { os: "Windows 11 23H2", device: "Dell Latitude 5440", detail: "Corporate Wi-Fi + GlobalProtect VPN" },
    rootCause: "Wi-Fi NIC power management turns the adapter off after sleep, dropping VPN until reboot",
    openingMessage:
      "Every time my laptop wakes up from sleep the internet is just gone. Restarting fixes it but I lose ten minutes every meeting. It started sometime last week.",
  },
  {
    category: "network",
    persona: { name: "Tomás Rivera", department: "Legal" },
    environment: { os: "Windows 10 22H2", device: "HP EliteBook 840 + USB-C dock", detail: "Wired Ethernet through dock" },
    rootCause: "Manually configured DNS server (old office decommissioned) breaks name resolution on the wired connection",
    openingMessage:
      "When I plug into the dock at my desk, web pages won't load, but Wi-Fi works fine. Teams says I'm online but nothing opens in the browser.",
  },
  {
    category: "printer",
    persona: { name: "Janet Osei", department: "Finance" },
    environment: { os: "Windows 11", device: "Lenovo ThinkPad T14", detail: "Shared HP LaserJet M479 on print server" },
    rootCause: "Stale printer driver after Windows update prints only blank pages until driver is reinstalled",
    openingMessage:
      "The big printer near finance just spits out blank pages when I print, but my coworker's printouts come out fine. It worked for me on Friday.",
  },
  {
    category: "printer",
    persona: { name: "Marcus Feld", department: "Operations" },
    environment: { os: "Windows 10", device: "Desktop OptiPlex 7090", detail: "Local USB Brother HL-L2350" },
    rootCause: "Corrupt job stuck at the head of the queue crash-loops the print spooler service",
    openingMessage:
      "Nothing will print at all and the little printer icon shows nine documents waiting. Cancelling them does nothing, they just sit there forever.",
  },
  {
    category: "password",
    persona: { name: "Sofia Marino", department: "Marketing" },
    environment: { os: "Windows 11", device: "Surface Laptop 5", detail: "AD account + iPhone with company mail profile" },
    rootCause: "Old password saved in the phone's mail profile keeps retrying and locks the AD account every few minutes",
    openingMessage:
      "My account keeps getting locked over and over, even right after IT unlocks it. I changed my password yesterday like the reminder said and it's been chaos since.",
  },
  {
    category: "password",
    persona: { name: "Dev Patel", department: "Engineering" },
    environment: { os: "macOS 14", device: "MacBook Pro 14", detail: "Okta MFA with Authenticator app" },
    rootCause: "MFA authenticator app was not migrated to the user's new phone, so no valid second factor exists",
    openingMessage:
      "I got a new phone over the weekend and now I can't log into anything — it keeps asking for a code from an app I don't have anymore.",
  },
  {
    category: "app-crash",
    persona: { name: "Helen Zhao", department: "Accounting" },
    environment: { os: "Windows 11", device: "ThinkCentre desktop", detail: "Microsoft 365 Apps, Excel with legacy add-ins" },
    rootCause: "A faulty third-party COM add-in crashes Excel on startup; starting in safe mode works",
    openingMessage:
      "Excel closes itself the moment I open it, every single time. Word and Outlook are fine. I have month-end close this week so I'm getting nervous.",
  },
  {
    category: "malware",
    persona: { name: "Ray Donovan", department: "HR" },
    environment: { os: "Windows 10", device: "HP ProBook 450", detail: "Chrome with several extensions, Defender for Endpoint" },
    rootCause: "A rogue browser extension injects pop-up ads and redirects searches; Defender flagged but did not remove it",
    openingMessage:
      "My browser keeps opening ads by itself and my searches go to some weird site I've never heard of. The antivirus popped up a warning yesterday too.",
  },
  {
    category: "vm",
    persona: { name: "Colin Mwangi", department: "QA" },
    environment: { os: "Windows 11 host, Ubuntu 22.04 guest", device: "Dell Precision 3680", detail: "VirtualBox 7.1, 16 GB host RAM" },
    rootCause: "VM snapshot chain filled the host disk; VirtualBox pauses the guest with a disk-full I/O error",
    openingMessage:
      "My test virtual machine keeps freezing mid-run and shows some error about aborting. It was fine last month, and I haven't changed anything in my test setup.",
  },
  {
    category: "vm",
    persona: { name: "Aisha Rahman", department: "Customer Support" },
    environment: { os: "Windows 10 thin client", device: "HP t640", detail: "Citrix VDI desktop, roaming profile" },
    rootCause: "Stale disconnected VDI session on the broker keeps grabbing the license slot, so new logons are refused",
    openingMessage:
      "I can't get into my virtual desktop this morning — it says no resources available. My teammates got in fine and I really need my call queue open.",
  },
  {
    category: "hardware",
    persona: { name: "Ingrid Bauer", department: "Design" },
    environment: { os: "Windows 11", device: "Precision 5570 workstation", detail: "Heavy Adobe workloads, docked with dual monitors" },
    rootCause: "Failed CPU fan causes thermal shutdowns under load; fan error visible in BIOS and event log",
    openingMessage:
      "My workstation just switches itself off with no warning, usually when I'm exporting video. It's gotten worse this week — sometimes twice a day, and it sounds quieter than it used to.",
  },
];
