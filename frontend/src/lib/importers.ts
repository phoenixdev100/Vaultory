import Papa from 'papaparse';
import type { SecretInput } from '@/features/vault/queries';

/**
 * Third-party vault import + Vaultory encrypted-backup parsing. Everything
 * runs in the browser; raw files are never uploaded.
 */

export interface ParsedCsv {
  format: 'bitwarden' | 'chrome';
  items: SecretInput[];
  skipped: number;
}

/** Detects Chrome (`name,url,username,password,note`) vs Bitwarden headers. */
export function parsePasswordCsv(content: string): ParsedCsv | { error: string } {
  const result = Papa.parse<Record<string, string>>(content, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.trim().toLowerCase(),
  });

  if (result.data.length === 0) {
    return { error: 'No rows found in that file.' };
  }

  const headers = new Set((result.meta.fields ?? []).map((f) => f.toLowerCase()));
  const items: SecretInput[] = [];
  let skipped = 0;

  if (headers.has('login_password') || headers.has('login_uri')) {
    // Bitwarden CSV export.
    for (const row of result.data) {
      const name = (row.name ?? '').trim();
      const password = row.login_password ?? '';
      if (!name || (!password && !(row.login_username ?? '').trim())) {
        skipped += 1;
        continue;
      }
      items.push({
        title: name,
        category: 'LOGIN',
        tags: ['imported', 'bitwarden'],
        payload: {
          v: 1,
          fields: {
            url: (row.login_uri ?? '').trim(),
            username: (row.login_username ?? '').trim(),
            password,
          },
          notes: (row.notes ?? '').trim() || undefined,
        },
      });
    }
    return { format: 'bitwarden', items, skipped };
  }

  if (headers.has('username') && headers.has('password')) {
    // Chrome / generic name,url,username,password[,note] export.
    for (const row of result.data) {
      const name = (row.name ?? '').trim();
      const password = row.password ?? '';
      if (!name || (!password && !(row.username ?? '').trim())) {
        skipped += 1;
        continue;
      }
      items.push({
        title: name,
        category: 'LOGIN',
        tags: ['imported', 'chrome'],
        payload: {
          v: 1,
          fields: {
            url: (row.url ?? '').trim(),
            username: (row.username ?? '').trim(),
            password,
          },
          notes: (row.note ?? '').trim() || undefined,
        },
      });
    }
    return { format: 'chrome', items, skipped };
  }

  return {
    error:
      'Unrecognised CSV layout. Expected a Bitwarden export or a Chrome-style name,url,username,password file.',
  };
}

// ---------------------------------------------------------------------------
// Vaultory encrypted backup (.json). Contains ciphertext only - restoring it
// works for the same account/vault key without ever exposing plaintext.
// ---------------------------------------------------------------------------

export const BACKUP_FORMAT = 'vaultory-backup';
export const BACKUP_VERSION = 1;

export interface VaultBackup {
  format: typeof BACKUP_FORMAT;
  version: number;
  exportedAt: string;
  folders: Array<{ name: string; color: string | null }>;
  secrets: Array<{
    title: string;
    category: string;
    tags: string[];
    isFavorite: boolean;
    folder: string | null;
    encVersion: 1;
    keyVersion: number;
    nonce: string;
    ciphertext: string;
  }>;
  attachments: Array<{
    secretIndex: number;
    fileName: string;
    mimeType: string | null;
    size: number;
    encVersion: 1;
    keyVersion: number;
    nonce: string;
    ciphertext: string;
  }>;
}

export function parseBackup(content: string): VaultBackup | { error: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return { error: 'That file is not valid JSON.' };
  }

  const backup = parsed as Partial<VaultBackup>;
  if (backup.format !== BACKUP_FORMAT) {
    return { error: 'That file is not a Vaultory backup.' };
  }
  if (backup.version !== BACKUP_VERSION) {
    return { error: `Backup version ${backup.version} is not supported.` };
  }
  if (!Array.isArray(backup.secrets)) {
    return { error: 'The backup contains no secrets.' };
  }
  return backup as VaultBackup;
}
