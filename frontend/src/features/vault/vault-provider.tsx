import { useQueryClient } from '@tanstack/react-query';
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/features/auth/auth-context';
import { VaultContext, type LockReason, type VaultContextValue } from '@/features/vault/vault-context';
import { deriveAccountKeys } from '@/lib/crypto/kdf';
import { clearVaultKey, loadVaultKey, persistVaultKey } from '@/lib/crypto/key-store';
import { ensureShareKey } from '@/lib/crypto/share';
import {
  decryptFileBytes,
  decryptPayload,
  encryptFileBytes,
  encryptPayload,
  type EncryptedPayload,
  unwrapVaultKey,
} from '@/lib/crypto/vault';

const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'wheel', 'touchstart', 'focus'] as const;
const ACTIVITY_CHECK_MS = 15_000;

export function VaultProvider({ children }: { children: ReactNode }) {
  const { user, status } = useAuth();
  const queryClient = useQueryClient();

  /**
   * The vault key is held in a ref, never in React state. A *persisted* copy
   * lives in IndexedDB while the vault is unlocked so a page reload does not
   * relock; it is wiped on lock, logout, session expiry and account deletion.
   */
  const keyRef = useRef<CryptoKey | null>(null);
  const [locked, setLocked] = useState(true);
  const [unlocking, setUnlocking] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [progress, setProgress] = useState(0);
  // Stamped on unlock; only read while the vault is unlocked.
  const lastActivity = useRef(0);
  // One IndexedDB restore probe per user session, not per render.
  const restoreTriedFor = useRef<string | null>(null);

  const lock = useCallback(
    (reason: LockReason = 'manual') => {
      keyRef.current = null;
      void clearVaultKey().catch(() => {});
      setLocked(true);
      setProgress(0);
      // Cached queries hold decrypted values - drop them with the key.
      queryClient.clear();

      if (reason === 'inactivity') {
        toast.info('Vault locked', { description: 'Your vault locked automatically after inactivity.' });
      }
    },
    [queryClient],
  );

  const adoptKey = useCallback((key: CryptoKey) => {
    keyRef.current = key;
    lastActivity.current = Date.now();
    setLocked(false);
    setProgress(1);
  }, []);

  const unlock = useCallback(
    async (password: string) => {
      if (!user) throw new Error('Sign in before unlocking the vault.');

      setUnlocking(true);
      setProgress(0);
      try {
        const { wrappingKey } = await deriveAccountKeys(password, user.email, user.kdf, setProgress);
        const vaultKey = await unwrapVaultKey(user.wrappedVaultKey, wrappingKey);
        adoptKey(vaultKey);
      } finally {
        setUnlocking(false);
      }
    },
    [user, adoptKey],
  );

  const getKey = useCallback((): CryptoKey => {
    if (!keyRef.current) throw new Error('The vault is locked.');
    return keyRef.current;
  }, []);

  const encrypt = useCallback(async (value: unknown) => encryptPayload(getKey(), value), [getKey]);

  const decrypt = useCallback(
    async <T,>(payload: EncryptedPayload) => decryptPayload<T>(getKey(), payload),
    [getKey],
  );

  const encryptFile = useCallback(
    async (data: Uint8Array) => encryptFileBytes(getKey(), data),
    [getKey],
  );

  const decryptFile = useCallback(
    async (payload: EncryptedPayload) => decryptFileBytes(getKey(), payload),
    [getKey],
  );

  // Reload restore: while signed in, try the persisted IndexedDB key once per
  // user. Hit = vault stays unlocked across refreshes; miss = unlock screen.
  // No cancel/cleanup: StrictMode's dev double-mount must not strand the probe -
  // the found key is still valid, so the result always applies.
  useEffect(() => {
    if (status !== 'authenticated' || !user || keyRef.current) return;
    if (restoreTriedFor.current === user.id) return;
    restoreTriedFor.current = user.id;

    setRestoring(true);
    void loadVaultKey(user.id)
      .then((key) => {
        if (!key) return;
        keyRef.current = key;
        lastActivity.current = Date.now();
        setLocked(false);
        setProgress(1);
      })
      .catch(() => {})
      .finally(() => setRestoring(false));
  }, [status, user]);

  // Persist the key once the vault is unlocked and the user record is in hand
  // (adoptKey can fire the same tick as setSession, before `user` updates).
  useEffect(() => {
    if (locked || !user || !keyRef.current) return;
    const key = keyRef.current;
    void persistVaultKey(user.id, key).catch(() => {});
    // Publish the ECDH share key once - others can't send shares without it.
    void ensureShareKey(user, key).catch(() => {});
  }, [locked, user]);

  // Signing out (or losing the session) drops the key AND its persisted copy.
  useEffect(() => {
    if (status !== 'anonymous') return;
    restoreTriedFor.current = null;
    void clearVaultKey().catch(() => {});
    if (keyRef.current) lock('session');
  }, [status, lock]);

  // Inactivity auto-lock. `autoLockMinutes === 0` disables the timer; the
  // persisted copy is cleared by lock() either way.
  useEffect(() => {
    if (locked || !user || user.autoLockMinutes <= 0) return;

    const timeoutMs = user.autoLockMinutes * 60_000;
    const markActivity = () => {
      lastActivity.current = Date.now();
    };

    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, markActivity, { passive: true });
    }

    const interval = window.setInterval(() => {
      if (Date.now() - lastActivity.current >= timeoutMs) lock('inactivity');
    }, ACTIVITY_CHECK_MS);

    return () => {
      for (const event of ACTIVITY_EVENTS) window.removeEventListener(event, markActivity);
      window.clearInterval(interval);
    };
  }, [locked, user, lock]);

  const value = useMemo<VaultContextValue>(
    () => ({
      locked,
      unlocking,
      restoring,
      progress,
      unlock,
      adoptKey,
      lock,
      getKey,
      encrypt,
      decrypt,
      encryptFile,
      decryptFile,
    }),
    [locked, unlocking, restoring, progress, unlock, adoptKey, lock, getKey, encrypt, decrypt, encryptFile, decryptFile],
  );

  return <VaultContext value={value}>{children}</VaultContext>;
}
