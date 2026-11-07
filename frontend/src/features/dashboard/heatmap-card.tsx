import { useEffect, useMemo, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useActivityHeatmap } from '@/features/dashboard/queries';

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEKS = 53;
const DAYS = 7;
const CELL = 10;
const GAP = 2;

/** Intensity step for a day count -> heat color via color-mix on the primary token. */
function cellColor(count: number): string {
  if (count === 0) return 'var(--color-surface-muted)';
  if (count <= 2) return 'color-mix(in oklab, var(--color-primary) 30%, var(--color-surface-muted))';
  if (count <= 5) return 'color-mix(in oklab, var(--color-primary) 55%, var(--color-surface-muted))';
  if (count <= 9) return 'color-mix(in oklab, var(--color-primary) 80%, var(--color-surface-muted))';
  return 'var(--color-primary)';
}

/**
 * GitHub-style contribution grid for vault activity. Columns are weeks ending
 * today; each cell is one day. Scrolls horizontally on narrow screens.
 */
export function ActivityHeatmapCard() {
  const heatmap = useActivityHeatmap();
  const scroller = useRef<HTMLDivElement>(null);

  const { grid, total } = useMemo(() => {
    const days = heatmap.data?.days ?? {};
    // Day keys must match the server's UTC `createdAt` buckets - build the
    // whole grid in UTC, not local midnight, or today's cell misses the key.
    const now = new Date();
    const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    const todayDow = new Date(todayUtc).getUTCDay();
    // Align the grid so the current week is the last column.
    const end = todayUtc + (DAYS - 1 - todayDow) * DAY_MS;
    const columns: Array<Array<{ key: string; count: number; future: boolean }>> = [];
    let sum = 0;
    for (let week = WEEKS - 1; week >= 0; week--) {
      const column: Array<{ key: string; count: number; future: boolean }> = [];
      // Day 6 first so each column reads oldest day at the top, like GitHub.
      for (let day = DAYS - 1; day >= 0; day--) {
        const ms = end - (week * DAYS + day) * DAY_MS;
        const future = ms > todayUtc;
        const key = new Date(ms).toISOString().slice(0, 10);
        const count = future ? 0 : (days[key] ?? 0);
        sum += count;
        column.push({ key, count, future });
      }
      columns.push(column);
    }
    return { grid: columns, total: sum };
  }, [heatmap.data]);

  // Today lives in the rightmost column - snap the scroller there once data
  // lands so the newest activity is visible without manual scrolling.
  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [heatmap.data]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-[15px]">Vault activity</CardTitle>
        <CardDescription>{total} events in the last 12 months</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {heatmap.isLoading ? (
          <Skeleton className="h-[96px] w-full" />
        ) : (
          <>
            <div ref={scroller} className="overflow-x-auto pb-1">
              <div
                className="grid grid-flow-col"
                style={{
                  gridTemplateRows: `repeat(${DAYS}, ${CELL}px)`,
                  gap: GAP,
                  width: 'max-content',
                }}
                role="img"
                aria-label={`${total} vault events over the last 12 months`}
              >
                {grid.map((week, index) =>
                  week.map((cell) => (
                    <span
                      key={`${index}:${cell.key}`}
                      className="rounded-[3px]"
                      style={{
                        width: CELL,
                        height: CELL,
                        background: cell.future ? 'transparent' : cellColor(cell.count),
                      }}
                      title={cell.future ? undefined : `${cell.key} - ${cell.count} event${cell.count === 1 ? '' : 's'}`}
                    />
                  )),
                )}
              </div>
            </div>
            <div className="flex items-center justify-end gap-1.5 text-[11px] text-fg-subtle">
              <span>Less</span>
              {[0, 2, 4, 8, 12].map((level) => (
                <span
                  key={level}
                  className="rounded-[3px]"
                  style={{ width: CELL, height: CELL, background: cellColor(level) }}
                />
              ))}
              <span>More</span>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
