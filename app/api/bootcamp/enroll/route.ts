import { NextResponse } from "next/server";
import { getCookieValue, verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/session";
import { isBootcampId, skillsForBootcamp } from "@/lib/bootcamp";
import { enrollBootcamp, getBootcampProgress } from "@/lib/db";
import { getBootcampCertificate } from "@/lib/certification";

// First visit records the trainee's real start date; later visits return it
// along with saved chapter/lab progress and any earned certificate.
export async function POST(request: Request) {
  const token = getCookieValue(request, SESSION_COOKIE_NAME);
  const session = token ? await verifySessionToken(token) : null;
  if (!session) {
    return NextResponse.json({ error: "Not logged in." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const camp = body?.camp;
  if (!isBootcampId(camp)) {
    return NextResponse.json({ error: "Unknown bootcamp" }, { status: 400 });
  }

  const startedAt = await enrollBootcamp(session.userId, camp);
  const progress = await getBootcampProgress(session.userId, skillsForBootcamp(camp).map((s) => s.id));
  const certificate = await getBootcampCertificate(session.userId, camp);

  return NextResponse.json(
    {
      startedAt,
      progress,
      certificate: certificate ? { code: certificate.cert_code, issuedAt: certificate.issued_at } : null,
    },
    { status: 200 }
  );
}
