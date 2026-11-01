/**
 * Vault-key persistence across page reloads.
 *
 * The CryptoKey itself is stored in IndexedDB (structured-cloneable in every
 * modern browser). It survives a refresh but is wiped on lock, logout, session
 * expiry and account deletion - see VaultProvider. IndexedDB storage is scoped
 * to this origin and user id, so a different account on the same browser
 * profile can never pick up a stale key.
 */
const DB_NAME = 'vaultory-keystore';
const STORE_NAME = 'keys';
const RECORD_ID = 'vault-key';

interface StoredVaultKey {
  id: string;
  userId: string;
  key: CryptoKey;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME, { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB unavailable'));
  });
}

export async function persistVaultKey(userId: string, key: CryptoKey): Promise<void> {
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put({ id: RECORD_ID, userId, key } satisfies StoredVaultKey);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('Could not persist the vault key'));
    });
  } finally {
    db.close();
  }
}

/** Returns the persisted key only when it belongs to the signed-in user. */
export async function loadVaultKey(userId: string): Promise<CryptoKey | null> {
  const db = await openDb();
  try {
    const record = await new Promise<StoredVaultKey | undefined>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const request = tx.objectStore(STORE_NAME).get(RECORD_ID);
      request.onsuccess = () => resolve(request.result as StoredVaultKey | undefined);
      request.onerror = () => reject(request.error ?? new Error('Could not read the vault key'));
    });
    return record && record.userId === userId ? record.key : null;
  } finally {
    db.close();
  }
}

export async function clearVaultKey(): Promise<void> {
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(RECORD_ID);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('Could not clear the vault key'));
    });
  } finally {
    db.close();
  }
}
