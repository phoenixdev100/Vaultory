/**
 * Content bridge for Vaultory.
 *
 * 1. Autofill: the panel sends `vaultory:fill` and we populate the closest
 *    username/password inputs, dispatching input events so reactive
 *    frameworks pick the values up. Read-only on the page - nothing is sent
 *    back or persisted.
 * 2. Capture: when a login form is submitted (form submit, or Enter inside
 *    a password field for JS-driven logins), the credentials are handed to
 *    the service worker - which either auto-saves them (Auto-save ON) or
 *    queues them for the popup's "Save this login?" prompt (Auto-save OFF).
 *    Only runs while signed in; nothing is logged or exfiltrated anywhere
 *    except the extension's own session storage.
 */

const visible = (el) => !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
const userMatch = /user|email|login|account|name|id/i;

function collectCredentials(scope) {
  const inputs = Array.from(scope.querySelectorAll('input')).filter(
    (el) => visible(el) && !el.disabled && !el.readOnly,
  );
  const passwordField = inputs.find((el) => el.type === 'password' && el.value);
  if (!passwordField) return null;

  const usernameField = inputs.find(
    (el) =>
      ['text', 'email', 'tel', 'url'].includes(el.type) &&
      el.value &&
      (userMatch.test(`${el.name} ${el.id} ${el.autocomplete} ${el.placeholder}`) ||
        el.autocomplete === 'username'),
  );
  return { username: usernameField?.value.trim() ?? '', password: passwordField.value };
}

function maybeCapture(scope) {
  chrome.storage.local.get('sessionToken').then(({ sessionToken }) => {
    // Only queue captures while signed in - the background worker decides
    // whether to auto-save silently or hold them for the popup prompt.
    if (!sessionToken) return;
    const creds = collectCredentials(scope);
    if (!creds || (!creds.username && !creds.password)) return;
    chrome.runtime
      .sendMessage({
        type: 'vaultory:capture',
        origin: location.origin,
        title: document.title,
        username: creds.username,
        password: creds.password,
      })
      .catch(() => {});
  });
}

document.addEventListener('submit', (event) => {
  if (event.target instanceof HTMLFormElement) maybeCapture(event.target);
}, true);

// JS-driven logins often skip the submit event - catch Enter in a password
// field inside a form-ish container.
document.addEventListener('keydown', (event) => {
  if (event.key !== 'Enter') return;
  const el = event.target;
  if (!(el instanceof HTMLInputElement) || el.type !== 'password') return;
  const scope = el.closest('form') ?? el.closest('div') ?? document;
  maybeCapture(scope);
}, true);

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== 'vaultory:fill') return;

  const setValue = (el, value) => {
    el.focus();
    el.value = value;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  };

  const inputs = Array.from(document.querySelectorAll('input')).filter(
    (el) => visible(el) && !el.disabled && !el.readOnly,
  );

  const passwordFields = inputs.filter((el) => el.type === 'password');
  const usernameFields = inputs.filter(
    (el) =>
      ['text', 'email', 'tel', 'url'].includes(el.type) &&
      (userMatch.test(`${el.name} ${el.id} ${el.autocomplete} ${el.placeholder}`) ||
        el.autocomplete === 'username'),
  );

  let filled = 0;
  const passwordField = passwordFields[0];
  if (passwordField && message.password) {
    setValue(passwordField, message.password);
    filled += 1;
  }
  const usernameField =
    usernameFields[0] ??
    (passwordField
      ? inputs.find((el) => ['text', 'email'].includes(el.type) && el.compareDocumentPosition(passwordField) & Node.DOCUMENT_POSITION_FOLLOWING)
      : inputs.find((el) => ['text', 'email'].includes(el.type)));
  if (usernameField && message.username) {
    setValue(usernameField, message.username);
    filled += 1;
  }

  sendResponse({ filled });
  return true;
});
