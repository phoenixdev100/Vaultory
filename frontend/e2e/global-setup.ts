import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * The e2e journey performs a real signup, which counts against the
 * database-backed per-IP rate limit. Repeated local runs would exhaust it,
 * so the ephemeral counters are cleared before each run. (Unit/API tests
 * seed users directly instead.)
 */
export default function globalSetup() {
  const backend = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../backend');
  execFileSync('npx', ['tsx', 'scripts/clear-rate-limits.ts'], {
    cwd: backend,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
}
