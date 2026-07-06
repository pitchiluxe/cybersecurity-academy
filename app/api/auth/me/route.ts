import { NextResponse } from "next/server";
import { getCookieValue, verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/session";

export async function GET(request: Request) {
  const token = getCookieValue(request, SESSION_COOKIE_NAME);
  if (!token) {
    return NextResponse.json({ error: "Not logged in." }, { status: 401 });
  }

  const session = await verifySessionToken(token);
  if (!session) {
    return NextResponse.json({ error: "Not logged in." }, { status: 401 });
  }

  return NextResponse.json({ user: { id: session.userId, email: session.email } }, { status: 200 });
}
