import { useEffect, useMemo, useState } from 'react';
import { MapPin } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useSessions } from '@/features/dashboard/queries';
import { countryName } from '@/lib/geo';

interface GeoWorld {
  viewBox: [number, number, number, number];
  paths: Record<string, string>;
  centroids: Record<string, [number, number]>;
}

/** 55 KiB of pre-projected SVG paths - lazy chunk, fetched once per session. */
async function loadWorld(): Promise<GeoWorld> {
  const module = await import('./geo-world.json');
  return module.default as unknown as GeoWorld;
}

/**
 * Sign-in locations: country-level dots from the edge geo header captured at
 * session creation. Coarse by design - matches the masked-IP privacy model.
 * Sessions without a country (local dev, unknown edge) are listed separately
 * instead of pretending to be plotted.
 */
export function SessionMapCard() {
  const sessions = useSessions();
  const [world, setWorld] = useState<GeoWorld | null>(null);

  useEffect(() => {
    let alive = true;
    void loadWorld().then((data) => {
      if (alive) setWorld(data);
    });
    return () => {
      alive = false;
    };
  }, []);

  const { byCountry, unknownCount } = useMemo(() => {
    const items = sessions.data?.items ?? [];
    const map = new Map<string, { count: number; current: boolean; label: string }>();
    let unknown = 0;
    for (const session of items) {
      if (!session.country || !world?.centroids[session.country]) {
        unknown += 1;
        continue;
      }
      const entry = map.get(session.country) ?? {
        count: 0,
        current: false,
        label: countryName(session.country),
      };
      entry.count += 1;
      entry.current ||= session.current;
      map.set(session.country, entry);
    }
    return { byCountry: [...map.entries()].sort((a, b) => b[1].count - a[1].count), unknownCount: unknown };
  }, [sessions.data, world]);

  const currentCountry = byCountry.find(([, v]) => v.current)?.[0];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-[15px]">Sign-in locations</CardTitle>
        <CardDescription>
          {byCountry.length === 0
            ? 'Country-level session origins'
            : `${byCountry.length} ${byCountry.length === 1 ? 'country' : 'countries'} across ${sessions.data?.items.length ?? 0} sessions`}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {sessions.isLoading || world === null ? (
          <Skeleton className="h-[150px] w-full" />
        ) : (
          <>
            <svg
              viewBox={world.viewBox.join(' ')}
              className="w-full rounded-[var(--radius-control)] border border-line bg-surface-muted/50"
              role="img"
              aria-label={`World map with sessions in ${byCountry.map(([, v]) => v.label).join(', ') || 'no known locations'}`}
            >
              {Object.values(world.paths).map((d, index) => (
                <path key={index} d={d} fill="var(--color-line-strong)" opacity={0.55} />
              ))}
              {byCountry.map(([code, info]) => {
                const centroid = world.centroids[code];
                if (!centroid) return null;
                const radius = Math.min(16, 5 + info.count * 1.5);
                return (
                  <g key={code}>
                    <circle
                      cx={centroid[0]}
                      cy={centroid[1]}
                      r={radius}
                      fill="var(--color-primary)"
                      opacity={info.current ? 0.9 : 0.65}
                    />
                    {info.current ? (
                      <circle
                        cx={centroid[0]}
                        cy={centroid[1]}
                        r={radius + 5}
                        fill="none"
                        stroke="var(--color-primary)"
                        strokeWidth={2}
                        opacity={0.5}
                      />
                    ) : null}
                    <title>{`${info.label} - ${info.count} session${info.count === 1 ? '' : 's'}${info.current ? ' (this device)' : ''}`}</title>
                  </g>
                );
              })}
            </svg>

            {byCountry.length === 0 ? (
              <p className="text-[13px] leading-5 text-fg-subtle">
                No country data yet. Locations appear once the account is accessed through the
                deployed edge - local and unknown origins are never plotted.
              </p>
            ) : (
              <ul className="flex flex-wrap gap-1.5">
                {byCountry.map(([code, info]) => (
                  <li
                    key={code}
                    className="flex items-center gap-1.5 rounded-full border border-line px-2.5 py-1 text-[11px] text-fg-muted"
                  >
                    <MapPin className="size-3 text-primary" />
                    {info.label}
                    <span className="text-fg-subtle tabular-nums">×{info.count}</span>
                    {info.current ? (
                      <span className="font-medium text-primary">· this device</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}

            {unknownCount > 0 ? (
              <p className="text-[11px] text-fg-subtle">
                {unknownCount} session{unknownCount === 1 ? '' : 's'} without a location (local or
                pre-rollout sign-ins).
              </p>
            ) : null}

            {byCountry.length > 1 && currentCountry ? (
              <p className="text-[11px] leading-4 text-fg-subtle">
                See a country you don&apos;t recognise? Sign that session out from Active sessions below.
              </p>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}
