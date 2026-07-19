import { NextResponse } from "next/server";
import { getCookieValue, verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/session";
import { callOpenRouter } from "@/lib/openrouter";
import { buildHardwareScenarioMessages, parseHardwareScenario, FALLBACK_HARDWARE_SCENARIOS } from "@/lib/hardwareLab";

export async function POST(request: Request) {
  const token = getCookieValue(request, SESSION_COOKIE_NAME);
  const session = token ? await verifySessionToken(token) : null;
  if (!session) {
    return NextResponse.json({ error: "Not logged in." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const brief = typeof body.brief === "string" && body.brief.trim() !== "" ? body.brief : undefined;

  try {
    const text = await callOpenRouter(buildHardwareScenarioMessages(brief));
    const scenario = parseHardwareScenario(text);
    return NextResponse.json({ scenario, fallback: false }, { status: 200 });
  } catch {
    // The lab must always work — rate limits and malformed JSON fall back to canned jobs.
    const scenario = FALLBACK_HARDWARE_SCENARIOS[Math.floor(Math.random() * FALLBACK_HARDWARE_SCENARIOS.length)];
    return NextResponse.json({ scenario, fallback: true }, { status: 200 });
  }
}
