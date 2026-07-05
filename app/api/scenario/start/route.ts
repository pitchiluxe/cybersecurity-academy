import { NextResponse } from "next/server";
import { isScenarioCategory, buildStartMessages } from "@/lib/scenarios";
import { callOpenRouter, MissingApiKeyError, OpenRouterRequestError } from "@/lib/openrouter";
import { parseScenarioSeed, ParseError } from "@/lib/parsing";
import type { ScenarioCategory } from "@/lib/types";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const category = body?.category;

  if (typeof category !== "string" || !isScenarioCategory(category)) {
    return NextResponse.json({ error: "Unknown or missing scenario category" }, { status: 400 });
  }
  const validCategory: ScenarioCategory = category;

  const messages = buildStartMessages(validCategory);

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const text = await callOpenRouter(messages);
      const seed = parseScenarioSeed(text, validCategory);
      return NextResponse.json({ seed }, { status: 200 });
    } catch (err) {
      if (err instanceof MissingApiKeyError) {
        return NextResponse.json({ error: err.message }, { status: 503 });
      }
      if (err instanceof OpenRouterRequestError) {
        return NextResponse.json({ error: err.message }, { status: 502 });
      }
      if (err instanceof ParseError && attempt === 1) {
        return NextResponse.json({ error: `Could not parse scenario from model: ${err.message}` }, { status: 502 });
      }
      // ParseError on first attempt: fall through to retry.
    }
  }

  return NextResponse.json({ error: "Unreachable" }, { status: 500 });
}
