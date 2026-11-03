export interface EnvEntry {
  key: string;
  value: string;
  /** 1-based line number in the source file, for error reporting. */
  line: number;
  /** True when the same key appeared earlier in the file. */
  duplicate: boolean;
}

export interface EnvParseIssue {
  line: number;
  message: string;
}

export interface EnvParseResult {
  entries: EnvEntry[];
  issues: EnvParseIssue[];
}

const KEY_PATTERN = /^[A-Za-z_][A-Za-z0-9_.]*$/;

/**
 * Minimal, dependency-free `.env` parser.
 *
 * Runs entirely in the browser - file contents are never uploaded, and the
 * values are encrypted before anything is saved. Supports comments, blank
 * lines, `export` prefixes, single/double quotes, escape sequences inside
 * double quotes and multi-line double-quoted values.
 */
export function parseEnvFile(content: string): EnvParseResult {
  const entries: EnvEntry[] = [];
  const issues: EnvParseIssue[] = [];
  const seen = new Set<string>();

  const lines = content.replace(/^\uFEFF/, '').split(/\r?\n/);

  for (let index = 0; index < lines.length; index += 1) {
    const raw = lines[index] ?? '';
    const lineNumber = index + 1;
    const trimmed = raw.trim();

    if (trimmed === '' || trimmed.startsWith('#')) continue;

    const withoutExport = trimmed.startsWith('export ') ? trimmed.slice(7).trim() : trimmed;
    const separator = withoutExport.indexOf('=');

    if (separator === -1) {
      issues.push({ line: lineNumber, message: 'Missing "=" - expected KEY=value' });
      continue;
    }

    const key = withoutExport.slice(0, separator).trim();
    if (!KEY_PATTERN.test(key)) {
      issues.push({
        line: lineNumber,
        message: key === '' ? 'Missing key name' : `"${key.slice(0, 40)}" is not a valid variable name`,
      });
      continue;
    }

    let rest = withoutExport.slice(separator + 1).trim();
    let value: string;

    if (rest.startsWith('"')) {
      // Double quoted: may span lines and supports escape sequences.
      let buffer = rest.slice(1);
      let closed = false;
      for (;;) {
        const end = findClosingQuote(buffer, '"');
        if (end !== -1) {
          buffer = buffer.slice(0, end);
          closed = true;
          break;
        }
        index += 1;
        if (index >= lines.length) break;
        buffer += `\n${lines[index] ?? ''}`;
      }
      if (!closed) {
        issues.push({ line: lineNumber, message: 'Unterminated double-quoted value' });
        continue;
      }
      value = unescapeDoubleQuoted(buffer);
    } else if (rest.startsWith("'")) {
      // Single quoted: literal, no escape processing.
      const end = rest.indexOf("'", 1);
      if (end === -1) {
        issues.push({ line: lineNumber, message: 'Unterminated single-quoted value' });
        continue;
      }
      value = rest.slice(1, end);
    } else {
      // Unquoted: strip trailing inline comment.
      const commentAt = rest.search(/\s#/);
      if (commentAt !== -1) rest = rest.slice(0, commentAt);
      value = rest.trim();
    }

    const duplicate = seen.has(key);
    seen.add(key);
    entries.push({ key, value, line: lineNumber, duplicate });
  }

  return { entries, issues };
}

function findClosingQuote(input: string, quote: string): number {
  for (let i = 0; i < input.length; i += 1) {
    if (input[i] !== quote) continue;
    let backslashes = 0;
    for (let j = i - 1; j >= 0 && input[j] === '\\'; j -= 1) backslashes += 1;
    if (backslashes % 2 === 0) return i;
  }
  return -1;
}

function unescapeDoubleQuoted(input: string): string {
  return input.replace(/\\(n|r|t|f|b|v|0|\\|"|'|\$|`)/g, (_match, code: string) => {
    switch (code) {
      case 'n':
        return '\n';
      case 'r':
        return '\r';
      case 't':
        return '\t';
      case 'f':
        return '\f';
      case 'b':
        return '\b';
      case 'v':
        return '\v';
      case '0':
        return '\0';
      default:
        return code;
    }
  });
}

const NEEDS_QUOTES = /[\s"'#$`\\]|^$/;

/** Serialises entries back into `.env` syntax, quoting only when required. */
export function serializeEnvFile(
  entries: Array<{ key: string; value: string }>,
  options: { header?: string } = {},
): string {
  const lines: string[] = [];
  if (options.header) {
    for (const line of options.header.split('\n')) lines.push(`# ${line}`);
    lines.push('');
  }

  for (const entry of entries) {
    lines.push(`${entry.key}=${formatValue(entry.value)}`);
  }

  return `${lines.join('\n')}\n`;
}

function formatValue(value: string): string {
  if (!NEEDS_QUOTES.test(value)) return value;
  const escaped = value
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
  return `"${escaped}"`;
}

/** Converts a title into a conventional SCREAMING_SNAKE_CASE env key. */
export function toEnvKey(title: string): string {
  const normalized = title
    .normalize('NFKD')
    .replace(/[^\w\s.-]/g, '')
    .trim()
    .replace(/[\s.-]+/g, '_')
    .replace(/_{2,}/g, '_')
    .toUpperCase();

  const trimmed = normalized.replace(/^_+|_+$/g, '');
  if (trimmed === '' || /^\d/.test(trimmed)) return `VAULTORY_${trimmed || 'SECRET'}`;
  return trimmed;
}
