import { NextResponse } from "next/server";
import { callOpenRouter, MissingApiKeyError, OpenRouterRequestError } from "@/lib/openrouter";
import { ParseError } from "@/lib/parsing";
import { buildVmInitMessages, parseVmSpec } from "@/lib/vm";
import type { ScenarioSeed } from "@/lib/types";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const seed = body?.seed as ScenarioSeed | undefined;
  if (!seed || typeof seed !== "object") {
    return NextResponse.json({ error: "Missing seed" }, { status: 400 });
  }

  const messages = buildVmInitMessages(seed);

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const text = await callOpenRouter(messages);
      const spec = parseVmSpec(text);
      return NextResponse.json({ spec }, { status: 200 });
    } catch (err) {
      if (err instanceof MissingApiKeyError) {
        return NextResponse.json({ error: err.message }, { status: 503 });
      }
      if (err instanceof OpenRouterRequestError) {
        return NextResponse.json({ error: err.message }, { status: 502 });
      }
      if (err instanceof ParseError && attempt === 1) {
        return NextResponse.json({ error: `Could not parse VM spec from model: ${err.message}` }, { status: 502 });
      }
    }
  }

  return NextResponse.json({ error: "Unreachable" }, { status: 500 });
}
