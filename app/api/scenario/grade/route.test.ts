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
  return new Request("http://localhost/api/scenario/grade", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  mockedCall.mockReset();
});

describe("POST /api/scenario/grade", () => {
  it("returns 400 when seed is missing", async () => {
    const res = await POST(makeRequest({ transcript: [] }));
    expect(res.status).toBe(400);
  });

  it("returns the parsed grade result plus the root cause on success", async () => {
    mockedCall.mockResolvedValue(
      JSON.stringify({
        score: 90,
        resolved: true,
        rubric: [{ item: "Asked clarifying questions", met: true, note: "Good questions up front." }],
        feedback: "Great diagnostic path overall.",
      })
    );

    const res = await POST(makeRequest({ seed, transcript: [] }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.result.score).toBe(90);
    expect(body.rootCause).toBe(seed.rootCause);
  });

  it("retries once on malformed JSON and succeeds on the second attempt", async () => {
    mockedCall
      .mockResolvedValueOnce("nope")
      .mockResolvedValueOnce(
        JSON.stringify({ score: 60, resolved: false, rubric: [], feedback: "Needs more verification steps." })
      );

    const res = await POST(makeRequest({ seed, transcript: [] }));
    expect(res.status).toBe(200);
    expect(mockedCall).toHaveBeenCalledTimes(2);
  });

  it("returns 502 when both attempts return malformed JSON", async () => {
    mockedCall.mockResolvedValue("still nope");
    const res = await POST(makeRequest({ seed, transcript: [] }));
    expect(res.status).toBe(502);
  });
});
