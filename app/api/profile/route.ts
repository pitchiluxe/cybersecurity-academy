import { NextResponse } from "next/server";
import { getCookieValue, verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/session";
import { CERT_MIN_GRADE, CERT_MIN_TICKETS, TRACKS, type Course } from "@/lib/courses";
import {
  countQualifyingTickets,
  getCertificates,
  getCourseRow,
  getPassedModuleIndexes,
  getTicketStats,
} from "@/lib/db";

export async function GET(request: Request) {
  const token = getCookieValue(request, SESSION_COOKIE_NAME);
  const session = token ? await verifySessionToken(token) : null;
  if (!session) {
    return NextResponse.json({ error: "Not logged in." }, { status: 401 });
  }

  const certs = new Map(getCertificates(session.userId).map((c) => [c.track, c]));

  const tracks = TRACKS.map((t) => {
    const row = getCourseRow(session.userId, t.id);
    let modulesPassed = 0;
    let totalModules = 0;
    if (row) {
      totalModules = (JSON.parse(row.content_json) as Course).modules.length;
      modulesPassed = getPassedModuleIndexes(row.id).length;
    }
    const cert = certs.get(t.id);
    return {
      id: t.id,
      title: t.title,
      description: t.description,
      tier: t.tier,
      started: row !== undefined,
      modulesPassed,
      totalModules,
      qualifyingTickets: countQualifyingTickets(session.userId, t.categories, CERT_MIN_GRADE),
      requiredTickets: CERT_MIN_TICKETS,
      certificate: cert ? { certCode: cert.cert_code, issuedAt: cert.issued_at } : null,
    };
  });

  return NextResponse.json({ email: session.email, tracks, stats: getTicketStats(session.userId) }, { status: 200 });
}
