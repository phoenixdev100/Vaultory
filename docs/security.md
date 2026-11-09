# Vaultory security model

This document describes exactly what the server can and cannot see, and the limits of the design. It is written for operators and reviewers, not as marketing.

## Encryption architecture

```
password ──Argon2id──┬── authVerifier ──> server (scrypt-hashed at rest)
                     └── wrappingKey ──unwraps──> vaultKey (random 256-bit)

vaultKey ──AES-256-GCM──> ciphertext stored in Postgres
vaultKey ──ECDH-P-256 + AES-GCM──> serverWrappedVaultKey (reset escrow)
```

- **KDF**: Argon2id (`@noble/hashes`) - memory ~19 MiB, 2 iterations, parallelism 1, per-account salt derived from the email address. KDF parameters are stored per user (`kdf*`) so they can be raised later.
- **Two independent outputs** from one derivation: `authVerifier` (sent to the server for login) and `wrappingKey` (never leaves the device). The server cannot derive the wrapping key from the verifier.
- **Vault key**: a random 256-bit `CryptoKey`, generated at signup, wrapped with `wrappingKey` (AES-GCM) and stored as `wrappedVaultKey` on the user row.
- **Escrow copy**: the browser additionally encrypts the vault key to the server's public key - ECDH(P-256) shared secret used directly as an AES-256-GCM key - and stores it as `serverWrappedVaultKey`. This exists **only** so a password reset can recover the vault. The server's private scalar is derived from the `VAULT_WRAP_SECRET` environment variable and never leaves the server. This means Vaultory is **not strictly zero-knowledge**: a party holding both the database and `VAULT_WRAP_SECRET` could unwrap vault keys. The escrow exists deliberately so forgotten passwords do not destroy data; it is documented rather than hidden.
- **Secret payloads**: AES-256-GCM, random 96-bit nonce per write, serialized as `v1.<nonce>.<ciphertext>` inside the `ciphertext` column.

### What the server stores for each secret

Plaintext metadata: `title`, `category`, `tags`, `isFavorite`, `folderId`, `version`, timestamps. Everything sensitive - usernames, passwords, tokens, connection strings, notes, custom fields - is inside the encrypted payload.

Consequence: **server-side search covers metadata only** (title, tags). Client-side filtered views can additionally match decrypted values, but nothing sensitive is indexed server-side.

### File attachments

Any secret can hold encrypted files (`.env`, PEM/PPK keys, keystores, VPN configs, certificates - up to 2 MiB each, 20 per secret). File bytes are encrypted in the browser with the same vault key under AES-256-GCM, using a **separate AAD context** (`vaultory|attachment|v1`) so an attachment blob can never be replayed where a JSON payload is expected. Plaintext metadata is limited to `fileName`, `mimeType`, `size`, `keyVersion` and timestamps - the same trade-off as secret titles. Download fetches the ciphertext row and decrypts it locally; listing responses never include the blob. Attachments cascade-delete with their secret and are covered by the same per-user ownership checks, CSRF protection and rate limits as secret CRUD.

### What the password is used for - and is not

- The password is **never sent** to the API and never stored, in any form.
- `POST /auth/prelogin` returns the account's KDF parameters (and behaves identically for unknown emails - the login path runs a dummy verify to reduce timing disclosure).
- Login sends `{ email, authVerifier }`; the server compares a **scrypt** hash of the verifier. Compromising the user table does not reveal the password, the wrapping key, or any secret.

### Vault key lifecycle

- The raw key exists in a `useRef` inside `VaultProvider` - never in React state, `localStorage`, `sessionStorage`, or cookies.
- **While unlocked**, the `CryptoKey` is also persisted in IndexedDB (`vaultory-keystore`) so a page reload does not relock the vault. The record is scoped to the user id - a different account on the same browser profile cannot pick it up - and is wiped on manual lock, auto-lock, logout, session expiry and account deletion. Note this is a deliberate convenience trade-off: the key outlives a reload (anything running in this origin could use it for encrypt/decrypt while it persists), but it is never written to the server, cookies or `localStorage`.
- Manual lock and auto-lock (`autoLockMinutes`, user-configurable) clear the key - memory **and** IndexedDB - and flush the React Query cache, which holds decrypted values.
- **Password change** re-wraps the *same* vault key under the new password-derived key - no data loss, other sessions can be revoked.
- **Password reset** (forgot-password flow) recovers the vault via escrow:
  1. `POST /auth/reset-prepare` validates the emailed token (without consuming it), unwraps `serverWrappedVaultKey` in memory, and returns it re-encrypted to the browser's ephemeral ECDH key - the raw key never touches the wire or the database.
  2. The browser unwraps it, derives keys from the new password, and submits the key re-wrapped under the new wrapping key. `vaultKeyVersion` is unchanged and every secret keeps decrypting.
  3. Accounts created before escrow (`serverWrappedVaultKey IS NULL`) still rotate to a fresh key; their old ciphertext is preserved but unreadable ("stranded") and the UI requires an explicit acknowledgement for that path.

