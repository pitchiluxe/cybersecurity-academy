"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { HEARTBEAT_INTERVAL_MS } from "@/lib/presence";

export function NavBar() {
  const pathname = usePathname();
  const [email, setEmail] = useState<string | null>(null);
  const [online, setOnline] = useState<number | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function beat() {
      if (document.hidden) return;
      try {
        const res = await fetch("/api/presence", { method: "POST" });
        if (!res.ok) return;
        const body = await res.json();
        if (!cancelled && typeof body.online === "number") setOnline(body.online);
      } catch {
        /* offline blip — keep last value */
      }
    }

    beat();
    const id = setInterval(beat, HEARTBEAT_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setMenuOpen(false);
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((body) => {
        if (cancelled) return;
        setEmail(body?.user?.email ?? null);
      })
      .catch(() => {
        if (!cancelled) setEmail(null);
      });
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    // Full navigation so cached authenticated pages are dropped with the session.
    window.location.assign("/login");
  }

  const navLinks: { href: string; label: string; active: boolean }[] = [
    { href: "/queue", label: "Queue", active: pathname === "/queue" },
    { href: "/courses", label: "Courses", active: !!pathname?.startsWith("/courses") },
    { href: "/labs", label: "Labs", active: !!pathname?.startsWith("/labs") },
    { href: "/profile", label: "Profile", active: pathname === "/profile" },
  ];

  const onlineTitle = online !== null ? `${online} user${online === 1 ? "" : "s"} online now` : "Systems online";

  return (
    <header className="border-b" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <Link href="/" className="flex min-w-0 items-center gap-2.5">
          <span className="brand-mark" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12a9 9 0 0 1 18 0" />
              <path d="M3 12v4a2 2 0 0 0 2 2h1a1 1 0 0 0 1-1v-4a1 1 0 0 0-1-1H3z" />
              <path d="M21 12v4a2 2 0 0 1-2 2h-1a1 1 0 0 1-1-1v-4a1 1 0 0 1 1-1h3z" />
              <path d="M19 18v1a2 2 0 0 1-2 2h-4" />
            </svg>
          </span>
          <span className="flex min-w-0 flex-col leading-tight">
            <span className="font-display text-sm font-bold" style={{ color: "var(--ink)" }}>
              TechBench Academy
            </span>
            <span className="hidden font-mono text-[10px] uppercase tracking-widest sm:block" style={{ color: "var(--ink-faint)" }}>
              IT training lab
            </span>
          </span>
        </Link>

        {/* Desktop cluster */}
        <div className="hidden items-center gap-3 md:flex lg:gap-4">
          <span
            className="status-dot-wrap font-mono text-[11px] uppercase tracking-wide"
            style={{ color: "var(--ink-muted)" }}
            title={onlineTitle}
          >
            <span className="status-dot" aria-hidden="true" />
            <span>{online !== null ? `${online} online` : "Systems online"}</span>
          </span>
          {navLinks.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="font-mono text-xs uppercase tracking-wide transition-colors duration-200 hover:opacity-80"
              style={{ color: l.active ? "var(--accent)" : "var(--ink-muted)" }}
            >
              {l.label}
            </Link>
          ))}
          <Link
            href="/settings"
            aria-label="Settings"
            title="Settings"
            className="transition-colors duration-200 hover:opacity-80"
            style={{ color: pathname === "/settings" ? "var(--accent)" : "var(--ink-muted)" }}
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </Link>
          {email && (
            <>
              <span
                className="hidden max-w-[180px] truncate rounded-full border px-3 py-1 font-mono text-[11px] lg:inline-block"
                style={{ color: "var(--ink-muted)", borderColor: "var(--border)", background: "var(--surface-2)" }}
              >
                {email}
              </span>
              <button
                onClick={handleLogout}
                className="cursor-pointer rounded-lg border px-3 py-1.5 font-mono text-[11px] uppercase tracking-wide transition-colors duration-200"
                style={{ color: "var(--ink-muted)", borderColor: "var(--border)", background: "transparent" }}
              >
                Log out
              </button>
            </>
          )}
        </div>

        {/* Mobile: online dot + hamburger */}
        <div className="flex items-center gap-2 md:hidden">
          <span className="status-dot-wrap font-mono text-[11px]" style={{ color: "var(--ink-muted)" }} title={onlineTitle}>
            <span className="status-dot" aria-hidden="true" />
            <span>{online ?? ""}</span>
          </span>
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            className="flex h-10 w-10 items-center justify-center rounded-lg border transition-colors duration-200"
            style={{ borderColor: "var(--border)", color: "var(--ink)" }}
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              {menuOpen ? <path d="M18 6 6 18M6 6l12 12" /> : <><path d="M3 12h18" /><path d="M3 6h18" /><path d="M3 18h18" /></>}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile dropdown */}
      {menuOpen && (
        <div className="border-t md:hidden" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
          <nav className="mx-auto flex max-w-5xl flex-col px-4 py-2">
            {navLinks.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setMenuOpen(false)}
                className="rounded-lg px-3 py-2.5 font-mono text-sm uppercase tracking-wide transition-colors duration-200"
                style={{ color: l.active ? "var(--accent)" : "var(--ink-muted)", background: l.active ? "var(--surface-2)" : "transparent" }}
              >
                {l.label}
              </Link>
            ))}
            <Link
              href="/settings"
              onClick={() => setMenuOpen(false)}
              className="rounded-lg px-3 py-2.5 font-mono text-sm uppercase tracking-wide transition-colors duration-200"
              style={{ color: pathname === "/settings" ? "var(--accent)" : "var(--ink-muted)", background: pathname === "/settings" ? "var(--surface-2)" : "transparent" }}
            >
              Settings
            </Link>
            {email && (
              <div className="mt-2 flex items-center justify-between gap-3 border-t px-3 pt-3" style={{ borderColor: "var(--border)" }}>
                <span className="min-w-0 truncate font-mono text-[11px]" style={{ color: "var(--ink-faint)" }}>{email}</span>
                <button
                  onClick={handleLogout}
                  className="cursor-pointer rounded-lg border px-3 py-1.5 font-mono text-[11px] uppercase tracking-wide"
                  style={{ color: "var(--ink-muted)", borderColor: "var(--border)", background: "transparent" }}
                >
                  Log out
                </button>
              </div>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
