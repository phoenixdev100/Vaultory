import { zodResolver } from '@hookform/resolvers/zod';
import { ExternalLink, Mail, TriangleAlert } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { FieldError, Input } from '@/components/ui/input';
import { Field, Label } from '@/components/ui/label';
import { AuthLayout } from '@/features/auth/auth-layout';
import { useForgotPassword } from '@/features/auth/use-auth-mutations';
import { ApiError } from '@/lib/api';

const schema = z.object({ email: z.email('Enter a valid email address') });
type FormValues = z.infer<typeof schema>;

export default function ForgotPasswordPage() {
  const forgotPassword = useForgotPassword();
  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { email: '' } });
  const result = forgotPassword.data;

  return (
    <AuthLayout
      title="Reset your password"
      description="We'll email a single-use link that lets you set a new password."
      footer={
        <span>
          Remembered it?{' '}
          <Link to="/login" className="font-medium text-primary hover:underline">
            Back to sign in
          </Link>
        </span>
      }
    >
      {result ? (
        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-2.5 rounded-[var(--radius-card)] border border-line bg-surface p-4 shadow-subtle">
            <Mail className="mt-0.5 size-4 shrink-0 text-primary" />
            <div className="flex flex-col gap-1">
              <p className="text-[13px] font-medium text-fg">{result.message}</p>
              <p className="text-xs text-fg-muted">The link expires in 10 minutes and can only be used once.</p>
            </div>
          </div>

          {result.delivered === false ? (
            <div className="flex items-start gap-2 rounded-[var(--radius-control)] border border-warning/25 bg-warning-soft/70 p-3">
              <TriangleAlert className="mt-px size-3.5 shrink-0 text-warning" />
              <p className="text-[12px] leading-4.5 text-fg-muted">
                The mail server did not confirm delivery - check the SMTP settings in the backend{' '}
                <code className="font-mono">.env</code> and the API logs.
              </p>
            </div>
          ) : null}

          {result.transport === 'console' ? (
            <div className="flex flex-col gap-2 rounded-[var(--radius-control)] border border-warning/25 bg-warning-soft/70 p-3">
              <p className="flex items-start gap-2 text-[12px] leading-4.5 text-fg-muted">
                <TriangleAlert className="mt-px size-3.5 shrink-0 text-warning" />
                No email provider is configured (<code className="font-mono">EMAIL_TRANSPORT=console</code>), so
                nothing was actually sent. The link is printed in the API logs.
              </p>
              {result.previewUrl ? (
                <a
                  href={result.previewUrl}
                  className="inline-flex items-center gap-1.5 text-[12px] font-medium text-primary hover:underline"
                >
                  <ExternalLink className="size-3.5" />
                  Open the reset link
                </a>
              ) : null}
            </div>
          ) : null}

          <Button variant="secondary" onClick={() => forgotPassword.reset()}>
            Use a different email
          </Button>
        </div>
      ) : (
        <form
          onSubmit={form.handleSubmit(async (values) => {
            try {
              await forgotPassword.mutateAsync(values.email);
            } catch (error) {
              if (error instanceof ApiError && error.code === 'disposable_email') {
                form.setError('email', { message: error.message });
                return;
              }
              form.setError('root', {
                message: error instanceof ApiError ? error.message : 'Could not send the reset email.',
              });
            }
          })}
          className="flex flex-col gap-4"
          noValidate
        >
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

          <div className="flex items-start gap-2 rounded-[var(--radius-control)] border border-line bg-surface-muted/60 p-3">
            <Mail className="mt-px size-3.5 shrink-0 text-fg-subtle" />
            <p className="text-[12px] leading-4.5 text-fg-muted">
              The link is valid for 10 minutes and works once. Resetting keeps your existing vault - the same key is
              re-wrapped to your new password.
            </p>
          </div>

          <FieldError>{form.formState.errors.root?.message}</FieldError>

          <Button type="submit" size="lg" loading={forgotPassword.isPending} className="w-full">
            Send reset link
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
