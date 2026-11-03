/**
 * HaveIBeenPwned range API (k-anonymity).
 *
 * Only the first 5 hex characters of the SHA-1 hash leave the browser; the
 * service returns every hash suffix starting with that prefix and the match
 * is checked locally. The password itself is never transmitted.
 * https://haveibeenpwned.com/API/v3#PwnedPasswords
 */
export type BreachResult =
  | { status: 'found'; occurrences: number }
  | { status: 'clear' }
  | { status: 'unavailable' };

const encoder = new TextEncoder();

/**
 * Result cache - one page's scan is reused by the others (dashboard, audit)
 * for the rest of the SPA session. `inflight` dedupes *concurrent* calls:
 * React StrictMode double-mounts, two pages scanning at once, or the same
 * password on several findings all share a single request.
 */
const resultCache = new Map<string, BreachResult>();
const inflight = new Map<string, Promise<BreachResult>>();

async function sha1Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-1', encoder.encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('').toUpperCase();
}

async function fetchBreached(password: string): Promise<BreachResult> {
  try {
    const hash = await sha1Hex(password);
    const prefix = hash.slice(0, 5);
    const suffix = hash.slice(5);

    const response = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: { 'Add-Padding': 'true' },
    });
    if (!response.ok) return { status: 'unavailable' };

    const body = await response.text();
    for (const line of body.split('\n')) {
      const [hashSuffix, count] = line.trim().split(':');
      if (hashSuffix === suffix) {
        return { status: 'found', occurrences: Number(count ?? 0) };
      }
    }
    return { status: 'clear' };
  } catch {
    return { status: 'unavailable' };
  }
}

export function checkPasswordBreached(password: string): Promise<BreachResult> {
  const cached = resultCache.get(password);
  if (cached) return Promise.resolve(cached);
  const running = inflight.get(password);
  if (running) return running;

  const pending = fetchBreached(password).then((result) => {
    inflight.delete(password);
    // Transient failures are not cached - the next scan retries them.
    if (result.status !== 'unavailable') resultCache.set(password, result);
    return result;
  });
  inflight.set(password, pending);
  return pending;
}
