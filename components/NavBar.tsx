"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";

export function NavBar() {
  const router = useRouter();
  const pathname = usePathname();
  const [email, setEmail] = useState<string | null>(null);

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
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="border-b" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
      <div className="mx-auto flex max-w-3xl items-center justify-between px-8 py-3">
        <Link href="/" className="font-display text-base font-bold" style={{ color: "var(--ink)" }}>
          IT Playground
        </Link>
        <div className="flex items-center gap-4">
          <Link href="/" className="font-mono text-xs uppercase tracking-wide" style={{ color: "var(--ink-muted)" }}>
            Queue
          </Link>
          {email && (
            <>
              <span className="font-mono text-xs" style={{ color: "var(--ink-faint)" }}>
                {email}
              </span>
              <button
                onClick={handleLogout}
                className="cursor-pointer font-mono text-xs uppercase tracking-wide"
                style={{ color: "var(--ink-muted)", background: "none", border: "none" }}
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
