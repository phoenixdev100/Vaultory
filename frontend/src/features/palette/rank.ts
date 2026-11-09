/**
 * Lightweight ranking for command-palette results: substring scoring on a few
 * weighted fields. Ordered tiers beat fuzzy matching for a small vault.
 */
export interface RankableItem {
  title: string;
  subtitle?: string | null;
  keywords?: string[];
}

export function rankItems<T extends RankableItem>(query: string, items: T[], limit = 8): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return items.slice(0, limit);

  const scored: Array<{ item: T; score: number }> = [];
  for (const item of items) {
    const title = item.title.toLowerCase();
    const subtitle = (item.subtitle ?? '').toLowerCase();
    const keywords = (item.keywords ?? []).map((k) => k.toLowerCase());

    let score = -1;
    if (title === q) score = 100;
    else if (title.startsWith(q)) score = 80;
    else if (title.includes(q)) score = 60;
    else if (subtitle.includes(q)) score = 40;
    else if (keywords.some((k) => k.startsWith(q))) score = 30;
    else if (keywords.some((k) => k.includes(q))) score = 20;

    if (score >= 0) scored.push({ item, score });
  }

  return scored
    .sort((a, b) => b.score - a.score || a.item.title.localeCompare(b.item.title))
    .slice(0, limit)
    .map(({ item }) => item);
}
