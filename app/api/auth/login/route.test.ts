// app/api/auth/login/route.test.ts
import { POST } from "./route";
import * as db from "@/lib/db";
import * as auth from "@/lib/auth";
import { hashPassword } from "@/lib/auth";

jest.mock("@/lib/db");

// verifyPassword is wrapped in a jest.fn() that still calls through to the real
// bcrypt-backed implementation, so existing tests keep their real hashing/verification
// behavior while we gain the ability to assert on call counts (needed for the
// timing-side-channel regression test below).
jest.mock("@/lib/auth", () => {
  const actual = jest.requireActual("@/lib/auth");
  return { ...actual, verifyPassword: jest.fn(actual.verifyPassword) };
});

const mockedFindUserByEmail = db.findUserByEmail as jest.Mock;
const mockedVerifyPassword = auth.verifyPassword as jest.Mock;

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/auth/login", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

const ORIGINAL_ENV = process.env;

beforeEach(() => {
  process.env = { ...ORIGINAL_ENV, AUTH_SECRET: "test-secret-at-least-32-bytes-long-ok" };
  mockedFindUserByEmail.mockReset();
  mockedVerifyPassword.mockClear();
});

afterEach(() => {
  process.env = ORIGINAL_ENV;
});

describe("POST /api/auth/login", () => {
  it("returns 401 when no user has that email", async () => {
    mockedFindUserByEmail.mockReturnValue(undefined);
    const res = await POST(makeRequest({ email: "nobody@b.com", password: "whatever1" }));
    expect(res.status).toBe(401);
  });

  it("returns 401 when the password is wrong", async () => {
    const hash = await hashPassword("correct-password");
    mockedFindUserByEmail.mockReturnValue({ id: 1, email: "a@b.com", password_hash: hash, created_at: "now" });
    const res = await POST(makeRequest({ email: "a@b.com", password: "wrong-password" }));
    expect(res.status).toBe(401);
  });

  it("returns 200 with a session cookie on a correct password", async () => {
    const hash = await hashPassword("correct-password");
    mockedFindUserByEmail.mockReturnValue({ id: 1, email: "a@b.com", password_hash: hash, created_at: "now" });
    const res = await POST(makeRequest({ email: "a@b.com", password: "correct-password" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.user).toEqual({ id: 1, email: "a@b.com" });
    expect(res.headers.get("set-cookie")).toContain("session=");
  });

  it("still runs a bcrypt comparison when no user exists (timing side-channel defense)", async () => {
    mockedFindUserByEmail.mockReturnValue(undefined);
    const res = await POST(makeRequest({ email: "nobody@b.com", password: "whatever1" }));
    expect(res.status).toBe(401);
    expect(mockedVerifyPassword).toHaveBeenCalledTimes(1);
  });
});
