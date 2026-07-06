import Link from "next/link";

export function NavBar() {
  return (
    <header className="border-b" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
      <div className="mx-auto flex max-w-3xl items-center justify-between px-8 py-3">
        <Link href="/" className="font-display text-base font-bold" style={{ color: "var(--ink)" }}>
          IT Playground
        </Link>
        <Link href="/" className="font-mono text-xs uppercase tracking-wide" style={{ color: "var(--ink-muted)" }}>
          Queue
        </Link>
      </div>
    </header>
  );
}
