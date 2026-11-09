import { describe, expect, it } from 'vitest';
import { rankItems } from '@/features/palette/rank';

const items = [
  { title: 'GitHub', subtitle: 'dev@example.com', keywords: ['code', 'git'] },
  { title: 'Gmail', subtitle: 'personal@example.com', keywords: ['email'] },
  { title: 'AWS prod keys', subtitle: 'access key', keywords: ['cloud', 'aws'] },
  { title: 'Database backup', subtitle: 'nightly', keywords: ['postgres', 'backup'] },
];

describe('rankItems', () => {
  it('returns items in order when the query is empty', () => {
    expect(rankItems('', items)).toEqual(items);
  });

  it('ranks title prefix above substring and subtitles', () => {
    const ranked = rankItems('git', items);
    expect(ranked[0]!.title).toBe('GitHub');
  });

  it('matches subtitle and keyword hits', () => {
    expect(rankItems('dev@', items).map((i) => i.title)).toContain('GitHub');
    expect(rankItems('postgres', items)[0]!.title).toBe('Database backup');
    expect(rankItems('cloud', items)[0]!.title).toBe('AWS prod keys');
  });

  it('excludes non-matches and respects the limit', () => {
    expect(rankItems('zzz', items)).toEqual([]);
    expect(rankItems('', items, 2)).toHaveLength(2);
  });
});
