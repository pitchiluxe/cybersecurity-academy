import { POST } from "./route";

describe("POST /api/auth/logout", () => {
  it("clears the session cookie and returns ok", async () => {
    const res = await POST();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true });
    expect(res.headers.get("set-cookie")).toContain("session=;");
  });
});
