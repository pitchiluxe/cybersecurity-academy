import { NextResponse } from "next/server";
import { getCookieValue, verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/session";
import { callOpenRouter } from "@/lib/openrouter";
import { buildLabCatalogMessages, parseLabCatalog, FALLBACK_LAB_CATALOG } from "@/lib/labCatalog";

export async function POST(request: Request) {
  const token = getCookieValue(request, SESSION_COOKIE_NAME);
  const session = token ? await verifySessionToken(token) : null;
  if (!session) {
    return NextResponse.json({ error: "Not logged in." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const topic = typeof body?.topic === "string" && body.topic.trim() !== "" ? body.topic.trim().slice(0, 120) : undefined;

  try {
    const text = await callOpenRouter(buildLabCatalogMessages(topic));
    const labs = parseLabCatalog(text);
    return NextResponse.json({ labs, fallback: false }, { status: 200 });
  } catch {
    // The lab board must always work — rate limits and malformed JSON fall back to the canned catalog.
    return NextResponse.json({ labs: FALLBACK_LAB_CATALOG, fallback: true }, { status: 200 });
  }
}
