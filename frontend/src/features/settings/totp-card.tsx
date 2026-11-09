import { ShieldCheck, Smartphone } from 'lucide-react';
import QRCode from 'qrcode';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FieldError, FieldHint, Input } from '@/components/ui/input';
import { Field, Label } from '@/components/ui/label';
import { useCurrentUser } from '@/features/auth/auth-context';
import { useTotpConfirm, useTotpDisable, useTotpSetup } from '@/features/auth/use-auth-mutations';
import { ApiError } from '@/lib/api';

/**
 * Account-level two-factor enrolment. The server holds the wrapped secret and
 * only returns it once, here, for QR/manual enrolment.
 */
export function TotpCard() {
  const user = useCurrentUser();
  const setup = useTotpSetup();
  const confirm = useTotpConfirm();
  const disable = useTotpDisable();

  const [enrol, setEnrol] = useState<{ secret: string; otpauthUrl: string } | null>(null);
  const [qr, setQr] = useState<{ for: string; url: string } | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [disabling, setDisabling] = useState(false);

  useEffect(() => {
    if (!enrol) return;
    let cancelled = false;
    void QRCode.toDataURL(enrol.otpauthUrl, { margin: 1, width: 176 }).then((url) => {
      if (!cancelled) setQr({ for: enrol.otpauthUrl, url });
    });
    return () => {
      cancelled = true;
    };
  }, [enrol]);

  const qrUrl = enrol && qr?.for === enrol.otpauthUrl ? qr.url : null;

  function begin() {
    setError(null);
    setup.mutate(undefined, {
      onSuccess: (data) => setEnrol(data),
      onError: (e) => toast.error('Could not start setup', { description: e instanceof ApiError ? e.message : undefined }),
    });
  }

  function submitConfirm(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    confirm.mutate(code, {
      onSuccess: () => {
        toast.success('Two-factor authentication enabled');
        setEnrol(null);
        setCode('');
      },
      onError: (e) => setError(e instanceof ApiError ? e.message : 'Could not verify that code.'),
    });
  }

  function submitDisable(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    disable.mutate(code, {
      onSuccess: () => {
        toast.success('Two-factor authentication disabled');
        setDisabling(false);
        setCode('');
      },
      onError: (e) => setError(e instanceof ApiError ? e.message : 'Could not verify that code.'),
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Smartphone className="size-4 text-primary" />
          Two-factor authentication
          {user.totpEnabled ? (
            <Badge variant="success" size="sm">
              On
            </Badge>
          ) : null}
        </CardTitle>
        <CardDescription>
          Require a code from an authenticator app (Google Authenticator, 1Password, Bitwarden…) every time you
          sign in.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {user.totpEnabled && !disabling ? (
          <div className="flex items-center justify-between gap-3">
            <p className="flex items-center gap-2 text-[13px] text-fg-muted">
              <ShieldCheck className="size-4 text-success" />
              Your account asks for a 6-digit code after the password.
            </p>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setDisabling(true);
                setCode('');
                setError(null);
              }}
            >
              Disable
            </Button>
          </div>
        ) : disabling ? (
          <form onSubmit={submitDisable} className="flex flex-col gap-3">
            <Field>
              <Label htmlFor="totp-disable-code">Current authenticator code</Label>
              <Input
                id="totp-disable-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                placeholder="123456"
                className="font-mono tracking-[0.3em]"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              />
              <FieldError>{error}</FieldError>
            </Field>
            <div className="flex gap-2">
              <Button type="submit" variant="danger" size="sm" disabled={code.length !== 6} loading={disable.isPending}>
                Disable two-factor
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setDisabling(false)}>
                Cancel
              </Button>
            </div>
          </form>
        ) : enrol ? (
          <form onSubmit={submitConfirm} className="flex flex-col gap-4">
            <div className="flex flex-col items-center gap-3 rounded-[var(--radius-card)] border border-line bg-canvas p-4">
              {qrUrl ? (
                <img src={qrUrl} alt="Scan with your authenticator app" className="size-44 rounded-md" />
              ) : (
                <div className="size-44 animate-pulse rounded-md bg-surface-muted" />
              )}
              <p className="text-center text-xs text-fg-subtle">
                Can&apos;t scan? Add this key manually:
                <span className="mt-1 block select-all font-mono text-[11px] tracking-wider text-fg">
                  {enrol.secret}
                </span>
              </p>
            </div>
            <Field>
              <Label htmlFor="totp-confirm-code">Enter the 6-digit code from your app</Label>
              <Input
                id="totp-confirm-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                placeholder="123456"
                className="font-mono tracking-[0.3em]"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              />
              <FieldError>{error}</FieldError>
              <FieldHint>
                If you lose the device, a verified email password reset disables two-factor and restores access.
              </FieldHint>
            </Field>
            <div className="flex gap-2">
              <Button type="submit" size="sm" disabled={code.length !== 6} loading={confirm.isPending}>
                Enable two-factor
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setEnrol(null)}>
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <p className="text-[13px] text-fg-muted">
              Adds a second check on top of your password - an attacker with just the password cannot sign in.
            </p>
            <Button variant="secondary" size="sm" onClick={begin} loading={setup.isPending}>
              Set up
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
