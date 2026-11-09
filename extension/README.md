# Vaultory browser extension (MV3)

A Manifest V3 extension that signs in to your Vaultory account and autofills
logins on the sites you visit. Secrets decrypt locally, inside the extension.

## How it works

- **Sign-in** happens inside the popup: it calls `/auth/prelogin` for the
  account's stored KDF params, derives the auth verifier with Argon2id (the
  password never leaves the extension) and exchanges it for a session token
  used as `Authorization: Bearer`. Accounts with TOTP get an inline code
  field - the same single-use `mfaToken` flow as the web app.
- **Unlock** unwraps the vault key in memory and reuses the wrapping key it
  already derived at sign-in, so Argon2id runs once per password entry. The
  raw key is held only in `chrome.storage.session` (RAM-backed, wiped when
  the browser closes); Lock wipes it and sign-out also revokes the server
  session.
- **Screens**: a landing screen leads to sign-in, then the vault. Light
  theme is the default; the header sun/moon button toggles dark mode and
  the choice is remembered.
- **Secrets** are fetched as ciphertext (following `nextCursor` past the
  API's 50-row pages) and decrypted locally with the same AES-256-GCM/AAD
  format as the app. Undecryptable rows are skipped.
- **On this site** ranks items whose `url`/`website` field matches the
  current tab's domain first. **Fill** targets the last normal tab via the
  service worker and fills with real input events (React/Vue friendly).
- **Auto-save**: when you log into a site, the content script queues the
  credentials (only while signed in, only when the toggle is on) and the
  popup offers to encrypt and save them - toggle it in the vault footer.
- **Live data**: the popup fetches fresh on open, every minute while open,
  and whenever you refocus it.

## Install (unpacked, dev)

1. `chrome://extensions` → enable **Developer mode** → **Load unpacked** →
   pick this `extension/` folder.
2. Click the toolbar icon - the popup opens on the landing screen →
   **Get started** → sign in. The API (`http://localhost:4000`) and web-app
   (`http://localhost:5173`) origins come prefilled for local dev - no setup
   needed. On a custom deployment, point them at your origins once under
   **Server settings**; they are remembered.
3. Visit any login page → pick an item → **Fill**.

## Notes & limitations

- Works with TOTP accounts (inline 2FA at sign-in).
- Vault key rotation or a password reset requires signing in again.
- `vendor/noble/` is `@noble/hashes` vendored for the Argon2id KDF - keep it
  in sync with the frontend version.
- Firefox is not targeted (MV3 differences); Chrome/Edge are supported.
- An optional password-free pairing flow also exists: the web app's
  `/link-extension` page can hand a session + ECDH-wrapped vault key to a
  companion extension build (`/auth/extension-link` + `/auth/extension-session`).
