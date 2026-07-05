import { SCENARIO_CATEGORIES } from "@/lib/scenarios";
import { ScenarioCard } from "@/components/ScenarioCard";

export default function Home() {
  return (
    <main className="mx-auto max-w-3xl p-8">
      <div className="font-mono text-xs font-bold uppercase tracking-wide" style={{ color: "var(--accent)" }}>
        Queue · {SCENARIO_CATEGORIES.length} open tickets
      </div>
      <h1 className="font-display mt-1 text-3xl font-bold" style={{ color: "var(--ink)" }}>
        IT Playground
      </h1>
      <p className="mt-2" style={{ color: "var(--ink-muted)" }}>
        Pick a ticket. You&apos;ll play the technician against an end-user with a real (made-up) problem — ask
        questions, diagnose the fault, fix it, then submit for grading.
      </p>
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {SCENARIO_CATEGORIES.map((category) => (
          <ScenarioCard key={category.id} category={category} />
        ))}
      </div>
    </main>
  );
}
