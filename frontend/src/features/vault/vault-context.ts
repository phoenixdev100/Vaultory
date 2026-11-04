import { createContext, use } from 'react';
import type { EncryptedPayload } from '@/lib/crypto/vault';

export type LockReason = 'manual' | 'inactivity' | 'session';

export interface VaultContextValue {
  locked: boolean;
  unlocking: boolean;
  /** True while a persisted IndexedDB key is being probed after a reload. */
  restoring: boolean;
  /** Argon2id progress (0-1) so the UI can show real feedback, not a fake delay. */
  progress: number;
  unlock: (password: string) => Promise<void>;
  /** Used right after login/signup, where the key is already in hand. */
  adoptKey: (key: CryptoKey) => void;
  lock: (reason?: LockReason) => void;
  /** The live vault key - throws while locked. Prefer encrypt/decrypt helpers. */
  getKey: () => CryptoKey;
  encrypt: (value: unknown) => Promise<EncryptedPayload>;
  decrypt: <T>(payload: EncryptedPayload) => Promise<T>;
  /** File attachment variants - raw bytes in/out, separate AAD context. */
  encryptFile: (data: Uint8Array) => Promise<EncryptedPayload>;
  decryptFile: (payload: EncryptedPayload) => Promise<Uint8Array>;
}

export const VaultContext = createContext<VaultContextValue | null>(null);

export function useVault(): VaultContextValue {
  const context = use(VaultContext);
  if (!context) throw new Error('useVault must be used inside VaultProvider');
  return context;
}