### Account two-factor authentication (TOTP)

- Optional RFC-6238 TOTP on the account, enrolled from Settings. The raw base32 secret is shown once for an authenticator app and stored **wrapped** (AES-256-GCM under a key derived from `SESSION_SECRET`), never in plaintext at rest.
- Setup generates an unconfirmed secret - 2FA only activates after the user proves possession with a valid code. Disable also requires a live code.
- With TOTP enabled, `POST /auth/login` returns `{ mfaRequired, mfaToken }` instead of a session. `mfaToken` is a short-lived HMAC-signed token that only proves the password step succeeded; `POST /auth/login/mfa` verifies the code and only then issues a session. The endpoint is rate-limited (10 attempts / 15 min).
- **Password reset clears TOTP** (`totpSecret`/`totpEnabled` nulled) - otherwise a forgotten-password flow could leave an account locked behind a 2FA the user may have lost. Documented as a deliberate trade-off: email access is the reset factor.

### Trash (soft delete)

`Secret.deletedAt` marks deletion. Normal listings and per-item routes filter it out; the item - including ciphertext attachments - stays intact and restorable for **30 days**. A lazy purge (`deletedAt < now - 30d`) runs on trash reads; `DELETE /secrets/:id/permanent` and `DELETE /secrets/trash` hard-delete immediately, cascading to attachments and version history.

### Breach check & health audit (client-side only)

The audit page computes weak/reused/aging-password findings **in the browser from decrypted payloads** - plaintext never reaches the API. The optional HaveIBeenPwned check uses the k-anonymity range endpoint: only the first 5 hex chars of the SHA-1 hash are sent (with `Add-Padding`); matching is done locally. Vaultory never sees the password, the full hash, or the result.

### Backups & imports

A Vaultory backup (`.json`) contains **ciphertext rows only** (`nonce`, `ciphertext`, `keyVersion`, `encVersion`) plus folder names - no plaintext, no vault key. Restoring uploads the same blobs untouched via the bulk endpoint, so a backup is only useful on the account that owns the vault key. Bitwarden/Chrome CSV and `.env` imports are parsed in the browser and encrypted before upload like normal secret creation.

### Secure sharing

Each account can publish an ECDH P-256 **share key**; the matching private key is stored wrapped under the owner's vault key, so the server never holds it usable. A share encrypts the payload under `AES-256-GCM(ECDH(ephemeral sender pair, recipient share key))` - the `Share` row stores only the ephemeral public point, nonce and ciphertext. The server is a dead drop; it cannot read shares. Honest caveats: the share title/category are plaintext (same model as secret rows), recipient lookup confirms whether an email has an account (same as any sharing system), and a malicious server could substitute a recipient's public key - shares have no out-of-band key verification yet.

### Emergency access

A trusted-contact grant pre-wraps the grantor's vault key to the grantee's share key **in the grantor's browser** and stores that ciphertext on the grant. The server is the policy point for the wait period: it releases the handover blob only after `waitUntil` passes without a grantor cancellation (or early on explicit approval). Trade-off, stated plainly: a hostile server could release the blob *early* - it still could not decrypt it, but the wait guarantee is server-enforced, not cryptographic. After release the grantee decrypts the vault key locally and pulls a read-only export of the grantor's ciphertext rows; every release is logged on both accounts.

### Passkey unlock

Passkeys use the WebAuthn **PRF extension**: the authenticator derives a deterministic secret for (credential, salt), which becomes the AES-GCM key wrapping the vault key. The server stores `{credentialId, salt, wrappedVaultKey}` - a blob that is useless without a live user-verifying assertion. This is a *convenience unlock* layered on an existing session, not a login factor: sessions still come from password (+TOTP) sign-in. Vault key rotation deletes stale passkey rows server-side. PRF requires Chrome/Edge 118+ or Safari 18+; other browsers keep password unlock.

### Browser extension & Bearer sessions

The extension is a separate client that talks to the API as `Authorization: Bearer`. Bearer requests skip the CSRF guard because the token is a caller-held secret, not ambient state. Sessions, hashing, revocation and expiry are identical to web sessions - a paired extension shows up in **Security → Sessions** and can be revoked like any device.

