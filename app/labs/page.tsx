"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { LabBrief } from "@/lib/labCatalog";

const CATALOG_KEY = "labs:catalog";

const ENGINE_LABELS: Record<LabBrief["engine"], string> = {
  wiring: "3D wiring",
  fortigate: "FortiGate CLI",
  router: "Router CLI",
};

export default function LabsPage() {
  const [labs, setLabs] = useState<LabBrief[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadCatalog = useCallback(async (force: boolean) => {
    setError(null);
    if (!force) {
      try {
        const cached = sessionStorage.getItem(CATALOG_KEY);
        if (cached) {
          setLabs(JSON.parse(cached));
          return;
        }
      } catch {
        // Corrupt cache — fall through to a fresh fetch.
      }
    }
    setRefreshing(true);
    try {
      const res = await fetch("/api/lab/list", { method: "POST" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Could not load the lab board.");
      sessionStorage.setItem(CATALOG_KEY, JSON.stringify(body.labs));
      setLabs(body.labs);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadCatalog(false);
  }, [loadCatalog]);

  function stashBrief(lab: LabBrief) {
    try {
      sessionStorage.setItem(`lab:${lab.id}`, JSON.stringify(lab));
    } catch {
      // Lab page falls back to a fresh random scenario without the stash.
    }
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold" style={{ color: "var(--ink)" }}>
            Hands-on labs
          </h1>
          <p className="mt-1 text-sm" style={{ color: "var(--ink-muted)" }}>
            Today&apos;s dispatched jobs — 3D equipment you can actually touch. Lab scores count toward your certification lab requirements.
          </p>
        </div>
        <button
          type="button"
          className="btn-ghost text-sm"
          onClick={() => loadCatalog(true)}
          disabled={refreshing}
        >
          {refreshing ? "Dispatching…" : "New job board"}
        </button>
      </div>

      {error && (
        <p role="alert" className="mt-6 text-sm" style={{ color: "var(--warn)" }}>{error}</p>
      )}

      {!labs && !error && (
        <p className="mt-6 font-mono text-sm" style={{ color: "var(--ink-faint)" }}>
          Dispatching today&apos;s lab jobs…
        </p>
      )}

      {labs && (
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {labs.map((lab) => (
            <Link
              key={lab.id}
              href={`/labs/${lab.engine}?lab=${encodeURIComponent(lab.id)}`}
              onClick={() => stashBrief(lab)}
              className="panel block p-5 transition-transform duration-150 hover:-translate-y-0.5"
            >
              <div className="flex items-start justify-between gap-2">
                <h2 className="font-display text-lg font-bold" style={{ color: "var(--ink)" }}>{lab.title}</h2>
                <span className="pill-accent whitespace-nowrap font-mono text-[10px] uppercase">
                  {ENGINE_LABELS[lab.engine]}
                </span>
              </div>
              <p className="mt-2 text-sm" style={{ color: "var(--ink-muted)" }}>{lab.blurb}</p>
              <p className="mt-3 font-mono text-[11px] uppercase" style={{ color: "var(--ink-faint)" }}>{lab.tags}</p>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
