"use client";

import { useState } from "react";
import Link from "next/link";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const res = await fetch("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Something went wrong. Try again.");
      setSubmitting(false);
      return;
    }

    // Full navigation: the client router may have cached "/" as a redirect to
    // /login from before authentication, so router.push would bounce back here.
    window.location.assign("/");
  }

  return (
    <main className="auth-shell">
      <div className="flex w-full max-w-4xl flex-col-reverse items-stretch gap-6 md:flex-row">
        <section
          className="flex flex-1 flex-col justify-between rounded-2xl border p-8"
          style={{ borderColor: "var(--border)", background: "var(--surface)" }}
        >
          <div>
            <div className="font-mono text-[10px] uppercase tracking-widest" style={{ color: "var(--accent)" }}>
              What is this?
            </div>
            <h2 className="font-display mt-2 text-xl font-bold" style={{ color: "var(--ink)" }}>
              Train like a real Tier-1 technician
            </h2>
            <p className="mt-3 text-sm leading-relaxed" style={{ color: "var(--ink-muted)" }}>
              HelpDesk Console is an AI-powered IT support training simulator. Work a live
              ticket queue, chat with realistic end-users, run remote diagnostics, and get
              graded on every resolution — just like a real service desk shift.
            </p>
            <ul className="mt-5 flex flex-col gap-3 text-sm" style={{ color: "var(--ink-muted)" }}>
              {[
                "AI-generated tickets across network, hardware, security and more",
                "Live chat with simulated end-users who react like real people",
                "Remote diagnostics and hands-on virtual machine labs",
                "Certification courses (A+, Network+, Security+, CCNA) with an AI tutor",
                "Earn certificates saved to your profile as you master each track",
              ].map((line) => (
                <li key={line} className="flex items-start gap-2">
                  <span aria-hidden="true" style={{ color: "var(--accent)" }}>✓</span>
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </div>
          <p className="mt-8 font-mono text-[11px] uppercase tracking-widest" style={{ color: "var(--ink-faint)" }}>
            By Erick Omari
          </p>
        </section>

        <div className="auth-card">
        <div className="auth-brand">
          <span className="brand-mark" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12a9 9 0 0 1 18 0" />
              <path d="M3 12v4a2 2 0 0 0 2 2h1a1 1 0 0 0 1-1v-4a1 1 0 0 0-1-1H3z" />
              <path d="M21 12v4a2 2 0 0 1-2 2h-1a1 1 0 0 1-1-1v-4a1 1 0 0 1 1-1h3z" />
              <path d="M19 18v1a2 2 0 0 1-2 2h-4" />
            </svg>
          </span>
          <div>
            <div className="font-display text-sm font-bold" style={{ color: "var(--ink)" }}>
              HelpDesk Console
            </div>
            <div className="font-mono text-[10px] uppercase tracking-widest" style={{ color: "var(--ink-faint)" }}>
              Agent sign-in
            </div>
          </div>
        </div>

        <h1 className="font-display mt-6 text-2xl font-bold" style={{ color: "var(--ink)" }}>
          Sign in
        </h1>
        <p className="mt-1 text-sm" style={{ color: "var(--ink-muted)" }}>
          Access your ticket queue and continue your support shift.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
          <div className="field">
            <label htmlFor="email" className="field-label">
              Work email
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="field-input"
            />
          </div>
          <div className="field">
            <label htmlFor="password" className="field-label">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              placeholder="Your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="field-input"
            />
          </div>
          {error && (
            <p role="alert" className="rounded-lg border px-3 py-2 text-sm" style={{ color: "var(--warn)", background: "var(--warn-soft)", borderColor: "var(--warn-line)" }}>
              {error}
            </p>
          )}
          <button type="submit" disabled={submitting} className="btn-primary">
            {submitting ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="mt-5 text-sm" style={{ color: "var(--ink-muted)" }}>
          No account yet?{" "}
          <Link href="/register" className="auth-link">
            Create one
          </Link>
        </p>
        </div>
      </div>
    </main>
  );
}
