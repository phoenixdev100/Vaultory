import type { CategoryMeta } from '@/features/vault/categories';

export function scoreColor(score: number): string {
  if (score >= 80) return 'var(--color-success)';
  if (score >= 50) return 'var(--color-warning)';
  return 'var(--color-danger)';
}

/**
 * Per-category chart color. The category accent string already carries tuned
 * light/dark hexes (`text-[#…]` / `dark:text-[#…]`) - reusing them keeps the
 * donut consistent with the icon tiles instead of inventing a new palette.
 */
export function categoryColor(meta: CategoryMeta, dark: boolean, fallbackIndex: number): string {
  const palette = ['#4f46e5', '#0e7490', '#b45309', '#be185d', '#15803d', '#6d28d9'];
  const pattern = dark ? /dark:text-\[(#[0-9a-fA-F]{6})\]/ : /(?<!dark:)text-\[(#[0-9a-fA-F]{6})\]/;
  const match = meta.accent.match(pattern);
  return match?.[1] ?? palette[fallbackIndex % palette.length] ?? '#4f46e5';
}
