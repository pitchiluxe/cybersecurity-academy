import { NextResponse } from "next/server";
import { buildQueueMessages, isScenarioCategory, getCategoryMeta } from "@/lib/scenarios";
import { callOpenRouter, MissingApiKeyError, OpenRouterRequestError } from "@/lib/openrouter";
import { parseScenarioQueue, ParseError } from "@/lib/parsing";
import type { TicketPreview } from "@/lib/types";

function randomTicketId(): string {
  return `TCK-${Math.floor(1000 + Math.random() * 9000)}`;
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const count = typeof body?.count === "number" && body.count > 0 ? body.count : 9;

  const messages = buildQueueMessages(count);

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const text = await callOpenRouter(messages);
      const seeds = parseScenarioQueue(text, isScenarioCategory);
      const tickets: TicketPreview[] = seeds.map((seed) => ({
        ...seed,
        ticketId: randomTicketId(),
        priority: getCategoryMeta(seed.category).priority,
      }));
      return NextResponse.json({ tickets }, { status: 200 });
    } catch (err) {
      if (err instanceof MissingApiKeyError) {
        return NextResponse.json({ error: err.message }, { status: 503 });
      }
      if (err instanceof OpenRouterRequestError) {
        return NextResponse.json({ error: err.message }, { status: 502 });
      }
      if (err instanceof ParseError && attempt === 1) {
        return NextResponse.json({ error: `Could not parse ticket queue from model: ${err.message}` }, { status: 502 });
      }
    }
  }

  return NextResponse.json({ error: "Unreachable" }, { status: 500 });
}
