import { BadgeCheck, MailWarning, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AnimatedDialog, DialogContent } from '@/components/ui/dialog';
import { FieldError, FieldHint } from '@/components/ui/input';
import { OtpInput } from '@/components/ui/otp-input';
import { useCurrentUser } from '@/features/auth/auth-context';
import { useResendVerification, useVerifyEmailCode } from '@/features/auth/use-auth-mutations';
import { ApiError } from '@/lib/api';

/**
 * Email verification status + the send-code / enter-code flow. Renders on the
 * settings page and on the verification wall that gates unverified accounts.
 * "Send verification code" mails a fresh 6-digit code, then a dialog opens to
 * type it in.
 */
export function VerifyEmailCard() {
  const user = useCurrentUser();
  const resend = useResendVerification();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [sent, setSent] = useState(false);
  /** Dev-only echo of the code when EMAIL_TRANSPORT=console sends nothing. */
  const [devCode, setDevCode] = useState<string | null>(null);

  if (user.emailVerified) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Email verification
            <Badge variant="success" size="sm">
              <BadgeCheck />
              Verified
            </Badge>
          </CardTitle>
          <CardDescription>{user.email} is confirmed - every vault feature is unlocked.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  function sendCode() {
    resend.mutate(undefined, {
      onSuccess: (result) => {
        setSent(true);
        if (result.previewCode) setDevCode(result.previewCode);
        setDialogOpen(true);
        toast.success(
          result.delivered ? 'Verification email sent' : 'Verification email generated',
          {
            description: result.delivered
              ? `Check ${user.email}'s inbox for the 6-digit code.`
              : 'The dev mailer does not send - the code is shown in the dialog.',
          },
        );
      },
      onError: (e) => {
        toast.error('Could not send the verification email', {
          description: e instanceof ApiError ? e.message : undefined,
        });
      },
    });
  }

  return (
    <Card className="border-warning/40">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Email verification
          <Badge variant="warning" size="sm">
            <MailWarning />
            Not verified
          </Badge>
        </CardTitle>
        <CardDescription>
          Confirm {user.email} to unlock the vault, folders, sharing and every other feature. We email a
          6-digit code - you can also use the link inside the same email.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center gap-2.5">
        <Button size="sm" onClick={sendCode} loading={resend.isPending}>
          {sent ? 'Resend verification code' : 'Send verification code'}
        </Button>
        <Button variant="secondary" size="sm" onClick={() => setDialogOpen(true)}>
          I have a code
        </Button>
        {sent ? <p className="text-[12px] text-fg-subtle">Code sent - it expires in 24 hours.</p> : null}
      </CardContent>

      <VerifyCodeDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        email={user.email}
        devCode={devCode}
        onResend={sendCode}
        resendPending={resend.isPending}
      />
    </Card>
  );
}

interface VerifyCodeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  email: string;
  devCode: string | null;
  onResend: () => void;
  resendPending: boolean;
}

/** The OTP popup: six split boxes, auto-advance, paste-friendly. */
function VerifyCodeDialog({ open, onOpenChange, email, devCode, onResend, resendPending }: VerifyCodeDialogProps) {
  const verify = useVerifyEmailCode();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  function submit() {
    if (code.length !== 6) return;
    setError(null);
    verify.mutate(code, {
      onSuccess: () => {
        onOpenChange(false);
        setCode('');
        toast.success('Email verified', { description: 'Your vault is unlocked.' });
      },
      onError: (e) => setError(e instanceof ApiError ? e.message : 'Could not verify that code.'),
    });
  }

  return (
    <AnimatedDialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) {
          setCode('');
          setError(null);
        }
      }}
    >
      <DialogContent
        title="Check your email"
        description={
          <>
            We sent a 6-digit verification code to <span className="font-medium text-fg">{email}</span>. Enter
            it below - or open the link in the email instead.
          </>
        }
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => onOpenChange(false)} disabled={verify.isPending}>
              Cancel
            </Button>
            <Button size="sm" onClick={submit} loading={verify.isPending} disabled={code.length !== 6}>
              Verify email
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <div className="flex justify-center rounded-[var(--radius-card)] border border-line bg-surface-muted/40 px-3 py-5">
            <OtpInput
              id="verify-email-code"
              value={code}
              onChange={(next) => {
                setCode(next);
                setError(null);
              }}
              autoFocus
              invalid={error !== null}
              disabled={verify.isPending}
            />
          </div>

          <FieldError className="text-center">{error}</FieldError>

          {devCode ? (
            <FieldHint className="text-center">
              Dev mailer - your code is <span className="font-mono font-semibold text-fg">{devCode}</span>
            </FieldHint>
          ) : (
            <FieldHint className="text-center">The code expires in 24 hours.</FieldHint>
          )}

          <div className="flex items-center justify-center gap-2 text-[12px] text-fg-subtle">
            <ShieldCheck className="size-3.5" />
            Didn&apos;t get it?
            <button
              type="button"
              onClick={onResend}
              disabled={resendPending}
              className="font-medium text-primary hover:underline disabled:opacity-50"
            >
              Resend code
            </button>
          </div>
        </div>
      </DialogContent>
    </AnimatedDialog>
  );
}
