import { NextResponse } from "next/server";
import { buildQueueMessages, isScenarioCategory, getCategoryMeta, randomQueueCount } from "@/lib/scenarios";
import { callOpenRouter, MissingApiKeyError, OpenRouterRequestError } from "@/lib/openrouter";
import { parseScenarioQueue, ParseError } from "@/lib/parsing";
import { FALLBACK_SEEDS } from "@/lib/fallbackTickets";
import type { ScenarioSeed, TicketPreview } from "@/lib/types";

function randomTicketId(): string {
  return `TCK-${Math.floor(1000 + Math.random() * 9000)}`;
}

function toTickets(seeds: ScenarioSeed[]): TicketPreview[] {
  return seeds.map((seed) => ({
    ...seed,
    ticketId: randomTicketId(),
    priority: getCategoryMeta(seed.category).priority,
  }));
}

function fallbackResponse(count: number): NextResponse {
  const shuffled = [...FALLBACK_SEEDS].sort(() => Math.random() - 0.5);
  const tickets = toTickets(shuffled.slice(0, Math.min(count, shuffled.length)));
  return NextResponse.json({ tickets, fallback: true }, { status: 200 });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const count = typeof body?.count === "number" && body.count > 0 ? body.count : randomQueueCount();

  const messages = buildQueueMessages(count);

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const text = await callOpenRouter(messages);
      const seeds = parseScenarioQueue(text, isScenarioCategory);
      return NextResponse.json({ tickets: toTickets(seeds) }, { status: 200 });
    } catch (err) {
      // Any provider failure (missing key, rate limit, bad output twice) falls
      // back to the built-in scenario bank so the desk stays open offline.
      if (err instanceof MissingApiKeyError || err instanceof OpenRouterRequestError) {
        return fallbackResponse(count);
      }
      if (err instanceof ParseError && attempt === 1) {
        return fallbackResponse(count);
      }
    }
  }

  return NextResponse.json({ error: "Unreachable" }, { status: 500 });
}
