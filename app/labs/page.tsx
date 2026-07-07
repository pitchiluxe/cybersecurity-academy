import Link from "next/link";

const LABS = [
  {
    href: "/labs/wiring",
    title: "Network wiring lab",
    blurb: "Wire a real branch office in 3D — modem, router, switch, APs. Follow the wiring order, watch links come up, then see packets flow.",
    tags: "Network+ · CCNA · CCNP Security",
  },
  {
    href: "/labs/fortigate",
    title: "FortiGate firewall lab",
    blurb: "Rack and cable a FortiGate in 3D, then configure it for real: interfaces, policies, NAT, filtering — straight FortiOS CLI.",
    tags: "Fortinet FCP · SecurityX · CCNP Security",
  },
];

export default function LabsPage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <h1 className="font-display text-2xl font-bold" style={{ color: "var(--ink)" }}>
        Hands-on labs
      </h1>
      <p className="mt-1 text-sm" style={{ color: "var(--ink-muted)" }}>
        3D equipment you can actually touch. Lab scores count toward your certification lab requirements.
      </p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {LABS.map((lab) => (
          <Link key={lab.href} href={lab.href} className="panel block p-5 transition-transform duration-150 hover:-translate-y-0.5">
            <h2 className="font-display text-lg font-bold" style={{ color: "var(--ink)" }}>{lab.title}</h2>
            <p className="mt-2 text-sm" style={{ color: "var(--ink-muted)" }}>{lab.blurb}</p>
            <p className="mt-3 font-mono text-[11px] uppercase" style={{ color: "var(--ink-faint)" }}>{lab.tags}</p>
          </Link>
        ))}
      </div>
    </main>
  );
}
