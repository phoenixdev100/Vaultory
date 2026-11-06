import { CheckCircle2, Loader2, MonitorSmartphone, ShieldAlert, XCircle } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { AuthLayout } from '@/features/auth/auth-layout';
import { useCurrentUser } from '@/features/auth/auth-context';
import { useVault } from '@/features/vault/vault-context';
import { api } from '@/lib/api';
import { wrapVaultKeyForExtension } from '@/lib/crypto/extension-link';

type Stage = 'confirm' | 'working' | 'done' | 'denied' | 'error';

/**
 * Extension pairing consent. The extension opened this page inside
 * chrome.identity.launchWebAuthFlow with its ephemeral public key in `pk`
 * and its redirect endpoint in `redirect_uri`. Approving mints a one-time
 * link code (server) and wraps the vault key to the extension's key
 * (locally, in this page) - the extension exchanges the code for a Bearer
 * session, so it never sees your password.
 */
export default function LinkExtensionPage() {
  const [searchParams] = useSearchParams();
  const { getKey } = useVault();
  const user = useCurrentUser();
  const [stage, setStage] = useState<Stage>('confirm');
  const [error, setError] = useState('');

  const pk = searchParams.get('pk') ?? '';
  const redirectUri = searchParams.get('redirect_uri') ?? '';

  // Raw uncompressed P-256 point = 65 bytes -> 88 base64 chars (url-safe too).
  const pkValid = /^[A-Za-z0-9+/=_-]{80,96}$/.test(pk);

  // The code mints a session, so the redirect target must provably be a
  // browser extension endpoint - never an arbitrary web origin.
  const redirectUrl = useMemo(() => {
    try {
      const url = new URL(redirectUri);
      const allowed =
        url.protocol === 'chrome-extension:' ||
        url.protocol === 'moz-extension:' ||
        (url.protocol === 'https:' &&
          (url.hostname === 'chromiumapp.org' ||
            url.hostname.endsWith('.chromiumapp.org') ||
            url.hostname === 'allizom.org' ||
            url.hostname.endsWith('.allizom.org')));
      return allowed ? url : null;
    } catch {
      return null;
    }
  }, [redirectUri]);

  function back(params: string) {
    if (!redirectUrl) return;
    const sep = redirectUrl.href.includes('?') ? '&' : '?';
    window.location.href = `${redirectUrl.href}${sep}${params}`;
  }

  async function approve() {
    setStage('working');
    setError('');
    try {
      const { code } = await api.post<{ code: string }>('/auth/extension-link', {});
      const envelope = await wrapVaultKeyForExtension(
        getKey(),
        pk.replace(/-/g, '+').replace(/_/g, '/'),
      );
      const keyParam = encodeURIComponent(JSON.stringify(envelope));
      back(`code=${encodeURIComponent(code)}#key=${keyParam}`);
      setStage('done');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Pairing failed. Please try again.');
      setStage('error');
    }
  }

  if (!pkValid || !redirectUrl) {
    return (
      <AuthLayout
        title="This pairing link is not valid"
        description="Start the connection from the Vaultory extension itself - never from a web page you did not open."
      >
        <div className="flex items-start gap-2.5 rounded-[var(--radius-card)] border border-line bg-surface p-4">
          <ShieldAlert className="mt-0.5 size-4 shrink-0 text-danger" />
          <p className="text-[13px] text-fg-muted">
            The request is missing or carrying an unexpected return address, so nothing was shared.
          </p>
        </div>
      </AuthLayout>
    );
  }

  if (!user.emailVerified) {
    return (
      <AuthLayout title="Verify your email first" description="Extension pairing unlocks once your address is verified.">
        <Button asChild variant="secondary">
          <Link to="/settings">Open settings</Link>
        </Button>
      </AuthLayout>
    );
  }

  if (stage === 'denied') {
    return (
      <AuthLayout title="Nothing was shared" description="The extension was not connected. You can close this window.">
        <Button variant="secondary" onClick={() => setStage('confirm')}>
          Go back
        </Button>
      </AuthLayout>
    );
  }

  if (stage === 'done') {
    return (
      <AuthLayout title="Extension connected" description="You can close this window and return to the extension.">
        <div className="flex items-start gap-2.5 rounded-[var(--radius-card)] border border-line bg-surface p-4">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />
          <p className="text-[13px] text-fg-muted">
            The extension will appear in Security → Sessions, where you can revoke it any time.
          </p>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Connect the browser extension?"
      description="The Vaultory extension on this browser wants access to your vault."
    >
      <div className="flex items-start gap-2.5 rounded-[var(--radius-card)] border border-line bg-surface p-4">
        <MonitorSmartphone className="mt-0.5 size-4 shrink-0 text-accent" />
        <ul className="m-0 list-none space-y-1.5 p-0 text-[13px] leading-5 text-fg-muted">
          <li>Fill logins on sites you visit - only when you choose an item</li>
          <li>Decrypts vault items locally, inside the extension</li>
          <li>Runs as a normal session - revoke it from Security → Sessions</li>
        </ul>
      </div>

      {stage === 'error' ? (
        <div className="flex items-start gap-2.5 rounded-[var(--radius-card)] border border-danger/40 bg-danger-soft p-4">
          <XCircle className="mt-0.5 size-4 shrink-0 text-danger" />
          <p className="text-[13px] text-fg">{error}</p>
        </div>
      ) : null}

      <div className="mt-4 flex gap-3">
        <Button onClick={() => void approve()} disabled={stage === 'working'}>
          {stage === 'working' ? <Loader2 className="size-4 animate-spin" /> : null}
          Allow &amp; connect
        </Button>
        <Button
          variant="secondary"
          disabled={stage === 'working'}
          onClick={() => {
            back('error=access_denied');
            setStage('denied');
          }}
        >
          Not now
        </Button>
      </div>
    </AuthLayout>
  );
}
