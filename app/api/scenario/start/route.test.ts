import { POST } from "./route";
import * as openrouter from "@/lib/openrouter";

jest.mock("@/lib/openrouter", () => {
  const actual = jest.requireActual("@/lib/openrouter");
  return { ...actual, callOpenRouter: jest.fn() };
});

const mockedCall = openrouter.callOpenRouter as jest.Mock;

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/scenario/start", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  mockedCall.mockReset();
});

describe("POST /api/scenario/start", () => {
  it("returns 400 for an unknown category", async () => {
    const res = await POST(makeRequest({ category: "spaceship" }));
    expect(res.status).toBe(400);
  });

  it("returns a parsed seed for a valid category", async () => {
    mockedCall.mockResolvedValue(
      JSON.stringify({
        persona: { name: "Maria Chen", department: "Marketing" },
        environment: { os: "Windows 11", device: "Latitude 5540", detail: "GlobalProtect 6.2.1" },
        rootCause: "TAP adapter driver corrupted by cumulative update",
        openingMessage: "My VPN won't connect this morning.",
      })
    );

    const res = await POST(makeRequest({ category: "network" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.seed.category).toBe("network");
    expect(body.seed.persona.name).toBe("Maria Chen");
  });

  it("retries once on malformed JSON and succeeds on the second attempt", async () => {
    mockedCall
      .mockResolvedValueOnce("not json at all")
      .mockResolvedValueOnce(
        JSON.stringify({
          persona: { name: "Alex Kim", department: "Finance" },
          environment: { os: "macOS 14", device: "MacBook Pro", detail: "n/a" },
          rootCause: "Corrupted font cache",
          openingMessage: "Excel keeps crashing when I open any file.",
        })
      );

    const res = await POST(makeRequest({ category: "app-crash" }));
    expect(res.status).toBe(200);
    expect(mockedCall).toHaveBeenCalledTimes(2);
  });

  it("returns 502 when both attempts return malformed JSON", async () => {
    mockedCall.mockResolvedValue("still not json");
    const res = await POST(makeRequest({ category: "network" }));
    expect(res.status).toBe(502);
    expect(mockedCall).toHaveBeenCalledTimes(2);
  });

  it("returns 503 when the API key is missing", async () => {
    mockedCall.mockRejectedValue(new openrouter.MissingApiKeyError());
    const res = await POST(makeRequest({ category: "network" }));
    expect(res.status).toBe(503);
  });
});
