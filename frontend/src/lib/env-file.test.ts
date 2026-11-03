import { describe, expect, it } from 'vitest';
import { parseEnvFile, serializeEnvFile, toEnvKey } from './env-file';

describe('parseEnvFile', () => {
  it('parses plain assignments', () => {
    const { entries, issues } = parseEnvFile('DATABASE_URL=postgres://localhost:5432/app\nPORT=4000');
    expect(issues).toEqual([]);
    expect(entries).toEqual([
      { key: 'DATABASE_URL', value: 'postgres://localhost:5432/app', line: 1, duplicate: false },
      { key: 'PORT', value: '4000', line: 2, duplicate: false },
    ]);
  });

  it('skips comments and blank lines', () => {
    const { entries } = parseEnvFile(['# database', '', '  # indented comment', 'A=1', ''].join('\n'));
    expect(entries.map((e) => e.key)).toEqual(['A']);
  });

  it('keeps a hash inside a quoted value but strips trailing comments otherwise', () => {
    const { entries } = parseEnvFile(['A=plain # trailing comment', 'B="kept # inside"', 'C=no#comment'].join('\n'));
    expect(entries.map((e) => e.value)).toEqual(['plain', 'kept # inside', 'no#comment']);
  });

  it('handles single and double quotes', () => {
    const { entries } = parseEnvFile(`A="double quoted"\nB='single quoted'\nC="with 'inner' quotes"`);
    expect(entries.map((e) => e.value)).toEqual(['double quoted', 'single quoted', "with 'inner' quotes"]);
  });

  it('processes escape sequences only inside double quotes', () => {
    const { entries } = parseEnvFile(['A="line1\\nline2\\ttabbed"', `B='literal\\nbackslash-n'`].join('\n'));
    expect(entries[0]?.value).toBe('line1\nline2\ttabbed');
    expect(entries[1]?.value).toBe('literal\\nbackslash-n');
  });

  it('keeps escaped quotes inside the value', () => {
    const { entries, issues } = parseEnvFile('A="say \\"hi\\" now"');
    expect(issues).toEqual([]);
    expect(entries[0]?.value).toBe('say "hi" now');
  });

  it('supports multi-line double-quoted values such as private keys', () => {
    const content = ['KEY="-----BEGIN KEY-----', 'abc123', '-----END KEY-----"', 'AFTER=1'].join('\n');
    const { entries, issues } = parseEnvFile(content);
    expect(issues).toEqual([]);
    expect(entries[0]?.value).toBe('-----BEGIN KEY-----\nabc123\n-----END KEY-----');
    expect(entries[1]).toMatchObject({ key: 'AFTER', value: '1' });
  });

  it('accepts empty values', () => {
    const { entries, issues } = parseEnvFile('EMPTY=\nQUOTED_EMPTY=""');
    expect(issues).toEqual([]);
    expect(entries.map((e) => e.value)).toEqual(['', '']);
  });

  it('strips an export prefix', () => {
    const { entries } = parseEnvFile('export TOKEN=abc');
    expect(entries[0]).toMatchObject({ key: 'TOKEN', value: 'abc' });
  });

  it('handles CRLF line endings and a BOM', () => {
    const { entries, issues } = parseEnvFile('\uFEFFA=1\r\nB=2\r\n');
    expect(issues).toEqual([]);
    expect(entries.map((e) => e.key)).toEqual(['A', 'B']);
  });

  it('reports malformed lines with line numbers and keeps parsing', () => {
    const { entries, issues } = parseEnvFile(['GOOD=1', 'this-is-not-an-assignment', '2BAD=x', 'ALSO_GOOD=2'].join('\n'));
    expect(entries.map((e) => e.key)).toEqual(['GOOD', 'ALSO_GOOD']);
    expect(issues).toEqual([
      { line: 2, message: 'Missing "=" - expected KEY=value' },
      { line: 3, message: '"2BAD" is not a valid variable name' },
    ]);
  });

  it('reports unterminated quotes', () => {
    expect(parseEnvFile("A='oops").issues).toEqual([
      { line: 1, message: 'Unterminated single-quoted value' },
    ]);
    expect(parseEnvFile('A="oops').issues).toEqual([
      { line: 1, message: 'Unterminated double-quoted value' },
    ]);
  });

  it('flags duplicate keys without dropping them', () => {
    const { entries } = parseEnvFile('DUP=first\nOTHER=x\nDUP=second');
    expect(entries.filter((e) => e.duplicate)).toHaveLength(1);
    expect(entries.at(-1)).toMatchObject({ key: 'DUP', value: 'second', duplicate: true });
  });

  it('returns nothing for an empty file', () => {
    expect(parseEnvFile('')).toEqual({ entries: [], issues: [] });
  });
});

describe('serializeEnvFile', () => {
  it('writes simple values unquoted', () => {
    expect(serializeEnvFile([{ key: 'A', value: '1' }])).toBe('A=1\n');
  });

  it('quotes values that need it', () => {
    const output = serializeEnvFile([
      { key: 'SPACE', value: 'two words' },
      { key: 'EMPTY', value: '' },
      { key: 'HASH', value: 'a#b' },
      { key: 'NEWLINE', value: 'a\nb' },
      { key: 'QUOTE', value: 'say "hi"' },
    ]);

    expect(output).toBe(
      ['SPACE="two words"', 'EMPTY=""', 'HASH="a#b"', 'NEWLINE="a\\nb"', 'QUOTE="say \\"hi\\""', ''].join('\n'),
    );
  });

  it('prefixes an optional header as comments', () => {
    expect(serializeEnvFile([{ key: 'A', value: '1' }], { header: 'Exported from Vaultory' })).toBe(
      '# Exported from Vaultory\n\nA=1\n',
    );
  });

  it('round-trips through the parser', () => {
    const entries = [
      { key: 'SIMPLE', value: 'value' },
      { key: 'SPACED', value: 'two words' },
      { key: 'MULTILINE', value: '-----BEGIN-----\nkey\n-----END-----' },
      { key: 'QUOTED', value: 'say "hi" #now' },
      { key: 'EMPTY', value: '' },
    ];

    const { entries: parsed, issues } = parseEnvFile(serializeEnvFile(entries));
    expect(issues).toEqual([]);
    expect(parsed.map(({ key, value }) => ({ key, value }))).toEqual(entries);
  });
});

describe('toEnvKey', () => {
  it('converts titles to conventional env keys', () => {
    expect(toEnvKey('Stripe secret key')).toBe('STRIPE_SECRET_KEY');
    expect(toEnvKey('  github token  ')).toBe('GITHUB_TOKEN');
    expect(toEnvKey('api.key-v2')).toBe('API_KEY_V2');
  });

  it('prefixes keys that would be invalid', () => {
    expect(toEnvKey('2fa backup')).toBe('VAULTORY_2FA_BACKUP');
    expect(toEnvKey('***')).toBe('VAULTORY_SECRET');
  });
});
