"use client";

import { useEffect, useState } from "react";
import Link from "next/link";


interface TrackProgress {
  id: string;
  title: string;
  description: string;
  tier: string;
  started: boolean;
  modulesPassed: number;
  totalModules: number;
  qualifyingTickets: number;
  requiredTickets: number;
  certificate: { certCode: string; issuedAt: string } | null;
}

interface Profile {
  email: string;
  tracks: TrackProgress[];
  stats: { total: number; resolvedOver70: number; avgGrade: number | null };
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/profile")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("Could not load profile"))))
      .then(setProfile)
      .catch((err) => setError(err.message));
  }, []);

  const certs = profile?.tracks.filter((t) => t.certificate) ?? [];

  return (
    <>
      <main className="mx-auto max-w-5xl px-6 py-8">
        <div className="print-hide">
          <h1 className="font-display text-2xl font-bold" style={{ color: "var(--ink)" }}>
            Profile
          </h1>
          {error && (
            <p role="alert" className="mt-4 text-sm" style={{ color: "var(--warn)" }}>
              {error}
            </p>
          )}
          {!profile && !error && (
            <p className="mt-4 font-mono text-sm" style={{ color: "var(--ink-faint)" }}>
              Loading…
            </p>
          )}

          {profile && (
            <>
              <p className="mt-1 font-mono text-sm" style={{ color: "var(--ink-muted)" }}>
                {profile.email}
              </p>

              <div className="mt-6 grid gap-4 sm:grid-cols-3">
                <div className="stat-card">
                  <div className="font-mono text-[11px] uppercase" style={{ color: "var(--ink-faint)" }}>
                    Tickets graded
                  </div>
                  <div className="font-display text-2xl font-bold" style={{ color: "var(--ink)" }}>
                    {profile.stats.total}
                  </div>
                </div>
                <div className="stat-card">
                  <div className="font-mono text-[11px] uppercase" style={{ color: "var(--ink-faint)" }}>
                    Resolved ≥ 70
                  </div>
                  <div className="font-display text-2xl font-bold" style={{ color: "var(--ink)" }}>
                    {profile.stats.resolvedOver70}
                  </div>
                </div>
                <div className="stat-card">
                  <div className="font-mono text-[11px] uppercase" style={{ color: "var(--ink-faint)" }}>
                    Average grade
                  </div>
                  <div className="font-display text-2xl font-bold" style={{ color: "var(--ink)" }}>
                    {profile.stats.avgGrade ?? "—"}
                  </div>
                </div>
              </div>

              <h2 className="font-display mt-8 text-lg font-bold" style={{ color: "var(--ink)" }}>
                Course progress
              </h2>
              <div className="mt-3 flex flex-col gap-2">
                {profile.tracks.map((t) => (
                  <Link
                    key={t.id}
                    href={`/courses/${t.id}`}
                    className="panel flex items-center justify-between gap-4 px-4 py-3"
                  >
                    <span className="text-sm font-semibold" style={{ color: "var(--ink)" }}>
                      {t.title}
                    </span>
                    <span className="font-mono text-[11px]" style={{ color: "var(--ink-faint)" }}>
                      {t.started ? `${t.modulesPassed}/${t.totalModules} modules` : "Not started"} · lab{" "}
                      {Math.min(t.qualifyingTickets, t.requiredTickets)}/{t.requiredTickets}
                    </span>
                  </Link>
                ))}
              </div>
            </>
          )}
        </div>

        {profile && (
          <>
            <div className="print-hide mt-8 flex items-center justify-between">
              <h2 className="font-display text-lg font-bold" style={{ color: "var(--ink)" }}>
                Certificates ({certs.length})
              </h2>
              {certs.length > 0 && (
                <button onClick={() => window.print()} className="btn-primary">
                  Print certificates
                </button>
              )}
            </div>
            {certs.length === 0 && (
              <p className="print-hide mt-2 text-sm" style={{ color: "var(--ink-muted)" }}>
                No certificates yet — finish a course and resolve lab tickets to earn one.
              </p>
            )}
            <div className="mt-4 flex flex-col gap-5">
              {certs.map((t) => (
                <div
                  key={t.id}
                  className="cert-card rounded-2xl border-2 p-8 text-center"
                  style={{ borderColor: "var(--accent)", background: "var(--surface)" }}
                >
                  <div className="font-mono text-[10px] uppercase tracking-widest" style={{ color: "var(--ink-faint)" }}>
                    HelpDesk Console · Certificate of Completion
                  </div>
                  <div className="font-display mt-4 text-2xl font-bold" style={{ color: "var(--ink)" }}>
                    {t.title}
                  </div>
                  <div className="mt-3 text-sm" style={{ color: "var(--ink-muted)" }}>
                    Awarded to{" "}
                    <span className="font-semibold" style={{ color: "var(--ink)" }}>
                      {profile.email}
                    </span>
                    <br />
                    for completing all course modules and resolving {t.requiredTickets}+ real-world lab tickets.
                  </div>
                  <div className="mt-4 font-mono text-[11px]" style={{ color: "var(--ink-faint)" }}>
                    {t.certificate!.certCode} · issued {t.certificate!.issuedAt}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </main>
    </>
  );
}
