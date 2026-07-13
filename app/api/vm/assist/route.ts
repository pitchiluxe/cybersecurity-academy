import { NextResponse } from "next/server";
import { getCookieValue, verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/session";
import { callOpenRouter, MissingApiKeyError, OpenRouterRequestError } from "@/lib/openrouter";
import { buildVmAssistMessages, type VmSpec, type VmExchange } from "@/lib/vm";
import type { ScenarioSeed } from "@/lib/types";

export async function POST(request: Request) {
  const token = getCookieValue(request, SESSION_COOKIE_NAME);
  const session = token ? await verifySessionToken(token) : null;
  if (!session) {
    return NextResponse.json({ error: "Not logged in." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const seed = body?.seed as ScenarioSeed | undefined;
  const spec = body?.spec as VmSpec | undefined;
  const history = body?.history as VmExchange[] | undefined;
  if (!seed || typeof seed !== "object" || !spec || typeof spec !== "object" || !Array.isArray(history)) {
    return NextResponse.json({ error: "seed, spec and history[] required" }, { status: 400 });
  }

  try {
    const advice = await callOpenRouter(buildVmAssistMessages(seed, spec, history));
    return NextResponse.json({ advice }, { status: 200 });
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
