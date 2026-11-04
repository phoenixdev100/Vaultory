import { CheckCircle2, Loader2, XCircle } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { AuthLayout } from '@/features/auth/auth-layout';
import { useVerifyEmail } from '@/features/auth/use-auth-mutations';

export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const verifyEmail = useVerifyEmail();
  const attempted = useRef(false);

  useEffect(() => {
    if (!token || attempted.current) return;
    attempted.current = true;
    verifyEmail.mutate(token);
  }, [token, verifyEmail]);

  if (!token) {
    return (
      <AuthLayout title="Verification link missing" description="Open the link from your confirmation email.">
        <Button asChild variant="secondary">
          <Link to="/login">Back to sign in</Link>
        </Button>
      </AuthLayout>
    );
  }

  if (verifyEmail.isPending || verifyEmail.isIdle) {
    return (
      <AuthLayout title="Confirming your email…">
        <Loader2 className="size-5 animate-spin text-fg-subtle" />
      </AuthLayout>
    );
  }

  if (verifyEmail.isError) {
    return (
      <AuthLayout
        title="That link is not valid"
        description="Verification links expire after 24 hours and can only be used once."
      >
        <div className="flex items-start gap-2.5 rounded-[var(--radius-card)] border border-line bg-surface p-4">
          <XCircle className="mt-0.5 size-4 shrink-0 text-danger" />
          <p className="text-[13px] text-fg-muted">
            Sign in and request a new confirmation email from your settings page.
          </p>
        </div>
        <Button asChild className="mt-4">
          <Link to="/login">Sign in</Link>
        </Button>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Email confirmed" description="Thanks - your address is verified.">
      <div className="flex items-start gap-2.5 rounded-[var(--radius-card)] border border-line bg-surface p-4">
        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />
        <p className="text-[13px] text-fg-muted">You can now use every part of your vault.</p>
      </div>
      <Button asChild className="mt-4">
        <Link to="/dashboard">Open my vault</Link>
      </Button>
    </AuthLayout>
  );
}
