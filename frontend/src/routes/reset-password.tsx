import { zodResolver } from '@hookform/resolvers/zod';
import { CheckCircle2, Loader2, ShieldCheck, TriangleAlert } from 'lucide-react';
import { useForm, useWatch } from 'react-hook-form';
import { Link, useSearchParams } from 'react-router-dom';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { FieldError } from '@/components/ui/input';
import { Field, Label } from '@/components/ui/label';
import { PasswordInput, PasswordStrength } from '@/components/ui/password-input';
import { Checkbox } from '@/components/ui/toggle';
import { AuthLayout } from '@/features/auth/auth-layout';
import { useResetPassword, useResetTokenInfo } from '@/features/auth/use-auth-mutations';
import { ApiError } from '@/lib/api';
import { pluralize } from '@/lib/format';

const schema = z
  .object({
    password: z.string().min(10, 'Use at least 10 characters').max(200),
    confirmPassword: z.string(),
    acknowledgeVaultLoss: z.boolean(),
  })
  .refine((values) => values.password === values.confirmPassword, {
    path: ['confirmPassword'],
    error: 'Passwords do not match',
  });

type FormValues = z.input<typeof schema>;

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const tokenInfo = useResetTokenInfo(token);
  const resetPassword = useResetPassword();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { password: '', confirmPassword: '', acknowledgeVaultLoss: false },
  });

  const password = useWatch({ control: form.control, name: 'password' });
  const acknowledged = useWatch({ control: form.control, name: 'acknowledgeVaultLoss' });

  const vaultRecoverable = tokenInfo.data?.vaultRecoverable !== false;

  async function onSubmit(values: FormValues) {
    if (!token || !tokenInfo.data) return;
    if (!vaultRecoverable && values.acknowledgeVaultLoss !== true) {
      form.setError('acknowledgeVaultLoss', {
        message: 'Please confirm you understand what a reset does',
      });
      return;
    }
    try {
      await resetPassword.mutateAsync({ token, email: tokenInfo.data.email, password: values.password });
    } catch (error) {
      form.setError('root', {
        message: error instanceof ApiError ? error.message : 'We could not reset your password.',
      });
    }
  }

  if (!token) {
    return (
      <AuthLayout title="Reset link missing" description="This page needs the link from your reset email.">
        <Button asChild variant="secondary">
          <Link to="/forgot-password">Request a new link</Link>
        </Button>
      </AuthLayout>
    );
  }

  if (tokenInfo.isPending) {
    return (
      <AuthLayout title="Checking your link…">
        <Loader2 className="size-5 animate-spin text-fg-subtle" />
      </AuthLayout>
    );
  }

  if (tokenInfo.isError) {
    return (
      <AuthLayout
        title="This link has expired"
        description="Reset links are valid for 10 minutes and can only be used once. Request a new email to get a fresh link."
      >
        <div className="flex items-start gap-2.5 rounded-[var(--radius-card)] border border-warning/30 bg-warning-soft/60 p-4">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" />
          <p className="text-[13px] text-fg-muted">
            The link in your email is no longer usable - please request a new reset email.
          </p>
        </div>
        <Button asChild size="lg" className="mt-4">
          <Link to="/forgot-password">Request a new email</Link>
        </Button>
      </AuthLayout>
    );
  }

  if (resetPassword.isSuccess) {
    const { strandedSecrets, vaultKeyPreserved } = resetPassword.data;
    return (
      <AuthLayout title="Password updated" description="You can sign in with your new password now.">
        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-2.5 rounded-[var(--radius-card)] border border-line bg-surface p-4 shadow-subtle">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />
            <div className="flex flex-col gap-1">
              <p className="text-[13px] font-medium text-fg">
                {vaultKeyPreserved ? 'Your vault is untouched' : 'A new vault key was created'}
              </p>
              <p className="text-xs leading-5 text-fg-muted">
                {vaultKeyPreserved
                  ? 'Your existing key was re-wrapped to the new password - every saved item still decrypts.'
                  : strandedSecrets > 0
                    ? `${pluralize(strandedSecrets, 'item')} saved before the reset remain encrypted with your previous key. They are still listed in your vault, marked as unreadable, so you can review and remove them.`
                    : 'Your vault was empty, so nothing was left behind.'}
              </p>
            </div>
          </div>
          <Button asChild size="lg">
            <Link to="/login">Sign in</Link>
          </Button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Choose a new password"
      description={`Resetting the password for ${tokenInfo.data.email}.`}
      footer={
        <Link to="/login" className="font-medium text-primary hover:underline">
          Back to sign in
        </Link>
      }
    >
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
        <Field>
          <Label htmlFor="password">New password</Label>
          <PasswordInput
            id="password"
            autoComplete="new-password"
            autoFocus
            aria-invalid={form.formState.errors.password ? true : undefined}
            {...form.register('password')}
          />
          <PasswordStrength password={password ?? ''} />
          <FieldError>{form.formState.errors.password?.message}</FieldError>
        </Field>

        <Field>
          <Label htmlFor="confirmPassword">Confirm new password</Label>
          <PasswordInput
            id="confirmPassword"
            autoComplete="new-password"
            aria-invalid={form.formState.errors.confirmPassword ? true : undefined}
            {...form.register('confirmPassword')}
          />
          <FieldError>{form.formState.errors.confirmPassword?.message}</FieldError>
        </Field>

        {vaultRecoverable ? (
          <div className="flex items-start gap-2 rounded-[var(--radius-control)] border border-success/25 bg-success-soft/60 p-3">
            <ShieldCheck className="mt-px size-4 shrink-0 text-success" />
            <p className="text-[12px] leading-4.5 text-fg-muted">
              Your vault stays intact - the same vault key is re-wrapped to your new password, so every saved item
              keeps working after the reset.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2 rounded-[var(--radius-control)] border border-danger/25 bg-danger-soft/60 p-3">
            <div className="flex items-start gap-2">
              <TriangleAlert className="mt-px size-4 shrink-0 text-danger" />
              <p className="text-[12px] leading-4.5 text-fg-muted">
                This account was created before vault recovery existed, so its key cannot be restored. Continuing
                creates a new empty vault; existing items stay stored but unreadable.
              </p>
            </div>
            <label className="flex cursor-pointer items-start gap-2.5 pl-6 text-[12px] leading-4.5 text-fg">
              <Checkbox
                checked={acknowledged === true}
                onCheckedChange={(checked) =>
                  form.setValue('acknowledgeVaultLoss', checked === true, { shouldValidate: true })
                }
              />
              <span>I understand that items saved before this reset cannot be decrypted.</span>
            </label>
            <FieldError className="pl-6">{form.formState.errors.acknowledgeVaultLoss?.message}</FieldError>
          </div>
        )}

        <FieldError>{form.formState.errors.root?.message}</FieldError>

        <Button type="submit" size="lg" loading={resetPassword.isPending} className="w-full">
          Set new password
        </Button>
      </form>
    </AuthLayout>
  );
}
