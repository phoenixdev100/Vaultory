import { categoryMeta } from '@/features/vault/categories';
import type { DecryptedSecret } from '@/types/api';

/**
 * Expiry tracking, computed in the browser from decrypted date fields
 * (expiresAt and friends). Nothing leaves the device.
 */

export type ExpiryStatus = 'expired' | 'critical' | 'soon';

export interface ExpiringItem {
  secret: DecryptedSecret;
  fieldLabel: string;
  expiresAt: Date;
  daysLeft: number;
  status: ExpiryStatus;
}

const DAY_MS = 24 * 60 * 60 * 1000;
export const EXPIRY_SOON_DAYS = 30;
const CRITICAL_DAYS = 7;

/** Date fields whose key reads as an expiry/rotation marker. */
function isExpiryField(key: string): boolean {
  return /expir|valid.*until|renew/i.test(key);
}

export function collectExpiries(secrets: DecryptedSecret[]): ExpiringItem[] {
  const items: ExpiringItem[] = [];
  const now = Date.now();

  for (const secret of secrets) {
    if (!secret.payload || secret.decryptError) continue;
    for (const field of categoryMeta(secret.category).fields) {
      if (field.type !== 'date' || !isExpiryField(field.key)) continue;
      const raw = secret.payload.fields[field.key];
      if (!raw) continue;
      const time = Date.parse(raw);
      if (Number.isNaN(time)) continue;

      const daysLeft = Math.ceil((time - now) / DAY_MS);
      const status: ExpiryStatus = daysLeft < 0 ? 'expired' : daysLeft <= CRITICAL_DAYS ? 'critical' : 'soon';
      items.push({ secret, fieldLabel: field.label, expiresAt: new Date(time), daysLeft, status });
    }
  }

  return items.sort((a, b) => a.daysLeft - b.daysLeft);
}

export function expiryStatusText(item: ExpiringItem): string {
  if (item.daysLeft < 0) return `expired ${Math.abs(item.daysLeft)}d ago`;
  if (item.daysLeft === 0) return 'expires today';
  return `${item.daysLeft}d left`;
}
