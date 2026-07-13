"use client";

import Link from "next/link";
import { BOOTCAMPS, skillsForBootcamp } from "@/lib/bootcamp";

export default function BootcampPickerPage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <div className="font-mono text-xs font-bold uppercase tracking-wide" style={{ color: "var(--accent)" }}>
        Certification bootcamps
      </div>
      <h1 className="font-display mt-1 text-3xl font-bold" style={{ color: "var(--ink)" }}>
        Pick your bootcamp
      </h1>
      <p className="mt-2 max-w-2xl text-sm" style={{ color: "var(--ink-muted)" }}>
        Choose the certification you want to train for. Every bootcamp has AI-written chapters with quizzes,
        a personal AI tutor, and hands-on labs on simulated machines. Pass every chapter quiz to earn a
        certificate of completion in your name — your start date is recorded the first time you enter.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {BOOTCAMPS.map((camp) => (
          <Link
            key={camp.id}
            href={`/bootcamp/${camp.id}`}
            className="panel block p-5 transition-transform duration-150 hover:-translate-y-0.5"
          >
            <div className="flex items-start justify-between gap-2">
              <h2 className="font-display text-lg font-bold" style={{ color: "var(--ink)" }}>{camp.title}</h2>
              <span className="pill-accent whitespace-nowrap font-mono text-[10px] uppercase">{camp.certName}</span>
            </div>
            <p className="mt-2 text-sm" style={{ color: "var(--ink-muted)" }}>{camp.blurb}</p>
            <p className="mt-3 font-mono text-[11px] uppercase" style={{ color: "var(--ink-faint)" }}>
              {camp.duration} · {skillsForBootcamp(camp.id).length} chapters
            </p>
          </Link>
        ))}
      </div>
    </main>
  );
}