**Pairing (web-auth, password-free):** the primary sign-in path never types the password into the extension. `chrome.identity.launchWebAuthFlow` opens `/link-extension` on the web app carrying the extension's ephemeral ECDH P-256 **public key**. The page requires a signed-in, email-verified, unlocked-vault session and renders an explicit consent screen. On approval:

1. `POST /auth/extension-link` mints a one-time code (`VerificationToken` type `EXTENSION_LINK`, hashed at rest, 2-minute TTL, consumed atomically on exchange - one live code per account).
2. The page wraps the raw vault key locally under `AES-256-GCM(ECDH(ephemeral web pair, extension pub))` and the envelope returns inside the redirect **fragment** - it never crosses the API.
3. The extension calls `POST /auth/extension-session` (IP rate-limited 20/15min) to swap the code for a session, then unwraps the vault key with the private half that never left it.

Two hardening details: the `redirect_uri` must be an extension endpoint (`*.chromiumapp.org`, `*.allizom.org`, `chrome-extension:`, `moz-extension:`) - an open redirect would leak link codes; and the extension's private key is generated fresh per pairing attempt, so a stale URL is worthless. A direct email+password sign-in remains as a fallback and uses the same Argon2id + single-use `mfaToken` flow as the web app. The extension keeps the raw vault key only in `chrome.storage.session` and decrypts items locally.

**Credential capture:** the content script offers to save logins it observes at submit time (only while signed in, only when the Auto-save toggle is on). Captured credentials wait in `chrome.storage.session` (RAM) until the panel encrypts and uploads them like any secret.

### PWA cache boundaries

The service worker precaches **only the built app shell** (hashed JS/CSS/icons). `navigateFallback` denies `/api/*`, and no runtime caching is registered - no secret ciphertext, settings or session responses ever reach the Cache API. Offline, the shell loads but the vault simply cannot fetch data.

### Favicon proxy

Login favicons are fetched through `/api/meta/favicon?domain=…` (authenticated, validated hostname, 24 h in-memory cache, small response cap) rather than letting the browser call arbitrary sites - this hides *which* vaults reference which domains from the icon provider. SSRF hardening is layered: the hostname string must look public, the domain is then **resolved and every answer must be a public IP** (loopback, RFC1918, link-local, CGNAT and reserved ranges rejected on the initial host *and* on each redirect hop, which are followed manually), and cache misses are rate-limited per user (120/h) so the endpoint can't be used as an outbound-request amplifier. Residual: the outbound fetch re-resolves DNS, so a fast-flux attacker controlling their own authoritative DNS could theoretically race a private answer in after our check (TOCTOU) - the fetch also runs with no credentials inside a serverless sandbox, which bounds the impact.

## Session & transport security

- Session cookie `vaultory_session`: `HttpOnly`, `Secure` in production, `SameSite=Lax` (or `None` when `CROSS_SITE_COOKIES=true`), 30-day sliding expiry.
- Only an **HMAC hash** of the token is stored - a database leak does not leak usable sessions. Sessions can be listed and individually revoked; password change can revoke all others.
- Sessions carry a coarse `ipLabel` (last octet dropped) and an optional ISO alpha-2 `country` taken from the edge geo header (`x-vercel-ip-country`, `cf-ipcountry` fallback) - nothing finer is stored and no third-party geo lookup happens; bogus values are normalised to null. This powers the dashboard sign-in map and only exists for sessions created after the column shipped.
- **Email verification gate**: when `REQUIRE_EMAIL_VERIFICATION=true` (the default), `requireVerifiedEmail` blocks every vault/security route (`secrets`, `folders`, `shares`, `emergency`, `activity`, `dashboard`, `meta`, `settings` protected ops, `account/passkeys`) with `403 email_not_verified` until `emailVerifiedAt` is set. Sign-up still succeeds and the user stays signed in - they can only verify (via the emailed link or the authenticated 6-digit code endpoint) and resend the email. In production the flag requires a real mail transport; `EMAIL_TRANSPORT=console` + required verification is rejected at boot. The console transport returns `previewUrl`/`previewCode` so the flow is testable locally without sending mail.
- **Mail pipeline**: `EMAIL_TRANSPORT` selects `console` (dev preview, sends nothing), `resend`, or `smtp` - the user's own mailbox via `SMTP_HOST/PORT/SECURE/USER/PASS` (Nodemailer; port 465 = SSL, 587 = STARTTLS). Missing SMTP fields fail boot validation. Verification mails carry both a single-use link token and a 6-digit OTP (each stored only as an HMAC hash, 24 h TTL); password-reset links are single-use and expire after **exactly 10 minutes**, enforced server-side (`expiresAt <= now` plus `usedAt` checks on all three reset endpoints); a resend invalidates every prior unused token. A welcome email is sent best-effort at signup - failure is logged, never blocks the account. All tokens/codes are HMAC-hashed at rest; templates escape user-controlled values (name, email) before embedding them in HTML.
- **CSRF**: token derived from the session token via HMAC, returned at login/`/auth/me`, required as `X-CSRF-Token` on every unsafe method. Additionally an **origin guard** rejects unsafe requests whose `Origin`/`Referer` is not in `CORS_ORIGINS`, covering pre-auth endpoints.
- **CORS**: allowlist only, credentials enabled; no wildcard.
- **Headers**: Helmet defaults (CSP for API responses, nosniff, frame-deny, etc.). The static frontend sets nosniff/frame-deny/referrer-policy via `frontend/vercel.json`.

