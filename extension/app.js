import { decryptPayload, deriveAccountKeys, encryptPayload, unwrapVaultKey } from './crypto.js';

/**
 * Vaultory popup: an independent thin client. Sign-in derives the auth
 * verifier locally (the password never leaves this page), the session token
 * is kept in chrome.storage, and secrets decrypt in memory only.
 */

const $ = (id) => document.getElementById(id);
const store = chrome.storage.local;
const sessionStore = chrome.storage.session;
const CAPTURE_KEY = 'pendingCaptures';

// Works out of the box in dev; "Server settings" only needs touching on a
// custom deployment. Deployed builds can point these at the real origins.
const DEFAULT_API_BASE = 'http://localhost:4000';
const DEFAULT_WEB_BASE = 'http://localhost:5173';

let vaultKey = null; // CryptoKey while unlocked - never persisted raw
let items = []; // decrypted rows for the list
let pendingMfa = null; // {mfaToken, wrappingKey} while the inline 2FA step is open
let siteHost = ''; // hostname of the tab the panel is open next to
let refreshTimer = null;

// --- Shell ---------------------------------------------------------------

function show(section) {
  for (const el of document.querySelectorAll('.screen')) el.classList.toggle('active', el.id === section);
  $('lock-btn').classList.toggle('hidden', section !== 'vault');
  $('error').classList.add('hidden');
}

function fail(message) {
  const el = $('error');
  el.textContent = message || '';
  el.classList.toggle('hidden', !message);
}

$('error').addEventListener('click', () => fail());

async function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  await store.set({ theme });
}

/** navigator.clipboard can silently reject in a popup without focus -
 * fall back to the textarea/execCommand path which needs no permission. */
async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0';
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch {
      ok = false;
    }
    ta.remove();
    return ok;
  }
}

function hostnameOf(value) {
  try {
    return new URL(value.includes('://') ? value : `https://${value}`).hostname.replace(/^www\./, '') || null;
  } catch {
    return null;
  }
}

