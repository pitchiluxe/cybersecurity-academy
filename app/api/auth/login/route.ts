import { NextResponse } from "next/server";
import { findUserByEmail } from "@/lib/db";
import { verifyPassword } from "@/lib/auth";
import { createSessionToken, setSessionCookie } from "@/lib/session";

const INVALID_CREDENTIALS_MESSAGE = "Wrong email or password.";

// A precomputed bcrypt hash with no known matching plaintext. Used as a decoy so that
// verifyPassword always runs at the same cost whether or not the user exists — this
// prevents a timing side-channel that would otherwise let an attacker distinguish
// "no such user" (fast) from "wrong password" (slow, bcrypt.compare) by response time.
const DUMMY_PASSWORD_HASH = "$2b$10$fJe5ach32nLg.iyhRbI7U.3EeoVYuvbEdnkgpQsw6LQ0k0AcJLBmy";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const { email, password } = (body ?? {}) as { email?: unknown; password?: unknown };

  if (typeof email !== "string" || typeof password !== "string") {
    return NextResponse.json({ error: INVALID_CREDENTIALS_MESSAGE }, { status: 401 });
  }

  const user = findUserByEmail(email);
  const valid = await verifyPassword(password, user?.password_hash ?? DUMMY_PASSWORD_HASH);
  if (!user || !valid) {
    return NextResponse.json({ error: INVALID_CREDENTIALS_MESSAGE }, { status: 401 });
  }

  const token = await createSessionToken({ userId: user.id, email: user.email });
  const res = NextResponse.json({ user: { id: user.id, email: user.email } }, { status: 200 });
  setSessionCookie(res, token);
  return res;
}
