import { NextResponse } from "next/server";
import { createUser, findUserByEmail } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { createSessionToken, setSessionCookie } from "@/lib/session";

const MAX_PASSWORD_LENGTH = 72;

function isValidEmail(value: unknown): value is string {
  return typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const { email, password } = (body ?? {}) as { email?: unknown; password?: unknown };

  if (!isValidEmail(email)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }
  if (typeof password !== "string" || password.length < 8) {
    return NextResponse.json({ error: "Passwords must be at least 8 characters." }, { status: 400 });
  }
  if (Buffer.byteLength(password, "utf8") > MAX_PASSWORD_LENGTH) {
    return NextResponse.json(
      { error: "Passwords must be 72 bytes or fewer (most passwords are well under this)." },
      { status: 400 },
    );
  }
  if (await findUserByEmail(email)) {
    return NextResponse.json({ error: "That email's already registered." }, { status: 409 });
  }

  const passwordHash = await hashPassword(password);

  let user;
  try {
    user = await createUser(email, passwordHash);
  } catch {
    return NextResponse.json({ error: "That email's already registered." }, { status: 409 });
  }

  const token = await createSessionToken({ userId: user.id, email: user.email });

  const res = NextResponse.json({ user: { id: user.id, email: user.email } }, { status: 201 });
  setSessionCookie(res, token);
  return res;
}