async function api(path, { method = 'GET', body, token } = {}) {
  const { apiBase } = await store.get('apiBase');
  const base = (apiBase || DEFAULT_API_BASE).replace(/\/+$/, '');
  let res;
  try {
    res = await fetch(`${base}/api${path}`, {
      method,
      headers: {
        'content-type': 'application/json',
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error('Cannot reach the server - check your connection or the API server URL.');
  }
  const data = await res.json().catch(() => ({}));
  if (res.ok) return data;

  // The API already sends human sentences in error.message; status text is
  // only a last-resort fallback, never shown as "Request failed (N)".
  const apiError = data?.error ?? {};
  let message = apiError.message;
  if (apiError.code === 'validation_error' && apiError.details?.length) {
    // Surface the actual field message ("Enter a valid email address"),
    // not the generic "Some fields need attention".
    message = apiError.details[0].message;
  }
  if (!message) {
    message =
      {
        400: 'That request did not look right - check what you entered.',
        401: 'Incorrect email or password.',
        403: 'The server refused this request.',
        404: 'Not found on this server - check the API server URL.',
        413: 'That is too large to send.',
        429: 'Too many attempts - wait a moment and try again.',
      }[res.status] ??
      (res.status >= 500 ? 'The server hit a problem - try again shortly.' : 'Something went wrong - try again.');
  }
  const err = new Error(message);
  err.status = res.status;
  err.code = apiError.code;
  throw err;
}

// --- Sign-in ----------------------------------------------------------------

async function signIn() {
  fail();
  const apiBase = $('api-base').value.trim().replace(/\/+$/, '') || DEFAULT_API_BASE;
  const email = $('email').value.trim().toLowerCase();
  const password = $('signin-password').value;
  if (!email || !password) return fail('Enter your email and password.');
  await store.set({ apiBase });

  const btn = $('signin-btn');
  btn.disabled = true;
  btn.textContent = 'Deriving keys…';
  try {
    const { kdf } = await api('/auth/prelogin', { method: 'POST', body: { email } });
    const keys = await deriveAccountKeys(password, email, kdf);
    const res = await api('/auth/login', { method: 'POST', body: { email, authVerifier: keys.authVerifier } });

    if (res.mfaRequired) {
      pendingMfa = { mfaToken: res.mfaToken, wrappingKey: keys.wrappingKey };
      $('mfa-row').classList.remove('hidden');
      $('totp-code').focus();
      btn.textContent = 'Verify & sign in';
      btn.disabled = false;
      return;
    }
    await finishLogin(res, keys.wrappingKey);
  } catch (e) {
    fail(e.message);
  } finally {
    if (!pendingMfa) {
      btn.disabled = false;
      btn.textContent = 'Sign in';
    }
  }
}

async function verifyMfa() {
  if (!pendingMfa) return;
  const code = $('totp-code').value.trim();
  if (!code) return fail('Enter the 6-digit code from your authenticator app.');
  fail();
  const btn = $('signin-btn');
  btn.disabled = true;
  try {
    const res = await api('/auth/login/mfa', {
      method: 'POST',
      body: { mfaToken: pendingMfa.mfaToken, code },
    });
    const { wrappingKey } = pendingMfa;
    pendingMfa = null;
    $('mfa-row').classList.add('hidden');
    await finishLogin(res, wrappingKey);
  } catch (e) {
    fail(e.message);
    btn.disabled = false;
  }
}

async function finishLogin(res, wrappingKey) {
  await store.set({
    sessionToken: res.sessionToken,
    wrappedVaultKey: res.user.wrappedVaultKey,
    kdf: res.user.kdf,
    email: res.user.email,
    keyVersion: res.user.vaultKeyVersion,
  });
  try {
    await adoptKey(wrappingKey);
  } catch {
    throw new Error('Signed in, but the vault key could not be opened with this password.');
  }
}

/** Locked screen: derive the wrapping key from the typed password. */
async function unlock(password) {
  const { kdf, email, wrappedVaultKey } = await store.get(['kdf', 'email', 'wrappedVaultKey']);
  const progress = $('kdf-progress');
  progress.classList.remove('hidden');
  try {
    const { wrappingKey } = await deriveAccountKeys(password, email, kdf, (p) => {
      progress.textContent = `Deriving key… ${Math.round(p * 100)}%`;
    });
    // Unwrap failure = wrong password; anything after is a server problem and
    // must surface its own message, not masquerade as a mistyped password.
    try {
      vaultKey = await unwrapVaultKey(wrappedVaultKey, wrappingKey);
    } catch {
      fail('Wrong password.');
      return;
    }
    await persistKey();
    await loadVault();
  } catch (e) {
    if (e.status === 401) {
      await dropSession();
      fail('Your session expired. Please sign in again.');
      show('login');
      return;
    }
    fail(e.message);
  } finally {
    progress.classList.add('hidden');
  }
}

async function persistKey() {
  const raw = new Uint8Array(await crypto.subtle.exportKey('raw', vaultKey));
  await sessionStore.set({ vaultKeyRaw: Array.from(raw) });
  raw.fill(0);
}

/** Unwraps the vault key with an already-derived wrapping key. */
async function adoptKey(wrappingKey) {
  const { wrappedVaultKey } = await store.get('wrappedVaultKey');
  vaultKey = await unwrapVaultKey(wrappedVaultKey, wrappingKey);
  await persistKey();
  await loadVault();
}

// --- Vault list ------------------------------------------------------------

async function loadVault({ silent = false } = {}) {
  const { sessionToken } = await store.get('sessionToken');
  const rows = [];
  let cursor;
  for (let page = 0; page < 20; page += 1) {
    const res = await api(`/secrets${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`, {
      token: sessionToken,
    });
    rows.push(...(res.items ?? []));
    if (!res.nextCursor) break;
    cursor = res.nextCursor;
  }
  const fresh = [];
  for (const row of rows) {
    try {
      const payload = await decryptPayload(vaultKey, row);
      fresh.push({ id: row.id, title: row.title, category: row.category, payload });
    } catch {
      // Undecryptable rows are skipped in the extension list.
    }
  }
  items = fresh;
  const { email } = await store.get('email');
  $('me-email').textContent = email || '';
  await refreshSiteHost();
  render($('search').value);
  renderCaptureBanner();
  void flushPendingCaptures();
  show('vault');
  if (!silent) scheduleRefresh();
}

async function refreshSiteHost() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    siteHost = tab?.url && /^https?:/i.test(tab.url) ? hostnameOf(tab.url) ?? '' : '';
  } catch {
    siteHost = '';
  }
}

function matchesSite(item) {
  if (!siteHost) return false;
  const fields = item.payload?.fields ?? {};
  const candidate = hostnameOf(fields.url ?? fields.website ?? fields.domain ?? fields.host ?? '');
  if (!candidate) return false;
  return (
    candidate === siteHost ||
    siteHost.endsWith(`.${candidate}`) ||
    candidate.endsWith(`.${siteHost}`)
  );
}

function render(filter) {
  const q = filter.trim().toLowerCase();
  const qmatch = (i) =>
    !q || i.title.toLowerCase().includes(q) || JSON.stringify(i.payload).toLowerCase().includes(q);
  const visible = items.filter(qmatch);
  const siteItems = visible.filter(matchesSite);
  const rest = visible.filter((i) => !matchesSite(i));

  $('site-label').classList.toggle('hidden', siteItems.length === 0);
  $('all-label').textContent = siteItems.length ? 'All items' : 'All items';
  $('empty').classList.toggle('hidden', visible.length > 0);

  paintList($('site-items'), siteItems);
  paintList($('items'), rest);
}

function paintList(list, rows) {
  list.textContent = '';
  for (const item of rows) {
    const fields = item.payload?.fields ?? {};
    const username = fields.username ?? fields.email ?? fields.account ?? '';
    const li = document.createElement('li');
    li.className = 'item';

    const meta = document.createElement('div');
    meta.className = 'meta';
    const title = document.createElement('div');
    title.className = 'title';
    title.textContent = item.title;
    const sub = document.createElement('div');
    sub.className = 'sub';
    sub.textContent = username || item.category;
    meta.append(title, sub);

    const actions = document.createElement('div');
    actions.className = 'actions';

    const fill = document.createElement('button');
    fill.className = 'fill';
    fill.textContent = 'Fill';
    fill.addEventListener('click', () => autofill(item));

    const copy = document.createElement('button');
    copy.textContent = 'Copy';
    copy.addEventListener('click', async () => {
      const value = fields.password ?? fields.token ?? fields.key ?? '';
      if (!value) return fail('This item has nothing to copy.');
      if (!(await copyText(String(value)))) return fail('Copy did not work on this item.');
      copy.textContent = 'Copied';
      setTimeout(() => (copy.textContent = 'Copy'), 1200);
    });

    actions.append(fill, copy);
    li.append(meta, actions);
    list.append(li);
  }
}

async function autofill(item) {
  const fields = item.payload?.fields ?? {};
  const { tabId } = await chrome.runtime.sendMessage({ type: 'vaultory:fill-target' });
  if (!tabId) return fail('Open the page you want to fill on, then try again.');
  try {
    const res = await chrome.tabs.sendMessage(tabId, {
      type: 'vaultory:fill',
      username: String(fields.username ?? fields.email ?? ''),
      password: String(fields.password ?? ''),
    });
    if (res?.filled) {
      // The fill happened on the page behind the popup - close so the user
      // actually sees the form populated.
      window.close();
      return;
    }
    fail('No matching login fields on this page.');
  } catch {
    fail('This page cannot be filled - reload it and try again.');
  }
}

// --- Auto-capture banner ----------------------------------------------------

function latestCapture(captures) {
  return captures.find((c) => c.username || c.password);
}

/** Auto-save ON: the worker saves silently, no banner. OFF: prompt here. */
async function renderCaptureBanner() {
  const banner = $('capture-banner');
  const [{ [CAPTURE_KEY]: pending = [] }, { autoCapture = true }] = await Promise.all([
    chrome.storage.session.get(CAPTURE_KEY),
    store.get('autoCapture'),
  ]);
  const capture = !autoCapture && vaultKey ? latestCapture(pending) : null;
  if (!capture) {
    banner.classList.add('hidden');
    return;
  }
  const host = hostnameOf(capture.origin) ?? capture.origin;
  $('capture-sub').textContent = `${capture.username ? `${capture.username} · ` : ''}${host}`;
  banner.classList.remove('hidden');
}

async function saveOneCapture(capture) {
  const { keyVersion, sessionToken } = await store.get(['keyVersion', 'sessionToken']);
  const host = hostnameOf(capture.origin) ?? capture.origin;
  const enc = await encryptPayload(vaultKey, {
    v: 1,
    fields: { url: capture.origin, username: capture.username, password: capture.password },
  });
  await api('/secrets', {
    method: 'POST',
    token: sessionToken,
    body: {
      title: capture.title?.trim() || host,
      category: 'LOGIN',
      tags: [],
      isFavorite: false,
      keyVersion,
      ...enc,
    },
  });
}

/** Auto-save mode: drain any captures that piled up while the vault was locked. */
async function flushPendingCaptures() {
  const { autoCapture = true } = await store.get('autoCapture');
  if (!autoCapture || !vaultKey) return;
  const { [CAPTURE_KEY]: pending = [] } = await chrome.storage.session.get(CAPTURE_KEY);
  if (!pending.length) return;
  for (const capture of pending) {
    try {
      await saveOneCapture(capture);
    } catch {
      // Best-effort silent save - a failed capture is dropped, not prompted.
    }
  }
  await chrome.storage.session.set({ [CAPTURE_KEY]: [] });
  await chrome.runtime.sendMessage({ type: 'vaultory:captures-updated' }).catch(() => {});
}

/** Prompt mode: the banner's Save button persists the top queued capture. */
async function saveCapture() {
  const { [CAPTURE_KEY]: pending = [] } = await chrome.storage.session.get(CAPTURE_KEY);
  const capture = latestCapture(pending);
  if (!capture) {
    $('capture-banner').classList.add('hidden');
    return;
  }
  await saveOneCapture(capture);
  const remaining = pending.filter((c) => c !== capture);
  await chrome.storage.session.set({ [CAPTURE_KEY]: remaining });
  await chrome.runtime.sendMessage({ type: 'vaultory:captures-updated' }).catch(() => {});
  await loadVault({ silent: true });
}

async function dismissCapture() {
  const { [CAPTURE_KEY]: pending = [] } = await chrome.storage.session.get(CAPTURE_KEY);
  const capture = latestCapture(pending);
  const remaining = pending.filter((c) => c !== capture);
  await chrome.storage.session.set({ [CAPTURE_KEY]: remaining });
  await chrome.runtime.sendMessage({ type: 'vaultory:captures-updated' }).catch(() => {});
  renderCaptureBanner();
}

// --- Session helpers --------------------------------------------------------

function scheduleRefresh() {
  if (refreshTimer) clearInterval(refreshTimer);
  // The panel always shows live server state: refetch every minute and on
  // refocus while it is open.
  refreshTimer = setInterval(() => {
    if (vaultKey) void loadVault({ silent: true }).catch(() => {});
  }, 60_000);
}

async function dropSession() {
  await store.remove(['sessionToken']);
  await sessionStore.clear();
  vaultKey = null;
  items = [];
  pendingMfa = null;
  if (refreshTimer) clearInterval(refreshTimer);
}

async function signOut() {
  const { sessionToken } = await store.get('sessionToken');
  if (sessionToken) {
    try {
      await api('/auth/logout', { method: 'POST', token: sessionToken });
    } catch {
      // Offline or already-expired - clearing locally still signs out.
    }
  }
  await store.remove(['sessionToken', 'wrappedVaultKey', 'kdf', 'email', 'keyVersion']);
  await sessionStore.clear();
  vaultKey = null;
  items = [];
  pendingMfa = null;
  if (refreshTimer) clearInterval(refreshTimer);
  show('login');
}

// --- Wiring ------------------------------------------------------------------

async function init() {
  const { theme = 'light' } = await store.get('theme');
  document.documentElement.dataset.theme = theme;

  $('theme-btn').addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    void applyTheme(next);
  });
  $('get-started').addEventListener('click', () => show('login'));
  $('signup-link').addEventListener('click', async () => {
    const { webBase } = await store.get('webBase');
    const base = (webBase || DEFAULT_WEB_BASE).replace(/\/+$/, '');
    await chrome.tabs.create({ url: `${base}/signup` });
  });

  // Custom server origins persist the moment they are typed.
  $('api-base').addEventListener('change', (e) => {
    void store.set({ apiBase: e.target.value.trim().replace(/\/+$/, '') });
  });
  $('web-base').addEventListener('change', (e) => {
    void store.set({ webBase: e.target.value.trim().replace(/\/+$/, '') });
  });
  for (const id of ['api-base', 'web-base', 'email', 'signin-password']) {
    $(id).addEventListener('input', () => {
      if (!pendingMfa) return;
      pendingMfa = null;
      $('mfa-row').classList.add('hidden');
      $('signin-btn').textContent = 'Sign in';
    });
  }
  $('signin-btn').addEventListener('click', () => void (pendingMfa ? verifyMfa() : signIn()));
  $('totp-code').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') void verifyMfa();
  });
  $('signin-password').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') void signIn();
  });

  $('unlock-btn').addEventListener('click', () => void unlock($('unlock-password').value));
  $('unlock-password').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') void unlock($('unlock-password').value);
  });
  $('signout-btn').addEventListener('click', () => void signOut());
  $('signout-btn2').addEventListener('click', () => void signOut());
  $('lock-btn').addEventListener('click', async () => {
    await sessionStore.clear();
    vaultKey = null;
    items = [];
    if (refreshTimer) clearInterval(refreshTimer);
    const { email } = await store.get('email');
    $('locked-email').textContent = email || '';
    show('locked');
  });

  $('search').addEventListener('input', (e) => render(e.target.value));
  $('refresh-btn').addEventListener('click', () => void loadVault({ silent: true }));
  $('capture-save').addEventListener('click', () => void saveCapture().catch((e) => fail(e.message)));
  $('capture-dismiss').addEventListener('click', () => void dismissCapture());
  const { autoCapture = true } = await store.get('autoCapture');
  $('capture-toggle').checked = autoCapture;
  $('capture-toggle').addEventListener('change', (e) => {
    void store.set({ autoCapture: e.target.checked });
  });

  // Keep the capture banner live while the panel is open.
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'session' && changes[CAPTURE_KEY]) renderCaptureBanner();
  });
  window.addEventListener('focus', () => {
    void refreshSiteHost().then(() => render($('search').value));
  });

  // Restore: signed in + key still in this browser session → straight to vault.
  const { sessionToken, email, webBase, apiBase } = await store.get([
    'sessionToken',
    'email',
    'webBase',
    'apiBase',
  ]);
  $('web-base').value = webBase || DEFAULT_WEB_BASE;
  $('api-base').value = apiBase || DEFAULT_API_BASE;
  if (!sessionToken) {
    // Signed out: open on the landing screen - Get started leads to sign-in.
    show('landing');
    return;
  }
  const { vaultKeyRaw } = await sessionStore.get('vaultKeyRaw');
  if (vaultKeyRaw) {
    vaultKey = await crypto.subtle.importKey('raw', new Uint8Array(vaultKeyRaw), 'AES-GCM', true, [
      'encrypt',
      'decrypt',
    ]);
    try {
      $('me-email').textContent = email || '';
      await loadVault();
      return;
    } catch (e) {
      if (e.status !== 401) return fail(e.message);
      await dropSession();
    }
  }
  $('locked-email').textContent = email || '';
  show('locked');
}

void init();
