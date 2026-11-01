/** Extracts a hostname from a user-entered URL (scheme optional). */
export function hostnameOf(url: string | undefined): string | null {
  if (!url) return null;
  try {
    const host = new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`).hostname;
    return host && host.includes('.') ? host : null;
  } catch {
    return null;
  }
}
