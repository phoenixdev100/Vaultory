import { createHmac } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';

const RUN = Date.now();
const EMAIL = `vaultory-e2e-${RUN}@example.com`;
const PASSWORD = `E2e-pass-${RUN}-x!`;
const SECRET_VALUE = `e2e-secret-${RUN}-value`;
const NAME = 'E2E Tester';

/**
 * Client-side navigation helpers. `page.goto()` performs a real reload, which
 * (correctly) wipes the in-memory vault key - so inside a session we move
 * through the app the way a user would: links and sidebar items.
 */
const nav = (page: Page) => page.locator('nav[aria-label="Main"]').first();

/**
 * Signup + email verification. REQUIRE_EMAIL_VERIFICATION is on, so a fresh
 * account lands on the verify wall; the dev mailer echoes the OTP in the
 * signup response (previewCode), which we type straight into the wall.
 */
async function signupAndVerify(
  page: Page,
  { email, password, name }: { email: string; password: string; name?: string },
) {
  await page.goto('/signup');
  if (name) await page.locator('#name').fill(name);
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);
  await page.locator('#confirmPassword').fill(password);
  await page.getByRole('checkbox').click();

  const responsePromise = page.waitForResponse('**/api/auth/signup');
  await page.getByRole('button', { name: /create vault/i }).click();
  const response = await responsePromise;
  const body = (await response.json()) as { emailVerification?: { previewCode?: string } };
  const code = body.emailVerification?.previewCode;
  expect(code).toMatch(/^\d{6}$/);

  await expect(page).toHaveURL(/\/dashboard/, { timeout: 60_000 });
  // The verification wall - unverified users cannot reach the vault.
  await expect(page.getByText(/email address is not verified/i)).toBeVisible();
  // "I have a code" opens the OTP dialog; the six boxes take the digits.
  await page.getByRole('button', { name: /i have a code/i }).click();
  await page.locator('#verify-email-code-0').click();
  await page.keyboard.type(code!);
  await page.getByRole('button', { name: /verify email/i }).click();
  await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible({ timeout: 60_000 });
}

// --- RFC 6238 TOTP for the 2FA e2e: the code the authenticator app would show.
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
function base32Decode(encoded: string): Buffer {
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const char of encoded.replace(/=+$/, '').toUpperCase()) {
    const idx = B32.indexOf(char);
    if (idx === -1) throw new Error(`bad base32 char ${char}`);
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}
function totp(secret: Buffer, timeMs = Date.now()): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(timeMs / 1000 / 30)));
  const hmac = createHmac('sha1', secret).update(counter).digest();
  const offset = hmac[hmac.length - 1]! & 0x0f;
  const code =
    ((hmac[offset]! & 0x7f) << 24) |
    (hmac[offset + 1]! << 16) |
    (hmac[offset + 2]! << 8) |
    hmac[offset + 3]!;
  return (code % 1_000_000).toString().padStart(6, '0');
}

