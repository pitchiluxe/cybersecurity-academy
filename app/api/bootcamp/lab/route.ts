import { NextResponse } from "next/server";
import { getCookieValue, verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/session";
import { getBootcampSkill, isBootcampSkillId } from "@/lib/bootcamp";
import { markBootcampLabDone, recordTicketResult } from "@/lib/db";

// Called when the trainee genuinely resolves a bootcamp VM lab's hidden fault.
export async function POST(request: Request) {
  const token = getCookieValue(request, SESSION_COOKIE_NAME);
  const session = token ? await verifySessionToken(token) : null;
  if (!session) {
    return NextResponse.json({ error: "Not logged in." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const skillId = body?.skill;
  if (!isBootcampSkillId(skillId)) {
    return NextResponse.json({ error: "Unknown bootcamp skill" }, { status: 400 });
  }

  await markBootcampLabDone(session.userId, skillId);
  // Bootcamp labs also count toward the regular cert-lab requirements.
  await recordTicketResult(session.userId, getBootcampSkill(skillId)!.labSeed.category, 100);

  return NextResponse.json({ recorded: true }, { status: 200 });
}
