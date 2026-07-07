"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { HEARTBEAT_INTERVAL_MS } from "@/lib/presence";

export function NavBar() {
  const pathname = usePathname();
  const [email, setEmail] = useState<string | null>(null);
  const [online, setOnline] = useState<number | null>(null);

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

  return (
    <header className="border-b" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-3">
        <Link href="/" className="flex items-center gap-3">
          <span className="brand-mark" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12a9 9 0 0 1 18 0" />
              <path d="M3 12v4a2 2 0 0 0 2 2h1a1 1 0 0 0 1-1v-4a1 1 0 0 0-1-1H3z" />
              <path d="M21 12v4a2 2 0 0 1-2 2h-1a1 1 0 0 1-1-1v-4a1 1 0 0 1 1-1h3z" />
              <path d="M19 18v1a2 2 0 0 1-2 2h-4" />
            </svg>
          </span>
          <span className="flex flex-col leading-tight">
            <span className="font-display text-sm font-bold" style={{ color: "var(--ink)" }}>
              HelpDesk Console
            </span>
            <span className="font-mono text-[10px] uppercase tracking-widest" style={{ color: "var(--ink-faint)" }}>
              Training simulator
            </span>
          </span>
        </Link>

        <div className="flex items-center gap-3 sm:gap-4">
          <span
            className="status-dot-wrap font-mono text-[11px] uppercase tracking-wide"
            style={{ color: "var(--ink-muted)" }}
            title={online !== null ? `${online} user${online === 1 ? "" : "s"} online now` : "Systems online"}
          >
            <span className="status-dot" aria-hidden="true" />
            <span className="hidden md:inline">{online !== null ? `${online} online` : "Systems online"}</span>
            <span className="md:hidden">{online !== null ? online : ""}</span>
          </span>
          <Link
            href="/"
            className="font-mono text-xs uppercase tracking-wide transition-colors duration-200 hover:opacity-80"
            style={{ color: pathname === "/" ? "var(--accent)" : "var(--ink-muted)" }}
          >
            Queue
          </Link>
          <Link
            href="/courses"
            className="font-mono text-xs uppercase tracking-wide transition-colors duration-200 hover:opacity-80"
            style={{ color: pathname?.startsWith("/courses") ? "var(--accent)" : "var(--ink-muted)" }}
          >
            Courses
          </Link>
          <Link
            href="/profile"
            className="font-mono text-xs uppercase tracking-wide transition-colors duration-200 hover:opacity-80"
            style={{ color: pathname === "/profile" ? "var(--accent)" : "var(--ink-muted)" }}
          >
            Profile
          </Link>
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
                className="hidden rounded-full border px-3 py-1 font-mono text-[11px] sm:inline"
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
      </div>
    </header>
  );
}