test('password reset recovers the vault: secrets still decrypt', async ({ page }) => {
  const email = `vaultory-e2e-reset-${RUN}@example.com`;
  const oldPassword = `E2e-old-${RUN}-x!`;
  const newPassword = `E2e-new-${RUN}-y!`;
  const secretValue = `reset-survivor-${RUN}`;

  await test.step('signup and save a secret', async () => {
    await signupAndVerify(page, { email, password: oldPassword });

    await page.getByRole('link', { name: 'New secret' }).first().click();
    await page.locator('#title').fill('Reset survivor');
    await page.locator('#field-password').fill(secretValue);
    await page.getByRole('button', { name: /encrypt & save/i }).click();
    await expect(page).toHaveURL(/\/vault\/[0-9a-f-]{36}/);

    await page.getByRole('button', { name: 'Account menu' }).click();
    await page.getByRole('menuitem', { name: /sign out/i }).click();
    await expect(page).toHaveURL(/\/login/);
  });

  await test.step('request a reset link and complete the reset', async () => {
    await page.goto('/forgot-password');
    await page.locator('#email').fill(email);

    // EMAIL_TRANSPORT=console returns the reset link in the API response.
    const responsePromise = page.waitForResponse('**/api/auth/forgot-password');
    await page.getByRole('button', { name: /send reset link|email me a link/i }).click();
    const response = await responsePromise;
    const body = (await response.json()) as { previewUrl?: string };
    expect(body.previewUrl).toContain('/reset-password?token=');

    await page.goto(body.previewUrl!);
    await expect(page.getByRole('heading', { name: /choose a new password/i })).toBeVisible();
    // Escrowed key -> the reassuring copy, not the data-loss warning.
    await expect(page.getByText(/your vault stays intact/i)).toBeVisible();

    await page.locator('#password').fill(newPassword);
    await page.locator('#confirmPassword').fill(newPassword);
    await page.getByRole('button', { name: /set new password/i }).click();
    await expect(page.getByText(/your vault is untouched/i)).toBeVisible({ timeout: 60_000 });
  });

  await test.step('login with the new password still decrypts the secret', async () => {
    await page.goto('/login');
    await page.locator('#email').fill(email);
    await page.locator('#password').fill(newPassword);
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 60_000 });

    await nav(page).getByRole('link', { name: 'Vault' }).click();
    await page.getByRole('link', { name: 'Reset survivor' }).click();

    await page.getByRole('button', { name: /show password/i }).click();
    await expect(page.getByText(secretValue)).toBeVisible();
  });
});

test('encrypted .env attachment uploads, downloads and survives relogin', async ({ page }) => {
  const email = `vaultory-e2e-file-${RUN}@example.com`;
  const password = `E2e-file-${RUN}-x!`;
  const envContent = `DATABASE_URL=postgres://e2e:${RUN}@host/db\nJWT_SECRET=e2e-${RUN}\n`;

  await test.step('signup and create an env secret', async () => {
    await signupAndVerify(page, { email, password });

    await page.getByRole('link', { name: 'New secret' }).first().click();
    await page.locator('#title').fill('Backend env file');
    await page.locator('#category').press('Enter');
    await page.getByRole('option', { name: 'Environment variables' }).click();
    await page.locator('#field-variables').fill(envContent);
    await page.getByRole('button', { name: /encrypt & save/i }).click();
    await expect(page).toHaveURL(/\/vault\/[0-9a-f-]{36}/);
  });

  await test.step('attach the raw .env file', async () => {
    // Drive the real user path: the hidden input is fed through the file
    // chooser opened by "Attach file" (direct setInputFiles misses the
    // change event on the React-wired hidden input).
    const chooserPromise = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: 'Attach file' }).click();
    await (await chooserPromise).setFiles({
      name: 'production.env',
      mimeType: 'text/plain',
      buffer: Buffer.from(envContent),
    });
    await expect(page.getByText(/attached "production\.env"/i)).toBeVisible({ timeout: 30_000 });
  });

  await test.step('download decrypts to the original bytes', async () => {
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download production.env' }).click();
    const download = await downloadPromise;
    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream!) chunks.push(chunk as Buffer);
    expect(Buffer.concat(chunks).toString()).toBe(envContent);
  });

  await test.step('file survives logout and relogin', async () => {
    await page.getByRole('button', { name: 'Account menu' }).click();
    await page.getByRole('menuitem', { name: /sign out/i }).click();
    await expect(page).toHaveURL(/\/login/);

    await page.locator('#email').fill(email);
    await page.locator('#password').fill(password);
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 60_000 });

    await nav(page).getByRole('link', { name: 'Vault' }).click();
    await page.getByRole('table').getByRole('link', { name: 'Backend env file' }).click();
    await expect(page.getByText('production.env').first()).toBeVisible();

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download production.env' }).click();
    const download = await downloadPromise;
    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream!) chunks.push(chunk as Buffer);
    expect(Buffer.concat(chunks).toString()).toBe(envContent);
  });
});

