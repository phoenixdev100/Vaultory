import { describe, expect, it } from 'vitest';
import { analyzePasswords, collectPasswords, findDuplicates, passwordRotatedAt } from '@/lib/audit';
import type { DecryptedSecret, SecretCategory } from '@/types/api';

function makeSecret(overrides: {
  title?: string;
  category?: SecretCategory;
  fields?: Record<string, string>;
  custom?: Array<{ key: string; value: string }>;
  updatedAt?: string;
}): DecryptedSecret {
  const { title = 'Item', category = 'LOGIN', fields = {}, custom, updatedAt } = overrides;
  return {
    id: `id-${title}-${fields.password ?? ''}`,
    title,
    category,
    tags: [],
    isFavorite: false,
    folderId: null,
    workspaceId: 'ws-1',
    encVersion: 1,
    keyVersion: 1,
    nonce: 'n',
    ciphertext: 'c',
    version: 1,
    deletedAt: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: updatedAt ?? new Date().toISOString(),
    payload: { v: 1, fields, custom },
  };
}

describe('password audit', () => {
  it('collects only password-type fields, plus custom fields', () => {
    const secrets = [
      makeSecret({ fields: { url: 'https://x.dev', username: 'me', password: 'hunter2' } }),
      makeSecret({ title: 'Note', category: 'SECURE_NOTE', fields: { notes: 'free text' } }),
    ];
    const findings = collectPasswords(secrets);
    expect(findings).toHaveLength(1);
    expect(findings[0]!.fieldKey).toBe('password');
  });

  it('flags weak, reused and stale passwords and computes the score', () => {
    const old = new Date(Date.now() - 120 * 24 * 60 * 60 * 1000).toISOString();
    const secrets = [
      makeSecret({ title: 'weak', fields: { password: 'abc' } }),
      makeSecret({ title: 'dup1', fields: { password: 'same-fixture-value' } }),
      makeSecret({ title: 'dup2', fields: { password: 'same-fixture-value' } }),
      makeSecret({ title: 'old', fields: { password: 'Tr0ub4dor&3-ExtremelyLong!', }, updatedAt: old }),
      // A repeated test phrase: scores "strong" for the audit math while
      // obviously being a fixture, not a leaked credential.
      makeSecret({ title: 'good', fields: { password: 'Test-Value-9!'.repeat(3) } }),
    ];

    const report = analyzePasswords(secrets);
    expect(report.total).toBe(5);
    expect(report.weak.map((f) => f.title)).toContain('weak');
    expect(report.reused.map((f) => f.title).sort()).toEqual(['dup1', 'dup2']);
    expect(report.stale.map((f) => f.title)).toEqual(['old']);
    expect(report.clean.map((f) => f.title)).toEqual(['good']);
    expect(report.score).toBe(20);
  });

  it('scores 100 with an empty vault and skips undecryptable items', () => {
    expect(analyzePasswords([]).score).toBe(100);
    const broken: DecryptedSecret = {
      ...makeSecret({ fields: { password: 'hunter2' } }),
      payload: null,
      decryptError: 'old key',
    };
    expect(analyzePasswords([broken]).score).toBe(100);
  });
});

describe('findDuplicates', () => {
  it('groups items sharing normalized title and username', () => {
    const secrets = [
      makeSecret({ title: 'GitHub', fields: { username: 'me@x.dev', password: 'a1' } }),
      makeSecret({ title: ' github ', fields: { username: 'Me@X.Dev', password: 'b2' } }),
      makeSecret({ title: 'GitHub', fields: { username: 'other@x.dev', password: 'c3' } }),
    ];
    const dupes = findDuplicates(secrets);
    expect(dupes).toHaveLength(1);
    expect(dupes[0]!.secrets).toHaveLength(2);
    expect(dupes[0]!.username).toBe('me@x.dev');
  });

  it('ignores items without an identity field', () => {
    const secrets = [makeSecret({ title: 'Note', category: 'SECURE_NOTE', fields: { notes: 'hi' } })];
    expect(findDuplicates(secrets)).toEqual([]);
  });
});

describe('passwordRotatedAt', () => {
  const secret = makeSecret({ fields: { url: 'x', username: 'u', password: 'after-rotation' } });

  it('returns the newest snapshot that differs in password fields', () => {
    const versions = [
      // notes-only update after the rotation: snapshot holds the new password.
      { createdAt: '2026-03-01T00:00:00.000Z', payload: { v: 1 as const, fields: { password: 'after-rotation' } } },
      // the rotation itself: snapshot holds the old password.
      { createdAt: '2026-02-01T00:00:00.000Z', payload: { v: 1 as const, fields: { password: 'before-rotation' } } },
    ];
    expect(passwordRotatedAt(secret, versions)).toEqual({ at: '2026-02-01T00:00:00.000Z', everRotated: true });
  });

  it('reports never-rotated when every snapshot has the same password', () => {
    const versions = [
      { createdAt: '2026-02-01T00:00:00.000Z', payload: { v: 1 as const, fields: { password: 'after-rotation' } } },
    ];
    const result = passwordRotatedAt(secret, versions);
    expect(result.everRotated).toBe(false);
    expect(result.at).toBe(secret.createdAt);
  });
});
