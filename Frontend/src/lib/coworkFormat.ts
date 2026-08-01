// Wording shared by the cowork lobby and room header.

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;

/** "23h", "4h", "14m", or "any moment" once the clock has effectively run out. */
export function formatExpiresIn(expiresAt: string, now = Date.now()): string {
  const remaining = new Date(expiresAt).getTime() - now;
  if (remaining <= MINUTE_MS) {
    return "any moment";
  }
  if (remaining < HOUR_MS) {
    return `${Math.round(remaining / MINUTE_MS)}m`;
  }
  return `${Math.floor(remaining / HOUR_MS)}h`;
}

/** A room in its last quarter hour warrants the expiry banner. */
export function isExpiringSoon(expiresAt: string, now = Date.now()): boolean {
  return new Date(expiresAt).getTime() - now <= 15 * MINUTE_MS;
}

/** "42:10 elapsed" style clock for how long someone has been in a room. */
export function formatElapsed(sinceMs: number, now = Date.now()): string {
  const seconds = Math.max(0, Math.floor((now - sinceMs) / 1000));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;
  const pad = (value: number) => String(value).padStart(2, "0");
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(rest)}` : `${minutes}:${pad(rest)}`;
}

/** "Sharad Bhamidipati" → "SB"; single names fall back to one letter. */
export function initialsOf(name: string | undefined): string {
  const letters = (name ?? "")
    .trim()
    .split(/\s+/)
    .map(part => part[0])
    .filter(char => char && /\p{L}/u.test(char));
  return letters.length === 0 ? "?" : letters.slice(0, 2).join("").toUpperCase();
}