## Abuse resistance

- Credential endpoints use **database-backed counters** (`RateLimitCounter` table): signup 10/h/IP, login 10/h/IP+account-bucketed, forgot-password 5/h per email+IP, reset-token-info 30/h, reset-prepare/reset-password 20/h, verify-email link 20/h, OTP verify 10/h **per user**, resend-verification 5/h **per user** (per-user so an account can't spam inboxes from rotating IPs). These hold across serverless cold starts.
- User-enumeration-adjacent and outbound-cost endpoints are user-bucketed the same way: `GET /shares/lookup` 30/h, favicon cache misses 120/h.
- A coarse per-instance `express-rate-limit` (300/min) blunts request storms, plus a tighter 60/min burst cap on `/api/auth/*` so credential-stuffing floods die in memory before reaching the DB counters. On Vercel these apply per warm lambda - a backstop, not the primary protection.
- **Disposable-mail block**: a vendored ~9.9k-domain blocklist (`src/services/disposableDomains.generated.ts`, martenson/disposable-email-domains; regenerate with `scripts/gen-disposable-domains.mjs`) rejects temp-mail addresses with `400 disposable_email` on signup, prelogin, login and forgot-password - including subdomains of listed domains.
- **Signup honeypot**: the form carries a visually-hidden `website` field that humans never fill; any value → generic 400, no account created.
- **Request hygiene**: unsafe methods must be `application/json` (415 otherwise), URLs over 2 KB → 414, JSON bodies capped at 4 MB, and the standalone server sets `headersTimeout`/`requestTimeout`/`keepAliveTimeout`/`maxRequestsPerSocket` against slow-loris-style connection abuse (on Vercel the edge enforces these before lambda invocation).
- All request bodies/query/params validated with Zod; errors return `{ error: { code, message } }` without internals.
- Pino logs redact authorization headers, cookies, and request bodies. Secret values never reach the server, so they cannot be logged.

## Authorization

Every secret/folder/activity query is scoped by `userId` from the session - ownership is enforced in the query (`WHERE userId = … AND id = …`), so a foreign id yields 404, never 403-with-leak. Destructive routes (account delete, password change) re-verify the `authVerifier` derived from the current password.

## Known limits (honest list)

- **Metadata is not encrypted.** Titles/tags exist in plaintext to make search work. Do not put sensitive strings in titles or tags.
- **Recovery escrow weakens the zero-knowledge claim.** The server *can* unwrap `serverWrappedVaultKey` in memory (it must, during a reset). Losing both the database and `VAULT_WRAP_SECRET` to an attacker would expose vault keys. Secret values still never travel in plaintext and are encrypted before leaving the browser - but an adversary inside the running server could in principle decrypt. Keep `VAULT_WRAP_SECRET` in a secrets manager, separate from the database credentials.
- **Emergency-access wait is server-enforced.** The release blob is ciphertext, but *when* it is handed out is a server decision, not a cryptographic one.
- **Share key substitution.** A malicious server could return a different recipient share key at lookup time, letting it read that one share. Mitigation (key fingerprints/QRs) is not implemented.
- **Bearer tokens travel in headers.** Extension sessions carry the raw token in `Authorization` - equivalent power to the cookie, so treat extension installs and `chrome.storage` as part of the device trust boundary. Bearer requests bypass the origin guard and CSRF check by design (a cross-site page cannot attach a caller-held secret, and `requireAuth` never falls back to the cookie once a Bearer header is present, so ambient auth can't be smuggled under one).
- **Legacy accounts** (created before escrow) cannot recover; their reset still rotates the key.
- **Browser trust boundary.** XSS would be catastrophic (as for every client-side crypto app): the CSP is strict about inline scripts, but keep the deployment to the provided configs.
- **Clipboard** copies stay in the OS clipboard until overwritten - a reminder toast is shown; nothing wipes it automatically.
- Per-instance general rate limiting does not aggregate across warm lambdas.
