import { NextResponse } from "next/server";
import { buildReplyMessages } from "@/lib/scenarios";
import { callOpenRouter, MissingApiKeyError, OpenRouterRequestError } from "@/lib/openrouter";
import type { ScenarioSeed, TranscriptMessage } from "@/lib/types";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const seed = body?.seed as ScenarioSeed | undefined;
  const transcript = body?.transcript as TranscriptMessage[] | undefined;

  if (!seed || typeof seed !== "object") {
    return NextResponse.json({ error: "Missing seed" }, { status: 400 });
  }
  if (!Array.isArray(transcript)) {
    return NextResponse.json({ error: "transcript must be an array" }, { status: 400 });
  }

  try {
    const messages = buildReplyMessages(seed, transcript);
    const message = await callOpenRouter(messages);
    return NextResponse.json({ message }, { status: 200 });
  } catch (err) {
    if (err instanceof MissingApiKeyError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    if (err instanceof OpenRouterRequestError) {
      return NextResponse.json({ error: err.message }, { status: 502 });
    }
    throw err;
  }
}
