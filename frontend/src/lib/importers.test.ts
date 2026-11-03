import { describe, expect, it } from 'vitest';
import { BACKUP_FORMAT, parseBackup, parsePasswordCsv, type VaultBackup } from '@/lib/importers';

describe('parsePasswordCsv', () => {
  it('parses a Chrome-style export', () => {
    const csv = 'name,url,username,password,note\nGitHub,https://github.com,me@x.dev,s3cret,work\n\n';
    const result = parsePasswordCsv(csv);
    expect(result).not.toHaveProperty('error');
    const parsed = result as Extract<typeof result, { items: unknown[] }>;
    expect(parsed.format).toBe('chrome');
    expect(parsed.items).toHaveLength(1);
    expect(parsed.items[0]!.title).toBe('GitHub');
    expect(parsed.items[0]!.payload.fields).toEqual({
      url: 'https://github.com',
      username: 'me@x.dev',
      password: 's3cret',
    });
  });

  it('parses a Bitwarden export and skips empty rows', () => {
    const csv =
      'folder,favorite,type,name,notes,fields,reprompt,login_uri,login_username,login_password,login_totp\n' +
      'Dev,0,login,GitLab,,,,https://gitlab.com,dev,pw123,\n' +
      'Dev,0,note,Just a note,,,,,,,\n';
    const result = parsePasswordCsv(csv);
    expect(result).not.toHaveProperty('error');
    const parsed = result as Extract<typeof result, { items: unknown[] }>;
    expect(parsed.format).toBe('bitwarden');
    expect(parsed.items).toHaveLength(1);
    expect(parsed.skipped).toBe(1);
    expect(parsed.items[0]!.title).toBe('GitLab');
    expect(parsed.items[0]!.payload.fields.password).toBe('pw123');
  });

  it('keeps commas and quotes inside values', () => {
    const csv = 'name,url,username,password,note\n"Site, Inc.",https://x.dev,"user,name","p""a,ss",note\n';
    const result = parsePasswordCsv(csv);
    const parsed = result as Extract<typeof result, { items: unknown[] }>;
    expect(parsed.items[0]!.payload.fields.password).toBe('p"a,ss');
    expect(parsed.items[0]!.payload.fields.username).toBe('user,name');
  });

  it('rejects an unrecognised layout', () => {
    const result = parsePasswordCsv('foo,bar\n1,2\n');
    expect(result).toHaveProperty('error');
  });
});

describe('parseBackup', () => {
  const valid: VaultBackup = {
    format: BACKUP_FORMAT,
    version: 1,
    exportedAt: '2026-10-17T00:00:00.000Z',
    folders: [{ name: 'Dev', color: null }],
    secrets: [
      {
        title: 'x',
        category: 'LOGIN',
        tags: [],
        isFavorite: false,
        folder: 'Dev',
        encVersion: 1,
        keyVersion: 1,
        nonce: 'n',
        ciphertext: 'c',
      },
    ],
    attachments: [],
  };

  it('accepts a well-formed backup', () => {
    const result = parseBackup(JSON.stringify(valid));
    expect(result).not.toHaveProperty('error');
  });

  it('rejects non-JSON, wrong format and wrong version', () => {
    expect(parseBackup('not json')).toHaveProperty('error');
    expect(parseBackup(JSON.stringify({ format: 'other' }))).toHaveProperty('error');
    expect(parseBackup(JSON.stringify({ ...valid, version: 99 }))).toHaveProperty('error');
  });
});
