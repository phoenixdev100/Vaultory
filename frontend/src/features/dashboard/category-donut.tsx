import { FolderOpen } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { DonutChart } from '@/features/dashboard/charts';
import { categoryColor } from '@/features/dashboard/chart-utils';
import { categoryMeta } from '@/features/vault/categories';
import { useTheme } from '@/app/theme-context';
import type { SecretCategory } from '@/types/api';

const MAX_LEGEND = 5;

/** Secrets-by-category donut replacing the old bar list. */
export function CategoryDonutCard({ categories }: { categories: Array<{ category: SecretCategory; count: number }> }) {
  const { resolvedTheme } = useTheme();
  const dark = resolvedTheme === 'dark';

  if (categories.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-[15px]">Categories</CardTitle>
        </CardHeader>
        <CardContent>
          <EmptyState
            dense
            icon={FolderOpen}
            title="No categories yet"
            description="Save something and it will be counted here."
          />
        </CardContent>
      </Card>
    );
  }

  const total = categories.reduce((sum, row) => sum + row.count, 0);
  const slices = categories.map((row, index) => {
    const meta = categoryMeta(row.category);
    return { label: meta.short, value: row.count, color: categoryColor(meta, dark, index) };
  });
  const legend = categories.slice(0, MAX_LEGEND);
  const rest = categories.slice(MAX_LEGEND).reduce((sum, row) => sum + row.count, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-[15px]">Categories</CardTitle>
      </CardHeader>
      <CardContent className="flex items-center gap-5">
        <div className="relative shrink-0">
          <DonutChart slices={slices} size={112} thickness={15} />
          <span className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-display text-xl font-semibold text-fg tabular-nums">{total}</span>
            <span className="text-[10px] text-fg-subtle">secrets</span>
          </span>
        </div>
        <ul className="min-w-0 flex-1 space-y-1.5">
          {legend.map((row, index) => {
            const meta = categoryMeta(row.category);
            const color = slices[index]?.color ?? 'var(--color-line-strong)';
            return (
              <li key={row.category} className="flex items-center gap-2 text-[12px]">
                <span className="size-2.5 shrink-0 rounded-[3px]" style={{ background: color }} />
                <span className="min-w-0 flex-1 truncate text-fg-muted">{meta.short}</span>
                <span className="shrink-0 text-fg-subtle tabular-nums">{row.count}</span>
              </li>
            );
          })}
          {rest > 0 ? (
            <li className="flex items-center gap-2 text-[12px] text-fg-subtle">
              <span className="size-2.5 shrink-0 rounded-[3px] bg-line-strong" />
              <span className="min-w-0 flex-1 truncate">Other</span>
              <span className="shrink-0 tabular-nums">{rest}</span>
            </li>
          ) : null}
        </ul>
      </CardContent>
    </Card>
  );
}
