import { POST } from "./route";
import * as openrouter from "@/lib/openrouter";
import type { ScenarioSeed } from "@/lib/types";

jest.mock("@/lib/openrouter", () => {
  const actual = jest.requireActual("@/lib/openrouter");
  return { ...actual, callOpenRouter: jest.fn() };
});

const mockedCall = openrouter.callOpenRouter as jest.Mock;

const seed: ScenarioSeed = {
  category: "network",
  persona: { name: "Maria Chen", department: "Marketing" },
  environment: { os: "Windows 11", device: "Latitude 5540", detail: "GlobalProtect 6.2.1" },
  rootCause: "TAP adapter driver corrupted by cumulative update",
  openingMessage: "My VPN won't connect this morning.",
};

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/scenario/reply", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  mockedCall.mockReset();
});

describe("POST /api/scenario/reply", () => {
  it("returns 400 when seed is missing", async () => {
    const res = await POST(makeRequest({ transcript: [] }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when transcript is not an array", async () => {
    const res = await POST(makeRequest({ seed, transcript: "nope" }));
    expect(res.status).toBe(400);
  });

  it("returns the end-user's next message on success", async () => {
    mockedCall.mockResolvedValue("It says the network is unreachable.");
    const res = await POST(
      makeRequest({
        seed,
        transcript: [
          { role: "enduser", content: seed.openingMessage },
          { role: "tech", content: "What's the exact error message?" },
        ],
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.message).toBe("It says the network is unreachable.");
  });

  it("returns 503 when the API key is missing", async () => {
    mockedCall.mockRejectedValue(new openrouter.MissingApiKeyError());
    const res = await POST(makeRequest({ seed, transcript: [] }));
    expect(res.status).toBe(503);
  });

  it("returns 502 on an upstream request failure", async () => {
    mockedCall.mockRejectedValue(new openrouter.OpenRouterRequestError(429, "rate limited"));
    const res = await POST(makeRequest({ seed, transcript: [] }));
    expect(res.status).toBe(502);
  });
});