test('trash keeps deleted items recoverable, then purge removes them', async ({ page }) => {
  const email = `vaultory-e2e-trash-${RUN}@example.com`;
  const password = `E2e-trash-${RUN}-x!`;
  const title = `Trash e2e ${RUN}`;

  await signupAndVerify(page, { email, password });

  // Create a secret, then move it to the trash from the vault row menu.
  await page.getByRole('link', { name: 'New secret' }).first().click();
  await page.locator('#title').fill(title);
  await page.locator('#field-password').fill('trash-me-123');
  await page.getByRole('button', { name: /encrypt & save/i }).click();
  await expect(page).toHaveURL(/\/vault\/[0-9a-f-]{36}/);

  await nav(page).getByRole('link', { name: 'Vault' }).click();
  await page.getByRole('button', { name: `Actions for ${title}` }).click();
  await page.getByRole('menuitem', { name: /^delete$/i }).click();
  const confirm = page.getByRole('alertdialog');
  await expect(confirm).toBeVisible();
  await confirm.getByRole('button', { name: /move to trash/i }).click();
  await expect(page.getByRole('link', { name: title })).not.toBeVisible();

  // The trash page shows it with remaining days, and restore brings it back.
  await nav(page).getByRole('link', { name: 'Trash' }).click();
  await expect(page.getByRole('heading', { name: 'Trash', exact: true })).toBeVisible();
  await expect(page.getByText(title, { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Restore' }).click();
  await expect(page.getByRole('button', { name: 'Restore' })).not.toBeVisible();

  await nav(page).getByRole('link', { name: 'Vault' }).click();
  await expect(page.getByRole('link', { name: title })).toBeVisible();

  // Trash again, then permanent delete removes it entirely.
  await page.getByRole('button', { name: `Actions for ${title}` }).click();
  await page.getByRole('menuitem', { name: /^delete$/i }).click();
  const confirm2 = page.getByRole('alertdialog');
  await expect(confirm2).toBeVisible();
  await confirm2.getByRole('button', { name: /move to trash/i }).click();

  await nav(page).getByRole('link', { name: 'Trash' }).click();
  await page.getByRole('button', { name: 'Delete forever' }).click();
  await page.getByRole('button', { name: /^delete forever$/i }).last().click();
  await expect(page.getByText(/the trash is empty/i)).toBeVisible();
});

test('account TOTP: enrol on the security page, then login requires the code', async ({ page }) => {
  const email = `vaultory-e2e-totp-${RUN}@example.com`;
  const password = `E2e-totp-${RUN}-x!`;

  await signupAndVerify(page, { email, password });

  // Enrol: account menu -> Security -> Two-factor authentication -> Set up.
  await page.getByRole('button', { name: 'Account menu' }).click();
  await page.getByRole('menuitem', { name: /^security$/i }).click();
  await expect(page).toHaveURL(/\/security/);
  await page.getByRole('button', { name: 'Set up' }).click();

  // Read the base32 secret rendered under the QR code and confirm with a live code.
  const secretText = await page.locator('.select-all').innerText();
  const secret = base32Decode(secretText.trim());
  await page.locator('#totp-confirm-code').fill(totp(secret));
  await page.getByRole('button', { name: /enable two-factor/i }).click();
  await expect(page.getByText(/asks for a 6-digit code/i)).toBeVisible({ timeout: 30_000 });

  // Sign out - a password-only login must now stop at the code step.
  await page.getByRole('button', { name: 'Account menu' }).click();
  await page.getByRole('menuitem', { name: /sign out/i }).click();
  await expect(page).toHaveURL(/\/login/);

  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page.getByRole('heading', { name: /two-factor authentication/i })).toBeVisible({
    timeout: 60_000,
  });

  // A wrong code is rejected; a real one completes login.
  await page.locator('#totp-code').fill('000000');
  await page.getByRole('button', { name: /verify and sign in/i }).click();
  await expect(page.getByText(/not correct|expired/i)).toBeVisible({ timeout: 30_000 });

  await page.locator('#totp-code').fill(totp(secret));
  await page.getByRole('button', { name: /verify and sign in/i }).click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 60_000 });
});

