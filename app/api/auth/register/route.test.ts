// app/api/auth/register/route.test.ts
import { POST } from "./route";
import * as db from "@/lib/db";

jest.mock("@/lib/db");

const mockedFindUserByEmail = db.findUserByEmail as jest.Mock;
const mockedCreateUser = db.createUser as jest.Mock;

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/auth/register", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

const ORIGINAL_ENV = process.env;

beforeEach(() => {
  process.env = { ...ORIGINAL_ENV, AUTH_SECRET: "test-secret-at-least-32-bytes-long-ok" };
  mockedFindUserByEmail.mockReset();
  mockedCreateUser.mockReset();
});

afterEach(() => {
  process.env = ORIGINAL_ENV;
});

describe("POST /api/auth/register", () => {
  it("returns 400 for an invalid email", async () => {
    const res = await POST(makeRequest({ email: "not-an-email", password: "longenough" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for a password under 8 characters", async () => {
    const res = await POST(makeRequest({ email: "a@b.com", password: "short" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for a password over 72 characters", async () => {
    const res = await POST(makeRequest({ email: "a@b.com", password: "a".repeat(73) }));
    expect(res.status).toBe(400);
  });

  it("returns 409 when the email is already registered", async () => {
    mockedFindUserByEmail.mockReturnValue({ id: 1, email: "a@b.com", password_hash: "x", created_at: "now" });
    const res = await POST(makeRequest({ email: "a@b.com", password: "longenough" }));
    expect(res.status).toBe(409);
  });

  it("creates the user, sets a session cookie, and returns 201", async () => {
    mockedFindUserByEmail.mockReturnValue(undefined);
    mockedCreateUser.mockReturnValue({ id: 7, email: "new@b.com", password_hash: "hashed", created_at: "now" });

    const res = await POST(makeRequest({ email: "new@b.com", password: "longenough" }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.user).toEqual({ id: 7, email: "new@b.com" });
    expect(mockedCreateUser).toHaveBeenCalledWith("new@b.com", expect.any(String));
    expect(res.headers.get("set-cookie")).toContain("session=");
  });
});
