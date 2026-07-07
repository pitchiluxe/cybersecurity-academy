"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { NavBar } from "@/components/NavBar";

interface TrackProgress {
  id: string;
  title: string;
  description: string;
  started: boolean;
  modulesPassed: number;
  totalModules: number;
  qualifyingTickets: number;
  requiredTickets: number;
  certificate: { certCode: string; issuedAt: string } | null;
}

export default function CoursesPage() {
  const [tracks, setTracks] = useState<TrackProgress[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/profile")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("Could not load courses"))))
      .then((body) => setTracks(body.tracks))
      .catch((err) => setError(err.message));
  }, []);

  return (
    <>
      <NavBar />
      <main className="mx-auto max-w-5xl px-6 py-8">
        <h1 className="font-display text-2xl font-bold" style={{ color: "var(--ink)" }}>
          Certification courses
        </h1>
        <p className="mt-1 text-sm" style={{ color: "var(--ink-muted)" }}>
          AI-generated courses with a personal tutor. Finish every module, then resolve real
          tickets in the lab to earn your certificate.
        </p>

        {error && (
          <p role="alert" className="mt-6 text-sm" style={{ color: "var(--warn)" }}>
            {error}
          </p>
        )}
        {!tracks && !error && (
          <p className="mt-6 font-mono text-sm" style={{ color: "var(--ink-faint)" }}>
            Loading tracks…
          </p>
        )}

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {tracks?.map((t) => (
            <Link
              key={t.id}
              href={`/courses/${t.id}`}
              className="panel block p-5 transition-transform duration-150 hover:-translate-y-0.5"
            >
              <div className="flex items-start justify-between gap-3">
                <h2 className="font-display text-lg font-bold" style={{ color: "var(--ink)" }}>
                  {t.title}
                </h2>
                {t.certificate ? (
                  <span className="pill pill-accent">Certified</span>
                ) : t.started ? (
                  <span className="font-mono text-[10px] uppercase" style={{ color: "var(--accent)" }}>
                    In progress
                  </span>
                ) : null}
              </div>
              <p className="mt-2 text-sm" style={{ color: "var(--ink-muted)" }}>
                {t.description}
              </p>
              <div className="mt-4">
                <div className="h-1.5 w-full overflow-hidden rounded-full" style={{ background: "var(--surface-2)" }}>
                  <div
                    className="h-full rounded-full"
                    style={{
                      background: "var(--accent)",
                      width: t.totalModules > 0 ? `${(t.modulesPassed / t.totalModules) * 100}%` : "0%",
                    }}
                  />
                </div>
                <div className="mt-2 flex justify-between font-mono text-[11px]" style={{ color: "var(--ink-faint)" }}>
                  <span>{t.started ? `${t.modulesPassed}/${t.totalModules} modules` : "Not started"}</span>
                  <span>
                    Lab: {Math.min(t.qualifyingTickets, t.requiredTickets)}/{t.requiredTickets} tickets
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </main>
    </>
  );
}