test('landing page loads with real content', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /every credential you own/i })).toBeVisible();
  await expect(page.getByRole('link', { name: /get started/i }).first()).toBeVisible();
});

test('complete vault journey: signup → secrets → lock → relogin → delete', async ({ page }) => {
  await test.step('signup derives keys locally, verifies email, lands on the dashboard', async () => {
    await signupAndVerify(page, { email: EMAIL, password: PASSWORD, name: NAME });
  });

  await test.step('create a login secret, reveal and copy it', async () => {
    await page.getByRole('link', { name: 'New secret' }).first().click();
    await expect(page).toHaveURL(/\/vault\/new/);

    await page.locator('#title').fill('E2E GitHub login');
    await page.locator('#field-username').fill('e2e@example.com');
    await page.locator('#field-password').fill(SECRET_VALUE);
    await page.getByRole('button', { name: /encrypt & save/i }).click();

    await expect(page).toHaveURL(/\/vault\/[0-9a-f-]{36}/);
    await expect(page.getByRole('heading', { name: 'E2E GitHub login' })).toBeVisible();
    await expect(page.getByText(SECRET_VALUE)).not.toBeVisible();

    await page.getByRole('button', { name: /show password/i }).click();
    await expect(page.getByText(SECRET_VALUE)).toBeVisible();

    await page.getByRole('button', { name: /copy password/i }).click();
    await expect(page.getByText(/copied to clipboard/i).first()).toBeVisible();
    await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(SECRET_VALUE);
  });

  await test.step('search finds the item by title', async () => {
    await nav(page).getByRole('link', { name: 'Vault' }).click();
    await expect(page.getByRole('heading', { name: 'Vault', exact: true })).toBeVisible();

    await page.getByLabel('Search vault').fill('GitHub');
    await expect(
      page.getByRole('table').getByRole('link', { name: 'E2E GitHub login' }),
    ).toBeVisible();

    await page.getByLabel('Search vault').fill('no-such-item-xyz');
    await expect(page.getByText(/nothing matches/i)).toBeVisible();
  });

  await test.step('manual lock wipes the key and requires the password again', async () => {
    await page.getByLabel('Lock vault').click();
    await expect(page.getByRole('heading', { name: /your vault is locked/i })).toBeVisible();

    // A wrong password must not unlock.
    await page.locator('#unlock-password').fill('definitely-wrong-password');
    await page.getByRole('button', { name: /unlock vault/i }).click();
    await expect(page.getByText(/did not unlock/i)).toBeVisible({ timeout: 30_000 });

    await page.locator('#unlock-password').fill(PASSWORD);
    await page.getByRole('button', { name: /unlock vault/i }).click();
    await expect(page.getByRole('heading', { name: 'Vault', exact: true })).toBeVisible({ timeout: 60_000 });
  });

  await test.step('logout, login again, and data survives the round trip', async () => {
    await page.getByRole('button', { name: 'Account menu' }).click();
    await page.getByRole('menuitem', { name: /sign out/i }).click();
    await expect(page).toHaveURL(/\/login/);

    await page.locator('#email').fill(EMAIL);
    await page.locator('#password').fill(PASSWORD);
    await page.getByRole('button', { name: /sign in/i }).click();

    await expect(page).toHaveURL(/\/dashboard/, { timeout: 60_000 });

    await nav(page).getByRole('link', { name: 'Vault' }).click();
    // The dashboard also links to the secret (timeline + recent cards) and can
    // still be mounted while the vault route swaps in - scope to the secrets
    // table, which only exists on the vault list.
    await expect(
      page.getByRole('table').getByRole('link', { name: 'E2E GitHub login' }),
    ).toBeVisible();
  });

  await test.step('a full page reload restores the vault key - no relock', async () => {
    await page.reload();

    // The persisted IndexedDB key unlocks the vault without the password.
    await expect(
      page.getByRole('table').getByRole('link', { name: 'E2E GitHub login' }),
    ).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole('heading', { name: /your vault is locked/i })).not.toBeVisible();

    // The secret still decrypts after the reload.
    await page.getByRole('table').getByRole('link', { name: 'E2E GitHub login' }).click();
    await page.getByRole('button', { name: /show password/i }).click();
    await expect(page.getByText(SECRET_VALUE)).toBeVisible();
  });

  await test.step('account deletion removes everything and signs out', async () => {
    await page.getByRole('button', { name: 'Account menu' }).click();
    await page.getByRole('menuitem', { name: /settings/i }).click();
    await expect(page).toHaveURL(/\/settings/);

    await page.getByRole('button', { name: 'Delete', exact: true }).click();
    await page.locator('#delete-confirm').fill('DELETE MY VAULT');
    await page.locator('#delete-password').fill(PASSWORD);
    await page.getByRole('button', { name: /delete everything/i }).click();

    await expect(page).toHaveURL(/\/login/, { timeout: 30_000 });

    // The account is gone - login now fails with the generic error.
    await page.locator('#email').fill(EMAIL);
    await page.locator('#password').fill(PASSWORD);
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page.getByText(/invalid email or password/i)).toBeVisible({ timeout: 30_000 });
  });
});

