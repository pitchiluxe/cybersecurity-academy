import { GET } from "./route";
import { createSessionToken, SESSION_COOKIE_NAME } from "@/lib/session";

const ORIGINAL_ENV = process.env;

beforeEach(() => {
  process.env = { ...ORIGINAL_ENV, AUTH_SECRET: "test-secret-at-least-32-bytes-long-ok" };
});

afterEach(() => {
  process.env = ORIGINAL_ENV;
});

function makeRequest(cookieHeader?: string) {
  return new Request("http://localhost/api/auth/me", {
    headers: cookieHeader ? { cookie: cookieHeader } : {},
  });
}

describe("GET /api/auth/me", () => {
  it("returns 401 when there is no session cookie", async () => {
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
  });

  it("returns 401 when the session cookie is invalid", async () => {
    const res = await GET(makeRequest(`${SESSION_COOKIE_NAME}=garbage`));
    expect(res.status).toBe(401);
  });

  it("returns the user when the session cookie is valid", async () => {
    const token = await createSessionToken({ userId: 3, email: "a@b.com" });
    const res = await GET(makeRequest(`${SESSION_COOKIE_NAME}=${token}`));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.user).toEqual({ id: 3, email: "a@b.com" });
  });
});
