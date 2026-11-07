import type { DecryptedSecret } from '@/types/api';

const DAY_MS = 24 * 60 * 60 * 1000;
/** The axis covers the trailing year; anything older clamps to the left edge. */
export const ROTATION_WINDOW_DAYS = 365;

export interface AgeBucket {
  label: string;
  max: number;
  color: string;
}

export const BUCKETS: readonly AgeBucket[] = [
  { label: '<30d', max: 30, color: 'var(--color-success)' },
  { label: '30-90d', max: 90, color: 'var(--color-primary)' },
  { label: '90-180d', max: 180, color: 'var(--color-warning)' },
  { label: '180d+', max: Infinity, color: 'var(--color-danger)' },
];

export function bucketOf(days: number): AgeBucket {
  return BUCKETS.find((bucket) => days <= bucket.max) ?? BUCKETS[BUCKETS.length - 1]!;
}

export interface RotationPoint {
  secret: DecryptedSecret;
  /** 0..1 position along the trailing-year axis. */
  x: number;
  /** 0..2 vertical lane to reduce marker overlap. */
  lane: number;
  bucket: AgeBucket;
}

export interface RotationTimeline {
  points: RotationPoint[];
  counts: number[];
  oldest: DecryptedSecret | null;
}

/**
 * One point per secret placed by `updatedAt` on a trailing-12-month axis.
 * This is "last changed", not a version-diff rotation check - diffing every
 * version would mean decrypting each snapshot, too heavy for a dashboard card.
 */
export function rotationTimeline(secrets: DecryptedSecret[]): RotationTimeline {
  const now = Date.now();
  const start = now - ROTATION_WINDOW_DAYS * DAY_MS;
  const counts = BUCKETS.map(() => 0);

  const points = secrets
    .map((secret, index) => {
      const at = Date.parse(secret.updatedAt);
      const ageDays = Math.max(0, (now - at) / DAY_MS);
      const bucket = bucketOf(ageDays);
      counts[BUCKETS.indexOf(bucket)] = (counts[BUCKETS.indexOf(bucket)] ?? 0) + 1;
      const x = Math.min(1, Math.max(0, (at - start) / (now - start)));
      return { secret, x, lane: index % 3, bucket };
    })
    .sort((a, b) => a.x - b.x);

  return { points, counts, oldest: points[0]?.secret ?? null };
}
