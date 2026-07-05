import type { TranscriptMessage } from "@/lib/types";

export function ChatBubble({ message, name }: { message: TranscriptMessage; name: string }) {
  const isTech = message.role === "tech";
  return (
    <div className={`flex gap-3 ${isTech ? "flex-row-reverse self-end" : ""}`} style={{ maxWidth: "88%" }}>
      <div
        className="flex h-8 w-8 flex-none items-center justify-center rounded-full font-mono text-xs font-bold"
        style={
          isTech
            ? { background: "var(--accent-soft)", color: "var(--accent)", border: "1px solid var(--accent-line)" }
            : { background: "var(--surface-2)", color: "var(--ink-muted)" }
        }
      >
        {name
          .split(" ")
          .map((p) => p[0])
          .join("")
          .slice(0, 2)
          .toUpperCase()}
      </div>
      <div
        className="rounded-xl border px-4 py-3 text-sm"
        style={
          isTech
            ? { background: "var(--accent-soft)", borderColor: "var(--accent-line)", color: "var(--ink)" }
            : { background: "var(--surface-2)", borderColor: "var(--border)", color: "var(--ink)" }
        }
      >
        {message.content}
      </div>
    </div>
  );
}
