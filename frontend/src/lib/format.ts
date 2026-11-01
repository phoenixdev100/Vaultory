const relative = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });

const DIVISIONS: Array<{ amount: number; unit: Intl.RelativeTimeFormatUnit }> = [
  { amount: 60, unit: 'second' },
  { amount: 60, unit: 'minute' },
  { amount: 24, unit: 'hour' },
  { amount: 7, unit: 'day' },
  { amount: 4.34524, unit: 'week' },
  { amount: 12, unit: 'month' },
  { amount: Number.POSITIVE_INFINITY, unit: 'year' },
];

/** "3 minutes ago" without pulling in a date library. */
export function formatRelative(value: string | Date): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  let duration = (date.getTime() - Date.now()) / 1000;

  for (const division of DIVISIONS) {
    if (Math.abs(duration) < division.amount) {
      return relative.format(Math.round(duration), division.unit);
    }
    duration /= division.amount;
  }
  return relative.format(Math.round(duration), 'year');
}

export function formatDateTime(value: string | Date): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

/** Whole days elapsed since an ISO timestamp (negative for future dates). */
export function daysSince(value: string | Date): number {
  const date = typeof value === 'string' ? new Date(value) : value;
  return (Date.now() - date.getTime()) / (24 * 60 * 60 * 1000);
}

/** Shortens a long value for display without revealing the middle. */
export function truncateMiddle(value: string, max = 42): string {
  if (value.length <= max) return value;
  const head = Math.ceil((max - 1) / 2);
  const tail = Math.floor((max - 1) / 2);
  return `${value.slice(0, head)}…${value.slice(value.length - tail)}`;
}