test('dashboard visualisations render', async ({ page }) => {
  const email = `vaultory-e2e-dash-${RUN}@example.com`;
  const password = `E2e-dash-${RUN}-x!`;

  await signupAndVerify(page, { email, password });

  // Two secrets so the donut and timeline have real data.
  await page.getByRole('link', { name: 'New secret' }).first().click();
  await page.locator('#title').fill('Github login');
  await page.locator('#field-username').fill('dev@example.com');
  await page.locator('#field-password').fill(`Str0ng!Pass-${RUN}`);
  await page.getByRole('button', { name: /encrypt & save/i }).click();
  await expect(page).toHaveURL(/\/vault\/[0-9a-f-]{36}/);

  await page.getByRole('link', { name: 'New secret' }).first().click();
  await page.locator('#title').fill('Stripe key');
  // Keyboard-open is deterministic for the Radix select (a fast pointer
  // down/up can race the popper open).
  await page.locator('#category').press('Enter');
  await page.getByRole('option', { name: /api key/i }).click();
  await page.locator('#field-token').fill(`sk_live_e2e_${RUN}`);
  await page.getByRole('button', { name: /encrypt & save/i }).click();
  await expect(page).toHaveURL(/\/vault\/[0-9a-f-]{36}/);

  await nav(page).getByRole('link', { name: 'Dashboard' }).click();
  await expect(page).toHaveURL(/\/dashboard/);

  await expect(page.getByText('Vault health')).toBeVisible();
  await expect(page.getByRole('img', { name: /security score/i })).toBeVisible();
  await expect(page.getByRole('img', { name: /Login: 1/i })).toBeVisible();
  await expect(page.getByText('Vault activity')).toBeVisible();
  await expect(page.getByText('Rotation timeline')).toBeVisible();

  // The security-focused widgets live on the dedicated Security page.
  await nav(page).getByRole('link', { name: 'Security' }).click();
  await expect(page).toHaveURL(/\/security/);
  await expect(page.getByText('Security checklist')).toBeVisible();
  await expect(page.getByText('Sign-in locations')).toBeVisible();
  await expect(page.getByText('Breach watch')).toBeVisible();
  await expect(page.getByText('Two-factor authentication')).toBeVisible();
  await expect(page.getByText('Active sessions')).toBeVisible();
});

