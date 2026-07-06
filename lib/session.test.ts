import { SignJWT } from "jose";
import { NextResponse } from "next/server";
import {
  createSessionToken,
  verifySessionToken,
  getCookieValue,
  setSessionCookie,
  clearSessionCookie,
  SESSION_COOKIE_NAME,
} from "./session";

const ORIGINAL_ENV = process.env;

beforeEach(() => {
  process.env = { ...ORIGINAL_ENV, AUTH_SECRET: "test-secret-at-least-32-bytes-long-ok" };
});

afterEach(() => {
  process.env = ORIGINAL_ENV;
});

describe("createSessionToken / verifySessionToken", () => {
  it("round-trips a payload through a signed token", async () => {
    const token = await createSessionToken({ userId: 42, email: "a@b.com" });
    const payload = await verifySessionToken(token);
    expect(payload).toEqual({ userId: 42, email: "a@b.com" });
  });

  it("returns null for a garbage token", async () => {
    const payload = await verifySessionToken("not-a-real-token");
    expect(payload).toBeNull();
  });

  it("returns null for a token signed with a different secret", async () => {
    const key = new TextEncoder().encode("a-completely-different-secret-value");
    const token = await new SignJWT({ userId: 1, email: "x@y.com" })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("30d")
      .sign(key);
    const payload = await verifySessionToken(token);
    expect(payload).toBeNull();
  });

  it("returns null for an expired token", async () => {
    const key = new TextEncoder().encode(process.env.AUTH_SECRET as string);
    const expiredToken = await new SignJWT({ userId: 1, email: "x@y.com" })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime(Math.floor(Date.now() / 1000) - 10)
      .sign(key);
    const payload = await verifySessionToken(expiredToken);
    expect(payload).toBeNull();
  });
});

describe("setSessionCookie", () => {
  const ORIGINAL_NODE_ENV = process.env.NODE_ENV;

  afterEach(() => {
    Object.defineProperty(process.env, "NODE_ENV", { value: ORIGINAL_NODE_ENV, configurable: true });
  });

  it("sets the secure flag when NODE_ENV is production", () => {
    Object.defineProperty(process.env, "NODE_ENV", { value: "production", configurable: true });
    const res = NextResponse.json({ ok: true });
    setSessionCookie(res, "token-value");
    expect(res.headers.get("set-cookie")).toContain("Secure");
  });

  it("does not set the secure flag when NODE_ENV is not production", () => {
    Object.defineProperty(process.env, "NODE_ENV", { value: "test", configurable: true });
    const res = NextResponse.json({ ok: true });
    setSessionCookie(res, "token-value");
    expect(res.headers.get("set-cookie")).not.toContain("Secure");
  });
});

describe("clearSessionCookie", () => {
  const ORIGINAL_NODE_ENV = process.env.NODE_ENV;

  afterEach(() => {
    Object.defineProperty(process.env, "NODE_ENV", { value: ORIGINAL_NODE_ENV, configurable: true });
  });

  it("clears the cookie with an empty value and Max-Age=0", () => {
    const res = NextResponse.json({ ok: true });
    clearSessionCookie(res);
    const setCookie = res.headers.get("set-cookie");
    expect(setCookie).toContain(`${SESSION_COOKIE_NAME}=;`);
    expect(setCookie).toContain("Max-Age=0");
  });

  it("sets the secure flag when NODE_ENV is production", () => {
    Object.defineProperty(process.env, "NODE_ENV", { value: "production", configurable: true });
    const res = NextResponse.json({ ok: true });
    clearSessionCookie(res);
    expect(res.headers.get("set-cookie")).toContain("Secure");
  });

  it("does not set the secure flag when NODE_ENV is not production", () => {
    Object.defineProperty(process.env, "NODE_ENV", { value: "test", configurable: true });
    const res = NextResponse.json({ ok: true });
    clearSessionCookie(res);
    expect(res.headers.get("set-cookie")).not.toContain("Secure");
  });
});

describe("getCookieValue", () => {
  it("extracts a named cookie from the Cookie header", () => {
    const request = new Request("http://localhost/", {
      headers: { cookie: `other=1; ${SESSION_COOKIE_NAME}=abc123; another=2` },
    });
    expect(getCookieValue(request, SESSION_COOKIE_NAME)).toBe("abc123");
  });

  it("returns undefined when the cookie is absent", () => {
    const request = new Request("http://localhost/", { headers: { cookie: "other=1" } });
    expect(getCookieValue(request, SESSION_COOKIE_NAME)).toBeUndefined();
  });

  it("returns undefined when there is no Cookie header at all", () => {
    const request = new Request("http://localhost/");
    expect(getCookieValue(request, SESSION_COOKIE_NAME)).toBeUndefined();
  });
});
