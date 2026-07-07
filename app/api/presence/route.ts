import { NextResponse } from "next/server";
import { getCookieValue, verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/session";
import { upsertPresence, getPresenceTimestamps } from "@/lib/db";
import { countOnline } from "@/lib/presence";

export async function POST(request: Request) {
  const token = getCookieValue(request, SESSION_COOKIE_NAME);
  const session = token ? await verifySessionToken(token) : null;
  if (!session) {
    return NextResponse.json({ error: "Not logged in." }, { status: 401 });
  }

  const now = Date.now();
  upsertPresence(session.userId, now);
  return NextResponse.json({ online: countOnline(getPresenceTimestamps(), now) }, { status: 200 });
}
