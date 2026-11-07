import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BUCKETS, bucketOf, rotationTimeline } from '@/features/dashboard/rotation';
import { daysSince, formatRelative } from '@/lib/format';
import type { DecryptedSecret } from '@/types/api';

/**
 * Last-changed timeline: one dot per secret placed on a trailing-12-month
 * axis, coloured by age. Three lanes spread collisions without needing real
 * force layout. Honest label - this is `updatedAt`, not a decrypted-version
 * diff (that would cost one decrypt per secret per version).
 */
export function RotationTimelineCard({ secrets }: { secrets: DecryptedSecret[] }) {
  const { points, counts, oldest } = useMemo(() => rotationTimeline(secrets), [secrets]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-[15px]">Rotation timeline</CardTitle>
        <CardDescription>
          {secrets.length === 0
            ? 'Nothing saved yet'
            : `${secrets.length} item${secrets.length === 1 ? '' : 's'} by last change`}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {secrets.length === 0 ? (
          <p className="text-[13px] text-fg-subtle">Save a secret and its age shows up here.</p>
        ) : (
          <>
            <div className="relative h-14" role="img" aria-label="Timeline of when each secret last changed">
              <span className="absolute inset-x-0 top-1/2 h-px bg-line" aria-hidden />
              {points.map(({ secret, x, lane, bucket }) => (
                <Link
                  key={secret.id}
                  to={`/vault/${secret.id}`}
                  className="group absolute block"
                  style={{
                    left: `${x * 100}%`,
                    top: `${22 + lane * 9}%`,
                    transform: 'translateX(-50%)',
                  }}
                  title={`${secret.title} - ${formatRelative(secret.updatedAt)}`}
                >
                  <span className="block size-2.5 rounded-full ring-2 ring-surface transition-transform group-hover:scale-150" style={{ background: bucket.color }} />
                </Link>
              ))}
            </div>
            <div className="flex items-center justify-between text-[10px] text-fg-subtle">
              <span>1y ago</span>
              <span>today</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {BUCKETS.map((bucket, index) => (
                <span
                  key={bucket.label}
                  className="flex items-center gap-1.5 rounded-full border border-line px-2 py-0.5 text-[11px] text-fg-muted"
                >
                  <span className="size-2 rounded-full" style={{ background: bucket.color }} />
                  {bucket.label} · {counts[index] ?? 0}
                </span>
              ))}
            </div>
            {oldest ? (
              <p className="flex items-center gap-1.5 text-[12px] text-fg-subtle">
                <span
                  className="size-2 shrink-0 rounded-full"
                  style={{ background: bucketOf(daysSince(oldest.updatedAt)).color }}
                />
                Oldest unchanged:{' '}
                <Link to={`/vault/${oldest.id}`} className="truncate font-medium text-fg-muted hover:underline">
                  {oldest.title}
                </Link>
                · {formatRelative(oldest.updatedAt)}
              </p>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}
