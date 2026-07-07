"use client";

import { useState } from "react";

const SUBJECTS = [
  "General Inquiry",
  "Partnership / Collaboration",
  "Feature Request",
  "Bug Report",
  "Feedback",
  "Other",
];

const TOPICS = ["IT Training", "Partnerships", "Feedback", "Feature Ideas", "Collaborations", "Bugs", "Business"];

const SOCIALS: { label: string; href: string; icon: JSX.Element }[] = [
  {
    label: "GitHub",
    href: "https://github.com/pitchiluxe",
    icon: (
      <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
        <path d="M12 2C6.48 2 2 6.58 2 12.25c0 4.53 2.87 8.37 6.84 9.73.5.1.68-.22.68-.49v-1.7c-2.78.62-3.37-1.36-3.37-1.36-.46-1.18-1.11-1.5-1.11-1.5-.9-.63.07-.62.07-.62 1 .07 1.53 1.05 1.53 1.05.9 1.57 2.34 1.12 2.91.86.09-.66.35-1.12.63-1.38-2.22-.26-4.56-1.14-4.56-5.06 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.3.1-2.7 0 0 .84-.28 2.75 1.05a9.32 9.32 0 0 1 5 0c1.91-1.33 2.75-1.05 2.75-1.05.55 1.4.2 2.44.1 2.7.64.72 1.03 1.63 1.03 2.75 0 3.93-2.34 4.8-4.57 5.05.36.32.68.94.68 1.9v2.82c0 .27.18.6.69.49A10.02 10.02 0 0 0 22 12.25C22 6.58 17.52 2 12 2Z" />
      </svg>
    ),
  },
  {
    label: "X",
    href: "https://x.com/eomari",
    icon: (
      <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" aria-hidden="true">
        <path d="M18.9 2H22l-7.6 8.7L23.3 22h-6.8l-5.3-6.9L5.1 22H2l8.1-9.3L1.7 2h6.9l4.8 6.4L18.9 2Zm-2.4 18h1.9L7.6 3.9H5.6L16.5 20Z" />
      </svg>
    ),
  },
  {
    label: "LinkedIn",
    href: "https://www.linkedin.com/in/erickomari",
    icon: (
      <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
        <path d="M4.98 3.5A2.5 2.5 0 1 0 5 8.5a2.5 2.5 0 0 0-.02-5ZM3 9h4v12H3V9Zm6 0h3.8v1.7h.05c.53-1 1.83-2.05 3.77-2.05C20.4 8.65 22 10.6 22 14v7h-4v-6.2c0-1.48-.03-3.38-2.06-3.38-2.06 0-2.38 1.6-2.38 3.27V21H9V9Z" />
      </svg>
    ),
  },
];

type Status = "idle" | "loading" | "success" | "error";

