import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_PASSWORD_OPTIONS,
  estimateStrength,
  generatePassword,
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
} from './generator';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('generatePassword', () => {
  it('respects the requested length', () => {
    for (const length of [8, 16, 20, 64]) {
      expect(generatePassword({ ...DEFAULT_PASSWORD_OPTIONS, length })).toHaveLength(length);
    }
  });

  it('clamps lengths outside the supported range', () => {
    expect(generatePassword({ ...DEFAULT_PASSWORD_OPTIONS, length: 2 })).toHaveLength(MIN_PASSWORD_LENGTH);
    expect(generatePassword({ ...DEFAULT_PASSWORD_OPTIONS, length: 500 })).toHaveLength(MAX_PASSWORD_LENGTH);
  });

  it('never falls back to Math.random', () => {
    const spy = vi.spyOn(Math, 'random').mockImplementation(() => {
      throw new Error('Math.random must not be used for security-sensitive randomness');
    });

    expect(() => generatePassword(DEFAULT_PASSWORD_OPTIONS)).not.toThrow();
    expect(spy).not.toHaveBeenCalled();
  });

  it('includes at least one character from every enabled group', () => {
    for (let i = 0; i < 40; i += 1) {
      const password = generatePassword({ ...DEFAULT_PASSWORD_OPTIONS, length: 12, excludeAmbiguous: false });
      expect(password).toMatch(/[A-Z]/);
      expect(password).toMatch(/[a-z]/);
      expect(password).toMatch(/\d/);
      expect(password).toMatch(/[^A-Za-z0-9]/);
    }
  });

  it('only uses the enabled groups', () => {
    const digits = generatePassword({
      length: 24,
      uppercase: false,
      lowercase: false,
      numbers: true,
      symbols: false,
      excludeAmbiguous: false,
    });
    expect(digits).toMatch(/^\d{24}$/);
  });

  it('excludes ambiguous characters when asked', () => {
    for (let i = 0; i < 40; i += 1) {
      const password = generatePassword({ ...DEFAULT_PASSWORD_OPTIONS, length: 40 });
      expect(password).not.toMatch(/[Il1O0oB8S5Z2|{}[\]()/\\'"`~,;:.<>]/);
    }
  });

  it('throws when every character group is disabled', () => {
    expect(() =>
      generatePassword({
        length: 16,
        uppercase: false,
        lowercase: false,
        numbers: false,
        symbols: false,
        excludeAmbiguous: false,
      }),
    ).toThrow(/at least one character type/);
  });

  it('does not repeat itself across calls', () => {
    const generated = new Set(Array.from({ length: 50 }, () => generatePassword(DEFAULT_PASSWORD_OPTIONS)));
    expect(generated.size).toBe(50);
  });
});

describe('estimateStrength', () => {
  it('scores an empty password as the weakest', () => {
    expect(estimateStrength('')).toMatchObject({ bits: 0, score: 0 });
  });

  it('rates longer, mixed passwords higher', () => {
    const weak = estimateStrength('password');
    const strong = estimateStrength(generatePassword({ ...DEFAULT_PASSWORD_OPTIONS, length: 24 }));
    expect(strong.bits).toBeGreaterThan(weak.bits);
    expect(strong.score).toBeGreaterThan(weak.score);
  });

  it('penalises repeated characters', () => {
    expect(estimateStrength('aaaaaaaaaaaaaaaa').bits).toBeLessThan(estimateStrength('abcdefghijklmnop').bits);
  });
});
