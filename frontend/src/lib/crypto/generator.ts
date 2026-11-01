export interface PasswordOptions {
  length: number;
  uppercase: boolean;
  lowercase: boolean;
  numbers: boolean;
  symbols: boolean;
  excludeAmbiguous: boolean;
}

export const DEFAULT_PASSWORD_OPTIONS: PasswordOptions = {
  length: 20,
  uppercase: true,
  lowercase: true,
  numbers: true,
  symbols: true,
  excludeAmbiguous: true,
};

const SETS = {
  uppercase: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  lowercase: 'abcdefghijklmnopqrstuvwxyz',
  numbers: '0123456789',
  symbols: '!@#$%^&*-_=+?.,:;()[]{}',
} as const;

/** Characters that are easy to confuse when read aloud or retyped. */
const AMBIGUOUS = new Set('Il1O0oB8S5Z2|{}[]()/\\\'"`~,;:.<>');

export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 128;

function buildAlphabet(options: PasswordOptions): string[] {
  const groups: string[] = [];
  if (options.uppercase) groups.push(SETS.uppercase);
  if (options.lowercase) groups.push(SETS.lowercase);
  if (options.numbers) groups.push(SETS.numbers);
  if (options.symbols) groups.push(SETS.symbols);

  return groups
    .map((group) => (options.excludeAmbiguous ? [...group].filter((c) => !AMBIGUOUS.has(c)).join('') : group))
    .filter((group) => group.length > 0);
}

/**
 * Uniform random index via rejection sampling.
 * `Math.random()` is never used, and the modulo bias of `% n` is avoided.
 */
function secureIndex(limit: number): number {
  if (limit <= 0) throw new Error('Character set is empty');
  const max = Math.floor(0xff_ff_ff_ff / limit) * limit;
  const buffer = new Uint32Array(1);
  for (;;) {
    crypto.getRandomValues(buffer);
    const value = buffer[0] ?? 0;
    if (value < max) return value % limit;
  }
}

function pick(chars: string): string {
  return chars[secureIndex(chars.length)] ?? '';
}

/**
 * Generates a password that contains at least one character from every enabled
 * group, then shuffles with a cryptographically secure Fisher-Yates.
 */
export function generatePassword(options: PasswordOptions): string {
  const groups = buildAlphabet(options);
  if (groups.length === 0) throw new Error('Enable at least one character type');

  const length = Math.min(Math.max(Math.trunc(options.length), MIN_PASSWORD_LENGTH), MAX_PASSWORD_LENGTH);
  const pool = groups.join('');
  const chars: string[] = groups.slice(0, length).map((group) => pick(group));

  while (chars.length < length) chars.push(pick(pool));

  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = secureIndex(i + 1);
    const a = chars[i] as string;
    const b = chars[j] as string;
    chars[i] = b;
    chars[j] = a;
  }

  return chars.join('');
}

export interface PasswordStrength {
  /** Shannon entropy of the generated/entered password in bits. */
  bits: number;
  label: 'Very weak' | 'Weak' | 'Fair' | 'Strong' | 'Excellent';
  score: 0 | 1 | 2 | 3 | 4;
}

/**
 * Entropy estimate based on the character classes actually present. This is a
 * rough guide for the UI, not a claim about resistance to a targeted attack.
 */
export function estimateStrength(password: string): PasswordStrength {
  if (password.length === 0) return { bits: 0, label: 'Very weak', score: 0 };

  let alphabet = 0;
  if (/[a-z]/.test(password)) alphabet += 26;
  if (/[A-Z]/.test(password)) alphabet += 26;
  if (/\d/.test(password)) alphabet += 10;
  if (/[^A-Za-z0-9]/.test(password)) alphabet += 24;

  const unique = new Set(password).size;
  // Repeated characters add less than the raw length suggests.
  const effectiveLength = password.length * Math.min(1, 0.5 + unique / (password.length * 2));
  const bits = Math.round(effectiveLength * Math.log2(Math.max(alphabet, 2)));

  if (bits < 36) return { bits, label: 'Very weak', score: 0 };
  if (bits < 60) return { bits, label: 'Weak', score: 1 };
  if (bits < 80) return { bits, label: 'Fair', score: 2 };
  if (bits < 110) return { bits, label: 'Strong', score: 3 };
  return { bits, label: 'Excellent', score: 4 };
}