export default function ContactPage() {
  const [form, setForm] = useState({ name: "", email: "", subject: SUBJECTS[0], message: "" });
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  function change(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim() || !form.message.trim()) return;
    setStatus("loading");
    setErrorMsg("");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Something went wrong.");
      setStatus("success");
      setForm({ name: "", email: "", subject: SUBJECTS[0], message: "" });
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Failed to send. Please try again.");
    }
  }

  const loading = status === "loading";
  const canSend = form.name.trim() && form.email.trim() && form.message.trim();

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-10">
      {/* Hero */}
      <div className="text-center">
        <span
          className="inline-flex items-center gap-2 rounded-full border px-4 py-1.5 font-mono text-[11px] uppercase tracking-wide"
          style={{ color: "var(--accent)", borderColor: "var(--accent-line)", background: "var(--accent-soft)" }}
        >
          Direct line to the builder
        </span>
        <h1 className="font-display mt-5 text-4xl font-black" style={{ color: "var(--ink)" }}>
          Let&apos;s <span style={{ color: "var(--accent)" }}>connect</span>
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed" style={{ color: "var(--ink-muted)" }}>
          Have an idea, a question, or want to build something together? I&apos;d love to hear from you.
        </p>
      </div>

      <div className="mt-10 grid gap-6 md:grid-cols-5">
        {/* Left: info */}
        <aside className="flex flex-col gap-5 md:col-span-2">
          <div className="panel p-6">
            <div className="flex items-center gap-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/Erick.png"
                alt="Erick Omari"
                className="h-16 w-16 flex-none rounded-2xl object-cover object-[center_10%] shadow-lg"
                style={{ boxShadow: "0 0 0 2px var(--accent-line)" }}
              />
              <div>
                <p className="font-bold" style={{ color: "var(--ink)" }}>Erick Omari</p>
                <p className="text-xs font-medium" style={{ color: "var(--accent)" }}>Builder · TechBench Academy</p>
              </div>
            </div>
            <div className="mt-6 flex flex-col gap-4 text-sm">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-wider" style={{ color: "var(--ink-faint)" }}>Website</p>
                <a href="https://www.technobiztrader.net" target="_blank" rel="noopener noreferrer" className="hover:underline" style={{ color: "var(--ink-muted)" }}>
                  www.technobiztrader.net
                </a>
              </div>
              <div>
                <p className="font-mono text-[10px] uppercase tracking-wider" style={{ color: "var(--ink-faint)" }}>Response time</p>
                <p style={{ color: "var(--ink-muted)" }}>Usually within 24 hours</p>
              </div>
              <div>
                <p className="font-mono text-[10px] uppercase tracking-wider" style={{ color: "var(--ink-faint)" }}>Project</p>
                <p style={{ color: "var(--ink-muted)" }}>TechBench Academy — IT support training lab</p>
              </div>
            </div>
          </div>

          <div className="panel p-6">
            <p className="panel-header mb-3">What I love to discuss</p>
            <div className="flex flex-wrap gap-2">
              {TOPICS.map((t) => (
                <span
                  key={t}
                  className="rounded-full border px-3 py-1 text-xs"
                  style={{ color: "var(--ink-muted)", borderColor: "var(--border)", background: "var(--surface-2)" }}
                >
                  {t}
                </span>
              ))}
            </div>
          </div>

          <div className="panel p-6">
            <p className="panel-header mb-3">Find me online</p>
            <div className="grid grid-cols-2 gap-2">
              {SOCIALS.map((s) => (
                <a
                  key={s.label}
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2.5 rounded-xl border px-3 py-2.5 transition-colors duration-200"
                  style={{ color: "var(--ink-muted)", borderColor: "var(--border)", background: "var(--surface-2)" }}
                >
                  {s.icon}
                  <span className="text-xs font-medium">{s.label}</span>
                </a>
              ))}
            </div>
          </div>
        </aside>

        {/* Right: form */}
        <section className="md:col-span-3">
          <div className="panel p-7">
            <h2 className="font-display text-lg font-bold" style={{ color: "var(--ink)" }}>Send a message</h2>

            {status === "success" ? (
              <div className="flex flex-col items-center gap-4 py-14 text-center">
                <span
                  className="flex h-16 w-16 items-center justify-center rounded-full border text-3xl"
                  style={{ color: "var(--good)", borderColor: "var(--good-line)", background: "var(--good-soft)" }}
                >
                  ✓
                </span>
                <div>
                  <p className="font-display text-xl font-bold" style={{ color: "var(--ink)" }}>Message sent!</p>
                  <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed" style={{ color: "var(--ink-muted)" }}>
                    Thanks for reaching out. Erick will get back to you within 24 hours — check your inbox for a confirmation.
                  </p>
                </div>
                <button onClick={() => setStatus("idle")} className="text-xs underline underline-offset-2" style={{ color: "var(--accent)" }}>
                  Send another message
                </button>
              </div>
            ) : (
              <form onSubmit={submit} className="mt-6 flex flex-col gap-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="field">
                    <label className="field-label" htmlFor="name">Name *</label>
                    <input id="name" name="name" value={form.name} onChange={change} required placeholder="Your name" className="field-input" />
                  </div>
                  <div className="field">
                    <label className="field-label" htmlFor="email">Email *</label>
                    <input id="email" name="email" type="email" value={form.email} onChange={change} required placeholder="you@email.com" className="field-input" />
                  </div>
                </div>

                <div className="field">
                  <label className="field-label" htmlFor="subject">Subject</label>
                  <select id="subject" name="subject" value={form.subject} onChange={change} className="field-input cursor-pointer">
                    {SUBJECTS.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>

                <div className="field">
                  <label className="field-label" htmlFor="message">Message *</label>
                  <textarea
                    id="message"
                    name="message"
                    value={form.message}
                    onChange={change}
                    required
                    rows={7}
                    placeholder="Tell me what's on your mind…"
                    className="field-input resize-none leading-relaxed"
                  />
                  <p className="text-right font-mono text-[11px]" style={{ color: "var(--ink-faint)" }}>{form.message.length} chars</p>
                </div>

                {status === "error" && (
                  <p role="alert" className="rounded-lg border px-4 py-3 text-sm" style={{ color: "var(--danger)", borderColor: "var(--danger-line)", background: "var(--danger-soft)" }}>
                    {errorMsg}
                  </p>
                )}

                <button type="submit" disabled={loading || !canSend} className="btn-primary w-full">
                  {loading ? "Sending…" : "Send message"}
                </button>
                <p className="text-center font-mono text-[11px]" style={{ color: "var(--ink-faint)" }}>
                  You&apos;ll receive an auto-reply confirmation at the email you provide.
                </p>
              </form>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
