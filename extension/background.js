/**
 * Vaultory service worker.
 *
 * - remembers the last normal tab per window so "Fill" targets the page the
 *   user was just on (extension pages never count)
 * - credential captures from content.js: when Auto-save is ON they are
 *   encrypted and saved straight to the vault (no prompt); when OFF they
 *   are queued so the popup can ask "Save this login?"
 */

const CAPTURE_KEY = 'pendingCaptures';
const DEFAULT_API_BASE = 'http://localhost:4000';
const AAD_SECRET = new TextEncoder().encode('vaultory|secret|v1');
const lastTabByWindow = new Map(); // windowId -> tabId (in-memory, rebuilt)

const isExtensionPage = (url) => !url || url.startsWith(`chrome-extension://${chrome.runtime.id}`);

chrome.tabs.onActivated.addListener(async ({ windowId, tabId }) => {
  try {
    const tab = await chrome.tabs.get(tabId);
    if (!isExtensionPage(tab.url)) lastTabByWindow.set(windowId, tabId);
  } catch {
    // Tab raced away - next activation refreshes.
  }
});

chrome.windows.onFocusChanged.addListener(async (windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) return;
  try {
    const [tab] = await chrome.tabs.query({ active: true, windowId });
    if (tab && !isExtensionPage(tab.url)) lastTabByWindow.set(windowId, tab.id);
  } catch {
    // Focus raced away.
  }
});

function hostnameOf(value) {
  try {
    return new URL(value.includes('://') ? value : `https://${value}`).hostname.replace(/^www\./, '') || null;
  } catch {
    return null;
  }
}

const b64 = {
  encode: (bytes) => btoa(String.fromCharCode(...bytes)),
};

/** Same AES-256-GCM envelope as the web app's encryptPayload (secret AAD). */
async function encryptSecret(vaultKey, payload) {
  const nonce = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(JSON.stringify(payload));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: nonce, additionalData: AAD_SECRET },
    vaultKey,
    plaintext,
  );
  return {
    encVersion: 1,
    nonce: b64.encode(nonce),
    ciphertext: b64.encode(new Uint8Array(ciphertext)),
  };
}

/**
 * Silent save path. Returns false when saving is impossible - unlocked key
 * missing, toggle off, or the API is unreachable - so the caller queues the
 * capture for the popup's manual prompt instead.
 */
async function tryAutoSave(capture) {
  const { autoCapture = true, sessionToken, keyVersion, apiBase } = await chrome.storage.local.get([
    'autoCapture',
    'sessionToken',
    'keyVersion',
    'apiBase',
  ]);
  const { vaultKeyRaw } = await chrome.storage.session.get('vaultKeyRaw');
  if (!autoCapture || !sessionToken || !keyVersion || !vaultKeyRaw?.length) return false;

  try {
    const vaultKey = await crypto.subtle.importKey(
      'raw',
      new Uint8Array(vaultKeyRaw),
      'AES-GCM',
      true,
      ['encrypt'],
    );
    const enc = await encryptSecret(vaultKey, {
      v: 1,
      fields: { url: capture.origin, username: capture.username, password: capture.password },
    });
    const res = await fetch(`${(apiBase || DEFAULT_API_BASE).replace(/\/+$/, '')}/api/secrets`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${sessionToken}` },
      body: JSON.stringify({
        title: capture.title?.trim() || hostnameOf(capture.origin) || 'Saved login',
        category: 'LOGIN',
        tags: [],
        isFavorite: false,
        keyVersion,
        ...enc,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function refreshBadge() {
  const { [CAPTURE_KEY]: pending = [] } = await chrome.storage.session.get(CAPTURE_KEY);
  await chrome.action.setBadgeText({ text: pending.length ? '+' : '' });
  if (pending.length) await chrome.action.setBadgeBackgroundColor({ color: '#6d7cff' });
}

async function flashSavedBadge() {
  await chrome.action.setBadgeBackgroundColor({ color: '#15803d' });
  await chrome.action.setBadgeText({ text: '✓' });
  setTimeout(() => void refreshBadge(), 3000);
}

async function queueCapture(capture) {
  const { [CAPTURE_KEY]: pending = [] } = await chrome.storage.session.get(CAPTURE_KEY);
  pending.push(capture);
  await chrome.storage.session.set({ [CAPTURE_KEY]: pending.slice(-5) });
  await refreshBadge();
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // content.js observed a submitted login form.
  if (message?.type === 'vaultory:capture') {
    (async () => {
      const capture = {
        origin: message.origin,
        title: message.title,
        username: message.username,
        password: message.password,
        tabId: sender.tab?.id ?? null,
        at: Date.now(),
      };
      // Auto-save silently when the toggle is on and the vault key is around;
      // otherwise the capture waits for the popup's "Save this login?" prompt.
      if (await tryAutoSave(capture)) {
        await flashSavedBadge();
      } else {
        await queueCapture(capture);
      }
    })();
    return false;
  }

  // Panel asks which tab to autofill on.
  if (message?.type === 'vaultory:fill-target') {
    (async () => {
      const [active] = await chrome.tabs.query({ active: true, currentWindow: true });
      const tracked = lastTabByWindow.get((await chrome.windows.getCurrent()).id);
      const pick = active && !isExtensionPage(active.url) ? active.id : tracked;
      sendResponse({ tabId: pick ?? null });
    })();
    return true;
  }

  // Popup consumed the capture queue - keep the badge honest.
  if (message?.type === 'vaultory:captures-updated') {
    void refreshBadge();
    return false;
  }

  return false;
});
