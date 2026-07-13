import { NextResponse } from "next/server";
import { buildQueueMessages, isScenarioCategory, getCategoryMeta, randomQueueCount, MIN_QUEUE_TICKETS } from "@/lib/scenarios";
import { getSettings } from "@/lib/settings";
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
  // Local Ollama on CPU generates a few tokens/second — a 20-ticket batch would
  // outlive Node's 300s fetch header timeout, so pin local queues to the minimum.
  const defaultCount = getSettings().provider === "ollama" ? MIN_QUEUE_TICKETS : randomQueueCount();
  const count = typeof body?.count === "number" && body.count > 0 ? body.count : defaultCount;
  const topic = typeof body?.topic === "string" && body.topic.trim() !== "" ? body.topic.trim().slice(0, 120) : undefined;

  const messages = buildQueueMessages(count, undefined, topic);

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      // 10-20 tickets of structured JSON can overflow the default 4096-token budget.
      const text = await callOpenRouter(messages, { maxTokens: 8192 });
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
