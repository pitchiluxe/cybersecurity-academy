import Link from "next/link";
import type { ScenarioCategory } from "@/lib/types";

export function ScenarioCard({
  category,
}: {
  category: { id: ScenarioCategory; label: string; blurb: string };
}) {
  return (
    <Link
      href={`/play/${category.id}`}
      className="block rounded-[10px] border p-5 transition-colors hover:border-[var(--accent)]"
      style={{ background: "var(--surface)", borderColor: "var(--border)" }}
    >
      <h2 className="font-display text-lg font-bold" style={{ color: "var(--ink)" }}>
        {category.label}
      </h2>
      <p className="mt-1 text-sm" style={{ color: "var(--ink-muted)" }}>
        {category.blurb}
      </p>
    </Link>
  );
}
