import { NextResponse } from "next/server";
import { getCookieValue, verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/session";
import { callOpenRouter } from "@/lib/openrouter";
import { buildRouterScenarioMessages, parseRouterScenario, FALLBACK_ROUTER_SCENARIO } from "@/lib/routerLab";

export async function POST(request: Request) {
  const token = getCookieValue(request, SESSION_COOKIE_NAME);
  const session = token ? await verifySessionToken(token) : null;
  if (!session) {
    return NextResponse.json({ error: "Not logged in." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const brief = typeof body.brief === "string" && body.brief.trim() !== "" ? body.brief : undefined;

  try {
    const text = await callOpenRouter(buildRouterScenarioMessages(brief));
    const scenario = parseRouterScenario(text);
    return NextResponse.json({ scenario, fallback: false }, { status: 200 });
  } catch {
    return NextResponse.json({ scenario: FALLBACK_ROUTER_SCENARIO, fallback: true }, { status: 200 });
  }
}
