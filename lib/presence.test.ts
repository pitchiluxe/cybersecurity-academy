import { countOnline, PRESENCE_WINDOW_MS, HEARTBEAT_INTERVAL_MS } from "./presence";

describe("countOnline", () => {
  const now = 1_000_000_000;

  it("counts timestamps within the window", () => {
    const seen = [now - 1000, now - PRESENCE_WINDOW_MS, now - PRESENCE_WINDOW_MS - 1];
    expect(countOnline(seen, now)).toBe(2);
  });

  it("returns 0 for empty input", () => {
    expect(countOnline([], now)).toBe(0);
  });

  it("heartbeat interval is comfortably inside the window", () => {
    expect(HEARTBEAT_INTERVAL_MS).toBeLessThan(PRESENCE_WINDOW_MS);
  });
});