test('nested folders, view-mode persistence and session sign-out', async ({ page, browser }) => {
  const email = `vaultory-e2e-feat-${RUN}@example.com`;
  const password = `E2e-feat-${RUN}-x!`;
  await signupAndVerify(page, { email, password });

  await test.step('folder inside a folder renders as a nested tree', async () => {
    await nav(page).getByRole('link', { name: 'Folders' }).click();
    await expect(page).toHaveURL(/\/folders/);

    // Create a top-level folder.
    await page.getByRole('button', { name: 'New folder' }).click();
    await page.locator('#folder-name').fill(`Work-${RUN}`);
    await page.getByRole('button', { name: 'Create folder' }).click();
    await expect(page.getByText(`Work-${RUN}`).first()).toBeVisible();

    // Create a subfolder through the row action menu.
    await page.getByRole('button', { name: `Actions for Work-${RUN}` }).first().click();
    await page.getByRole('menuitem', { name: /new subfolder/i }).click();
    await expect(page.getByText(/new subfolder in/i)).toBeVisible();
    await page.locator('#folder-name').fill(`Clients-${RUN}`);
    await page.getByRole('button', { name: 'Create folder' }).click();
    await expect(page.getByText(`Clients-${RUN}`).first()).toBeVisible();
  });

  await test.step('list/grid choice persists across navigation', async () => {
    await page.getByRole('button', { name: 'List view' }).click();
    await expect(page.getByRole('button', { name: 'List view' })).toHaveAttribute('aria-pressed', 'true');

    // Navigate away and back - the choice must stick (localStorage-backed).
    await nav(page).getByRole('link', { name: 'Dashboard' }).click();
    await expect(page).toHaveURL(/\/dashboard/);
    await nav(page).getByRole('link', { name: 'Folders' }).click();
    await expect(page.getByRole('button', { name: 'List view' })).toHaveAttribute('aria-pressed', 'true');
  });

  await test.step('vault page honours its own independent view choice', async () => {
    await nav(page).getByRole('link', { name: 'Vault' }).click();
    await expect(page).toHaveURL(/\/vault/);
    await page.getByRole('button', { name: 'Grid view' }).click();
    await expect(page.getByRole('button', { name: 'Grid view' })).toHaveAttribute('aria-pressed', 'true');
  });

  await test.step('per-session sign-out confirms first, then kicks the other device', async () => {
    // Second device: a fresh browser context logged in to the same account.
    const otherContext = await browser.newContext();
    const otherPage = await otherContext.newPage();
    await otherPage.goto('/login');
    await otherPage.locator('#email').fill(email);
    await otherPage.locator('#password').fill(password);
    await otherPage.getByRole('button', { name: /sign in/i }).click();
    await expect(otherPage).toHaveURL(/\/dashboard/, { timeout: 60_000 });

    await nav(page).getByRole('link', { name: 'Security' }).click();
    await expect(page).toHaveURL(/\/security/);
    await expect(page.getByText('Active sessions')).toBeVisible();

    // Two sessions listed; only the other one carries the X control.
    await expect(page.getByText('This device')).toBeVisible();
    const xButton = page.getByRole('button', { name: /^Sign out Mozilla/ });
    await expect(xButton).toHaveCount(1);

    // X opens a confirmation dialog - cancel keeps the session, confirm kills it.
    await xButton.click();
    await expect(page.getByText('Sign out this session?')).toBeVisible();
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByText('Sign out this session?')).not.toBeVisible();

    await xButton.click();
    await page.getByRole('button', { name: 'Sign out session' }).click();
    await expect(page.getByRole('button', { name: /^Sign out Mozilla/ })).toHaveCount(0);

    // The revoked device's next navigation lands on the login screen.
    await otherPage.reload();
    await expect(otherPage).toHaveURL(/\/login/, { timeout: 60_000 });
    await otherContext.close();
  });
});
