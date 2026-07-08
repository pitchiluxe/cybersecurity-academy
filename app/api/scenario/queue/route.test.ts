import { POST } from "./route";
import * as openrouter from "@/lib/openrouter";

jest.mock("@/lib/openrouter", () => {
  const actual = jest.requireActual("@/lib/openrouter");
  return { ...actual, callOpenRouter: jest.fn() };
});

const mockedCall = openrouter.callOpenRouter as jest.Mock;

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/scenario/queue", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

const validQueue = [
  {
    category: "network",
    persona: { name: "Maria Chen", department: "Marketing" },
    environment: { os: "Windows 11", device: "Latitude 5540", detail: "GlobalProtect 6.2.1" },
    rootCause: "TAP adapter driver corrupted by cumulative update",
    openingMessage: "My VPN won't connect this morning.",
  },
  {
    category: "printer",
    persona: { name: "Alex Kim", department: "Finance" },
    environment: { os: "macOS 14", device: "MacBook Pro", detail: "n/a" },
    rootCause: "Print spooler service crashed",
    openingMessage: "Nothing prints, the queue just sits there.",
  },
];

beforeEach(() => {
  mockedCall.mockReset();
});

describe("POST /api/scenario/queue", () => {
  it("returns tickets with a ticketId and priority attached to each parsed seed", async () => {
    mockedCall.mockResolvedValue(JSON.stringify(validQueue));

    const res = await POST(makeRequest({ count: 2 }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.tickets).toHaveLength(2);
    expect(body.tickets[0].category).toBe("network");
    expect(body.tickets[0].ticketId).toEqual(expect.any(String));
    expect(["P1", "P2", "P3"]).toContain(body.tickets[0].priority);
  });

  it("retries once on malformed JSON and succeeds on the second attempt", async () => {
    mockedCall.mockResolvedValueOnce("not json at all").mockResolvedValueOnce(JSON.stringify(validQueue));

    const res = await POST(makeRequest({ count: 2 }));
    expect(res.status).toBe(200);
    expect(mockedCall).toHaveBeenCalledTimes(2);
  });

  it("falls back to the built-in scenario bank when both attempts return malformed JSON", async () => {
    mockedCall.mockResolvedValue("still not json");
    const res = await POST(makeRequest({ count: 2 }));
    expect(res.status).toBe(200);
    expect(mockedCall).toHaveBeenCalledTimes(2);
    const body = await res.json();
    expect(body.fallback).toBe(true);
    expect(body.tickets).toHaveLength(2);
    expect(body.tickets[0].ticketId).toEqual(expect.any(String));
    expect(["P1", "P2", "P3"]).toContain(body.tickets[0].priority);
  });

  it("falls back to the built-in scenario bank when the API key is missing", async () => {
    mockedCall.mockRejectedValue(new openrouter.MissingApiKeyError());
    const res = await POST(makeRequest({ count: 9 }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.fallback).toBe(true);
    expect(body.tickets.length).toBeGreaterThanOrEqual(6);
  });

  it("falls back to the built-in scenario bank on a provider error such as a rate limit", async () => {
    mockedCall.mockRejectedValue(new openrouter.OpenRouterRequestError(429, "OpenRouter request failed (429): rate limited"));
    const res = await POST(makeRequest({ count: 3 }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.fallback).toBe(true);
    expect(body.tickets).toHaveLength(3);
  });

  it("defaults to a random count between 5 and 10 when not provided", async () => {
    mockedCall.mockResolvedValue(JSON.stringify(validQueue));
    await POST(makeRequest({}));
    const [messages] = mockedCall.mock.calls[0];
    const system = messages.find((m: { role: string }) => m.role === "system");
    const m = system.content.match(/queue of (\d+) training tickets/);
    expect(m).not.toBeNull();
    const count = Number(m[1]);
    expect(count).toBeGreaterThanOrEqual(5);
    expect(count).toBeLessThanOrEqual(10);
  });
});
