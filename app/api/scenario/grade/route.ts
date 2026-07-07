import { NextResponse } from "next/server";
import { getCookieValue, verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/session";
import { recordTicketResult } from "@/lib/db";
import { checkCertsForCategory } from "@/lib/certification";
import { buildGradeMessages } from "@/lib/scenarios";
import { callOpenRouter, MissingApiKeyError, OpenRouterRequestError } from "@/lib/openrouter";
import { parseGradeResult, ParseError } from "@/lib/parsing";
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

  const messages = buildGradeMessages(seed, transcript);

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const text = await callOpenRouter(messages);
      const result = parseGradeResult(text);
      const token = getCookieValue(request, SESSION_COOKIE_NAME);
      const session = token ? await verifySessionToken(token) : null;
      let newCertificates: string[] = [];
      if (session) {
        await recordTicketResult(session.userId, seed.category, result.score);
        newCertificates = await checkCertsForCategory(session.userId, seed.category);
      }
      return NextResponse.json({ result, rootCause: seed.rootCause, newCertificates }, { status: 200 });
    } catch (err) {
      if (err instanceof MissingApiKeyError) {
        return NextResponse.json({ error: err.message }, { status: 503 });
      }
      if (err instanceof OpenRouterRequestError) {
        return NextResponse.json({ error: err.message }, { status: 502 });
      }
      if (err instanceof ParseError && attempt === 1) {
        return NextResponse.json({ error: `Could not parse grade result from model: ${err.message}` }, { status: 502 });
      }
    }
  }

  return NextResponse.json({ error: "Unreachable" }, { status: 500 });
}
