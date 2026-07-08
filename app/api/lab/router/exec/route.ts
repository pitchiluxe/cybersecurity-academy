import { NextResponse } from "next/server";
import { getCookieValue, verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/session";
import { callOpenRouter, MissingApiKeyError, OpenRouterRequestError } from "@/lib/openrouter";
import { extractTaskMarkers } from "@/lib/fortigateLab";
import { buildRouterExecMessages, type RouterScenario } from "@/lib/routerLab";
import type { VmExchange } from "@/lib/vm";

export async function POST(request: Request) {
  const token = getCookieValue(request, SESSION_COOKIE_NAME);
  const session = token ? await verifySessionToken(token) : null;
  if (!session) {
    return NextResponse.json({ error: "Not logged in." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const scenario = body?.scenario as RouterScenario | undefined;
  const doneTaskIds = body?.doneTaskIds as string[] | undefined;
  const history = body?.history as VmExchange[] | undefined;
  const command = body?.command;

  if (!scenario || typeof scenario !== "object" || !Array.isArray(doneTaskIds) || !Array.isArray(history)) {
    return NextResponse.json({ error: "scenario, doneTaskIds[], history[] required" }, { status: 400 });
  }
  if (typeof command !== "string" || command.trim() === "") {
    return NextResponse.json({ error: "command required" }, { status: 400 });
  }

  try {
    const raw = await callOpenRouter(buildRouterExecMessages(scenario, doneTaskIds, history, command.trim()));
    const { cleaned, doneIds, complete } = extractTaskMarkers(raw);
    return NextResponse.json({ output: cleaned, doneIds, complete }, { status: 200 });
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
