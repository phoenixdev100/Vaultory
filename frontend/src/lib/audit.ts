import { estimateStrength } from '@/lib/crypto/generator';
import { categoryMeta } from '@/features/vault/categories';
import type { DecryptedSecret, SecretCategory, SecretPayload } from '@/types/api';

/**
 * Client-side password health audit. Runs on already-decrypted payloads -
 * the analysis never leaves the browser.
 */

export interface PasswordFinding {
  secretId: string;
  title: string;
  category: SecretCategory;
  fieldKey: string;
  fieldLabel: string;
  value: string;
  updatedAt: string;
  weak: boolean;
  /** How many findings share this exact password value (1 = unique). */
  reuseCount: number;
  /** True when the item has not been updated in 90+ days. */
  stale: boolean;
}

export interface AuditReport {
  /** Percentage of password fields with no detected issue. */
  score: number;
  total: number;
  weak: PasswordFinding[];
  reused: PasswordFinding[];
  stale: PasswordFinding[];
  clean: PasswordFinding[];
  findings: PasswordFinding[];
}

const STALE_DAYS = 90;

/** Collects every password-type field from a decrypted vault. */
export function collectPasswords(secrets: DecryptedSecret[]): PasswordFinding[] {
  const findings: PasswordFinding[] = [];
  const seenValues = new Map<string, number>();

  for (const secret of secrets) {
    if (!secret.payload || secret.decryptError) continue;
    const meta = categoryMeta(secret.category);

    for (const field of meta.fields) {
      if (field.type !== 'password') continue;
      const value = secret.payload.fields[field.key];
      if (!value) continue;

      findings.push({
        secretId: secret.id,
        title: secret.title,
        category: secret.category,
        fieldKey: field.key,
        fieldLabel: field.label,
        value,
        updatedAt: secret.updatedAt,
        weak: false,
        reuseCount: 1,
        stale: false,
      });
    }
    // Encrypted custom fields can hold passwords too.
    for (const custom of secret.payload.custom ?? []) {
      if (!custom.value) continue;
      findings.push({
        secretId: secret.id,
        title: secret.title,
        category: secret.category,
        fieldKey: `custom:${custom.key}`,
        fieldLabel: custom.key,
        value: custom.value,
        updatedAt: secret.updatedAt,
        weak: false,
        reuseCount: 1,
        stale: false,
      });
    }
  }

  for (const finding of findings) {
    seenValues.set(finding.value, (seenValues.get(finding.value) ?? 0) + 1);
  }

  const staleCutoff = Date.now() - STALE_DAYS * 24 * 60 * 60 * 1000;
  for (const finding of findings) {
    finding.reuseCount = seenValues.get(finding.value) ?? 1;
    finding.weak = estimateStrength(finding.value).score <= 1;
    finding.stale = Date.parse(finding.updatedAt) < staleCutoff;
  }

  return findings;
}

export function analyzePasswords(secrets: DecryptedSecret[]): AuditReport {
  const findings = collectPasswords(secrets);
  const weak = findings.filter((f) => f.weak);
  const reused = findings.filter((f) => f.reuseCount > 1);
  const stale = findings.filter((f) => f.stale);
  const clean = findings.filter((f) => !f.weak && f.reuseCount === 1 && !f.stale);

  return {
    score: findings.length === 0 ? 100 : Math.round((clean.length / findings.length) * 100),
    total: findings.length,
    weak,
    reused,
    stale,
    clean,
    findings,
  };
}

// ---------------------------------------------------------------------------
// Duplicate entries: same title AND same username stored twice - usually an
// accidental re-import or a forgotten second copy that will drift out of sync.
// ---------------------------------------------------------------------------

export interface DuplicateGroup {
  title: string;
  username: string;
  secrets: DecryptedSecret[];
}

/** Identity fields that make two rows "the same account" for dup detection. */
const IDENTITY_KEYS = ['username', 'email', 'account', 'accessKeyId'];

export function findDuplicates(secrets: DecryptedSecret[]): DuplicateGroup[] {
  const groups = new Map<string, DuplicateGroup>();

  for (const secret of secrets) {
    if (!secret.payload || secret.decryptError) continue;
    const username = IDENTITY_KEYS.map((key) => secret.payload?.fields[key]?.trim()).find(Boolean);
    if (!username) continue;

    const key = `${secret.title.trim().toLowerCase()}|${username.toLowerCase()}`;
    const group = groups.get(key) ?? { title: secret.title, username, secrets: [] };
    group.secrets.push(secret);
    groups.set(key, group);
  }

  return [...groups.values()].filter((group) => group.secrets.length > 1);
}

// ---------------------------------------------------------------------------
// Password rotation: compares the current password fields against decrypted
// version snapshots to find when the secret's password last actually changed.
// ---------------------------------------------------------------------------

export interface VersionLike {
  createdAt: string;
  payload: SecretPayload | null;
}

/** Only the category's password-type fields - a notes edit is not a rotation. */
function passwordFieldsOf(category: SecretCategory, payload: SecretPayload | null): string {
  if (!payload) return '';
  const keys = categoryMeta(category)
    .fields.filter((field) => field.type === 'password')
    .map((field) => field.key);
  const pairs = keys.map((key) => [key, payload.fields[key] ?? '']);
  return JSON.stringify(pairs);
}

/**
 * Returns when the password content last changed: the createdAt of the newest
 * version snapshot whose password fields differ from the current payload, or
 * the secret's own createdAt when the password was never rotated.
 */
export function passwordRotatedAt(
  secret: DecryptedSecret,
  versions: VersionLike[],
): { at: string; everRotated: boolean } {
  const current = passwordFieldsOf(secret.category, secret.payload);
  const sorted = [...versions].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  for (const version of sorted) {
    if (passwordFieldsOf(secret.category, version.payload) !== current) {
      return { at: version.createdAt, everRotated: true };
    }
  }
  return { at: secret.createdAt, everRotated: false };
}
