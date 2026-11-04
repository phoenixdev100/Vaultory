import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, KeyRound, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { FieldError, Input } from '@/components/ui/input';
import { Field, Label } from '@/components/ui/label';
import { PasswordInput } from '@/components/ui/password-input';
import { AuthLayout } from '@/features/auth/auth-layout';
import { useLogin, useLoginMfa } from '@/features/auth/use-auth-mutations';
import { ApiError } from '@/lib/api';

const schema = z.object({
  email: z.email('Enter a valid email address'),
  password: z.string().min(1, 'Enter your password'),
});

type FormValues = z.infer<typeof schema>;

export default function LoginPage() {
  const login = useLogin();
  const loginMfa = useLoginMfa();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? '/dashboard';

  const [mfa, setMfa] = useState<{ mfaToken: string; wrappingKey: CryptoKey } | null>(null);
  const [code, setCode] = useState('');
  const [mfaError, setMfaError] = useState<string | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
  });

  async function onSubmit(values: FormValues) {
    try {
      const result = await login.mutateAsync(values);
      if (result.mfa) {
        setMfa({ mfaToken: result.mfaToken, wrappingKey: result.wrappingKey });
        return;
      }
      toast.success('Welcome back');
      void navigate(from, { replace: true });
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        form.setError('password', { message: 'Invalid email or password.' });
        return;
      }
      if (error instanceof ApiError && error.status === 429) {
        form.setError('root', { message: error.message });
        return;
      }
      if (error instanceof ApiError && error.code === 'disposable_email') {
        form.setError('email', { message: error.message });
        return;
      }
      // A failed unwrap means the account exists but the vault key did not open.
      form.setError('root', {
        message: error instanceof ApiError ? error.message : 'We could not unlock your vault with that password.',
      });
    }
  }

  async function submitMfa(event: React.FormEvent) {
    event.preventDefault();
    if (!mfa) return;
    setMfaError(null);
    try {
      await loginMfa.mutateAsync({ mfaToken: mfa.mfaToken, code, wrappingKey: mfa.wrappingKey });
      toast.success('Welcome back');
      void navigate(from, { replace: true });
    } catch (error) {
      setMfaError(error instanceof ApiError ? error.message : 'Could not verify that code.');
    }
  }

  if (mfa) {
    return (
      <AuthLayout
        title="Two-factor authentication"
        description="Enter the 6-digit code from your authenticator app to finish signing in."
      >
        <form onSubmit={submitMfa} className="flex flex-col gap-4" noValidate>
          <Field>
            <Label htmlFor="totp-code">Authentication code</Label>
            <Input
              id="totp-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              maxLength={6}
              placeholder="123456"
              className="text-center font-mono text-lg tracking-[0.4em]"
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
            />
            <FieldError>{mfaError}</FieldError>
          </Field>

          <Button type="submit" size="lg" loading={loginMfa.isPending} disabled={code.length !== 6} className="w-full">
            Verify and sign in
          </Button>

          <button
            type="button"
            onClick={() => {
              setMfa(null);
              setCode('');
              setMfaError(null);
            }}
            className="flex items-center justify-center gap-1.5 text-xs text-fg-muted transition-colors hover:text-fg"
          >
            <ArrowLeft className="size-3.5" />
            Back to password
          </button>

          <p className="flex items-start gap-2 text-[11px] leading-4 text-fg-subtle">
            <ShieldCheck className="mt-px size-3.5 shrink-0" />
            Lost your authenticator? Use forgot password - a verified email reset also clears two-factor.
          </p>
        </form>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Sign in to Vaultory"
      description="Your password unlocks your vault in this browser - it is never sent to our servers."
      footer={
        <span>
          New to Vaultory?{' '}
          <Link to="/signup" className="font-medium text-primary hover:underline">
            Create an account
          </Link>
        </span>
      }
    >
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
        <Field>
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="username"
            autoFocus
            placeholder="you@example.com"
            aria-invalid={form.formState.errors.email ? true : undefined}
            {...form.register('email')}
          />
          <FieldError>{form.formState.errors.email?.message}</FieldError>
        </Field>

        <Field>
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link to="/forgot-password" className="text-xs text-fg-muted transition-colors hover:text-primary">
              Forgot password?
            </Link>
          </div>
          <PasswordInput
            id="password"
            autoComplete="current-password"
            aria-invalid={form.formState.errors.password ? true : undefined}
            {...form.register('password')}
          />
          <FieldError>{form.formState.errors.password?.message}</FieldError>
        </Field>

        <FieldError>{form.formState.errors.root?.message}</FieldError>

        <Button type="submit" size="lg" loading={login.isPending} className="w-full">
          {login.isPending ? 'Unlocking your vault…' : 'Sign in'}
        </Button>

        <p className="flex items-start gap-2 text-[11px] leading-4 text-fg-subtle">
          <KeyRound className="mt-px size-3.5 shrink-0" />
          Signing in derives your encryption key with Argon2id, which takes a moment on purpose.
        </p>
      </form>
    </AuthLayout>
  );
}
