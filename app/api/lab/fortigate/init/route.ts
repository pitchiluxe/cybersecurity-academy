import { NextResponse } from "next/server";
import { getCookieValue, verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/session";
import { callOpenRouter } from "@/lib/openrouter";
import { buildFortigateScenarioMessages, parseFortigateScenario, FALLBACK_FORTIGATE_SCENARIO } from "@/lib/fortigateLab";

export async function POST(request: Request) {
  const token = getCookieValue(request, SESSION_COOKIE_NAME);
  const session = token ? await verifySessionToken(token) : null;
  if (!session) {
    return NextResponse.json({ error: "Not logged in." }, { status: 401 });
  }

  try {
    const text = await callOpenRouter(buildFortigateScenarioMessages());
    const scenario = parseFortigateScenario(text);
    return NextResponse.json({ scenario, fallback: false }, { status: 200 });
  } catch {
    return NextResponse.json({ scenario: FALLBACK_FORTIGATE_SCENARIO, fallback: true }, { status: 200 });
  }
}
