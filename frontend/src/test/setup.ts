import '@testing-library/jest-dom/vitest';
import { webcrypto } from 'node:crypto';

// jsdom ships `getRandomValues` but no SubtleCrypto; Node's implementation is
// the same Web Crypto API the browser provides, so the crypto code under test
// runs unmodified.
if (!globalThis.crypto || !('subtle' in globalThis.crypto)) {
  Object.defineProperty(globalThis, 'crypto', {
    value: webcrypto,
    configurable: true,
    writable: true,
  });
}
