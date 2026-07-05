import { SCENARIO_CATEGORIES } from "@/lib/scenarios";
import { ScenarioCard } from "@/components/ScenarioCard";

export default function Home() {
  return (
    <main className="mx-auto max-w-3xl p-8">
      <h1 className="font-display text-3xl font-bold" style={{ color: "var(--ink)" }}>
        IT Playground
      </h1>
      <p className="mt-2" style={{ color: "var(--ink-muted)" }}>
        Pick a category. You&apos;ll play IT support against an AI end-user with a made-up problem — ask questions,
        diagnose, fix it, then submit for a graded review.
      </p>
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {SCENARIO_CATEGORIES.map((category) => (
          <ScenarioCard key={category.id} category={category} />
        ))}
      </div>
    </main>
  );
}
