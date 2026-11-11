import { useQueryClient } from '@tanstack/react-query';
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
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

/**
 * Synchronous unload marker. `pagehide` fires on tab close, browser close and
 * OS shutdown, but the async IndexedDB delete inside lock() may not finish
 * before the page dies - this flag guarantees the next load forces a relock.
 * Consumed once by the restore probe below.
 */
const LOCK_ON_LOAD_KEY = 'vaultory.lock-on-unload';

/** Pages outside the signed-in vault area - visiting any of them locks. */
const PUBLIC_PATHS = new Set(['/', '/login', '/signup', '/forgot-password', '/reset-password', '/verify-email']);

const LOCK_CHANNEL = 'vaultory-vault-lock';
let lockChannel: BroadcastChannel | null = null;

function broadcastLock(reason: LockReason) {
  try {
    lockChannel ??= new BroadcastChannel(LOCK_CHANNEL);
    lockChannel.postMessage({ reason });
  } catch {
    // BroadcastChannel unavailable - per-tab locking still works.
  }
}

export function VaultProvider({ children }: { children: ReactNode }) {
  const { user, status } = useAuth();
  const queryClient = useQueryClient();
  const location = useLocation();

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
      const hadKey = keyRef.current !== null;
      keyRef.current = null;
      void clearVaultKey().catch(() => {});
      setLocked(true);
      setProgress(0);
      // Cached queries hold decrypted values - drop them with the key.
      queryClient.clear();
      // Tell other open tabs to drop their in-memory copies too.
      if (hadKey) broadcastLock(reason);

      if (reason === 'inactivity') {
        toast.info('Vault locked', { description: 'Your vault locked automatically after inactivity.' });
      } else if (reason === 'navigation') {
        toast.info('Vault locked', { description: 'Your vault locked because you left the vault area.' });
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

    // A pagehide/unload marker means the previous session ended by closing -
    // skip the persisted-key probe entirely and wipe whatever survived.
    let forceLocked = false;
    try {
      forceLocked = localStorage.getItem(LOCK_ON_LOAD_KEY) === '1';
      if (forceLocked) localStorage.removeItem(LOCK_ON_LOAD_KEY);
    } catch {
      // Storage unavailable - probe normally.
    }
    if (forceLocked) {
      void clearVaultKey().catch(() => {});
      return;
    }

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

  // Lock on tab/browser close and OS shutdown. The localStorage marker is
  // written synchronously so the next load relocks even if the IndexedDB
  // delete inside lock() cannot finish during unload.
  // Use sessionStorage to distinguish reload from close: sessionStorage
  // survives reload but not tab close.
  const RELOAD_KEY = 'vaultory.reload';
  useEffect(() => {
    const onPageHide = () => {
      if (!keyRef.current) return;
      // If this is a reload (sessionStorage flag set), do not lock.
      try {
        if (sessionStorage.getItem(RELOAD_KEY) === '1') {
          sessionStorage.removeItem(RELOAD_KEY);
          return;
        }
      } catch {
        // SessionStorage unavailable - proceed to lock.
      }
      try {
        localStorage.setItem(LOCK_ON_LOAD_KEY, '1');
      } catch {
        // Storage unavailable - lock() still wipes the key best-effort.
      }
      lock('unload');
    };
    // Back/forward-cache restore: the page resumes with the flag set, so any
    // surviving in-memory key is dropped instead of silently staying unlocked.
    const onPageShow = (event: PageTransitionEvent) => {
      if (!event.persisted || keyRef.current === null) return;
      try {
        if (localStorage.getItem(LOCK_ON_LOAD_KEY) === '1') lock('unload');
      } catch {
        // ignore
      }
    };
    // Mark reload in sessionStorage on any navigation that would cause it.
    const handleBeforeUnload = () => {
      try {
        sessionStorage.setItem(RELOAD_KEY, '1');
      } catch {
        // ignore
      }
    };
    window.addEventListener('pagehide', onPageHide);
    window.addEventListener('pageshow', onPageShow);
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('pagehide', onPageHide);
      window.removeEventListener('pageshow', onPageShow);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [lock]);

  // Other tabs locking (manual, inactivity, unload) drops this tab's key too.
  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return;
    const channel = new BroadcastChannel(LOCK_CHANNEL);
    channel.onmessage = (event: MessageEvent) => {
      const reason = event.data?.reason as LockReason | undefined;
      // Guard on the live key so the broadcast does not ping-pong.
      if (keyRef.current && reason) lock(reason);
    };
    return () => channel.close();
  }, [lock]);

  // Leaving the signed-in vault area (landing, login, verify, ...) locks the
  // vault - the session cookie stays, so returning only needs an unlock.
  // Track the previous path to avoid spurious locks during internal navigation.
  const prevPathnameRef = useRef<string | null>(null);
  useEffect(() => {
    if (locked || status !== 'authenticated' || !user) return;
    // Only lock if we are navigating TO a public path from a non-public path.
    const wasInVault = prevPathnameRef.current && !PUBLIC_PATHS.has(prevPathnameRef.current);
    const nowInPublic = PUBLIC_PATHS.has(location.pathname);
    if (wasInVault && nowInPublic) {
      const id = window.setTimeout(() => lock('navigation'), 0);
      return () => window.clearTimeout(id);
    }
    prevPathnameRef.current = location.pathname;
  }, [location.pathname, locked, status, user, lock]);

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
