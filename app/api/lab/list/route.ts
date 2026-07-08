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

  try {
    const text = await callOpenRouter(buildLabCatalogMessages());
    const labs = parseLabCatalog(text);
    return NextResponse.json({ labs, fallback: false }, { status: 200 });
  } catch {
    // The lab board must always work — rate limits and malformed JSON fall back to the canned catalog.
    return NextResponse.json({ labs: FALLBACK_LAB_CATALOG, fallback: true }, { status: 200 });
  }
}
