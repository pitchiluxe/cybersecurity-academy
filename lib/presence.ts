// A user counts as online if their last heartbeat is at most this old.
export const PRESENCE_WINDOW_MS = 75_000;
// Client heartbeat cadence; 2x margin under the window tolerates one missed ping.
export const HEARTBEAT_INTERVAL_MS = 30_000;

export function countOnline(lastSeens: number[], now: number): number {
  return lastSeens.filter((t) => now - t <= PRESENCE_WINDOW_MS).length;
}
