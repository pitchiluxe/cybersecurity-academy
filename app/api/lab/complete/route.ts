import { NextResponse } from "next/server";
import { getCookieValue, verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/session";
import { recordTicketResult } from "@/lib/db";
import { checkCertsForCategory } from "@/lib/certification";
import type { ScenarioCategory } from "@/lib/types";

const KIND_CATEGORY: Record<string, ScenarioCategory> = {
  wiring: "network",
  fortigate: "firewall",
};

export async function POST(request: Request) {
  const token = getCookieValue(request, SESSION_COOKIE_NAME);
  const session = token ? await verifySessionToken(token) : null;
  if (!session) {
    return NextResponse.json({ error: "Not logged in." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const kind = body?.kind;
  const score = body?.score;
  const category = typeof kind === "string" ? KIND_CATEGORY[kind] : undefined;
  if (!category || typeof score !== "number" || score < 0 || score > 100) {
    return NextResponse.json({ error: "kind and score (0-100) required" }, { status: 400 });
  }

  await recordTicketResult(session.userId, category, Math.round(score));
  const newCertificates = await checkCertsForCategory(session.userId, category);
  return NextResponse.json({ recorded: true, newCertificates }, { status: 200 });
}
