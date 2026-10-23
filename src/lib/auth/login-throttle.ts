import "server-only";
import { createHash } from "node:crypto";

/** Per-process backstop. Multi-instance deployments also need an edge/WAF
 * rate limit: local memory alone is not a distributed abuse boundary. */
const attempts = new Map<string, { count: number; until: number }>();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_KEYS = 10000;

export function reserveLoginAttempt(email: string, now = Date.now()): boolean {
  const key = createHash("sha256").update(email).digest("hex");
  const previous = attempts.get(key);
  if (previous && previous.until > now) {
    if (previous.count >= 10) return false;
    previous.count++;
    return true;
  }
  if (attempts.size >= MAX_KEYS) {
    for (const [entry, state] of attempts)
      if (state.until <= now) attempts.delete(entry);
    // Bound memory without evicting still-active limits under address flooding.
    if (attempts.size >= MAX_KEYS) return false;
  }
  attempts.set(key, { count: 1, until: now + WINDOW_MS });
  return true;
}

export function clearLoginAttempts(email: string) {
  attempts.delete(createHash("sha256").update(email).digest("hex"));
}
