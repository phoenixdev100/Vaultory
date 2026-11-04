import { zodResolver } from '@hookform/resolvers/zod';
import { TriangleAlert } from 'lucide-react';
import { useForm, useWatch } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { FieldError, Input } from '@/components/ui/input';
import { Field, Label } from '@/components/ui/label';
import { PasswordInput, PasswordStrength } from '@/components/ui/password-input';
import { Checkbox } from '@/components/ui/toggle';
import { AuthLayout } from '@/features/auth/auth-layout';
import { useSignup } from '@/features/auth/use-auth-mutations';
import { ApiError } from '@/lib/api';

const schema = z
  .object({
    name: z.string().trim().max(80).optional(),
    // Honeypot: hidden from humans, bots fill it. Must stay out of the
    // tab order and autocomplete or it catches real users.
    website: z.string().optional(),
    email: z.email('Enter a valid email address'),
    password: z
      .string()
      .min(10, 'Use at least 10 characters')
      .max(200, 'That password is unusually long')
      .refine((value) => value.trim() === value || value.trim().length > 0, 'Enter a password'),
    confirmPassword: z.string(),
    acknowledgeRecovery: z
      .boolean()
      .refine((value) => value === true, { error: 'Please confirm you understand the recovery model' }),
  })
  .refine((values) => values.password === values.confirmPassword, {
    path: ['confirmPassword'],
    error: 'Passwords do not match',
  });

type FormValues = z.input<typeof schema>;

export default function SignupPage() {
  const signup = useSignup();
  const navigate = useNavigate();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
      confirmPassword: '',
      acknowledgeRecovery: false,
      website: '',
    },
  });

  const password = useWatch({ control: form.control, name: 'password' });
  const acknowledged = useWatch({ control: form.control, name: 'acknowledgeRecovery' });

  async function onSubmit(values: FormValues) {
    try {
      await signup.mutateAsync({
        email: values.email,
        password: values.password,
        ...(values.name?.trim() ? { name: values.name.trim() } : {}),
        ...(values.website ? { website: values.website } : {}),
      });
      toast.success('Vault created', { description: 'Your encryption key was generated in this browser.' });
      void navigate('/dashboard', { replace: true });
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        form.setError('email', { message: 'An account with that email already exists.' });
        return;
      }
      if (error instanceof ApiError && error.code === 'disposable_email') {
        form.setError('email', { message: error.message });
        return;
      }
      form.setError('root', {
        message: error instanceof ApiError ? error.message : 'We could not create your vault. Please try again.',
      });
    }
  }

  return (
    <AuthLayout
      title="Create your vault"
      description="One password protects everything. Vaultory derives your encryption key from it locally."
      footer={
        <span>
          Already have a vault?{' '}
          <Link to="/login" className="font-medium text-primary hover:underline">
            Sign in
          </Link>
        </span>
      }
    >
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
        {/* Honeypot: visually hidden, unreachable by keyboard - bots fill it */}
        <div className="absolute left-[-9999px] top-0 h-0 w-0 overflow-hidden" aria-hidden="true">
          <input
            type="text"
            tabIndex={-1}
            autoComplete="off"
            placeholder="Leave this field empty"
            {...form.register('website')}
          />
        </div>

        <Field>
          <Label htmlFor="name">
            Name <span className="font-normal text-fg-subtle">(optional)</span>
          </Label>
          <Input id="name" autoComplete="name" placeholder="Dana" {...form.register('name')} />
        </Field>

        <Field>
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="username"
            placeholder="you@example.com"
            aria-invalid={form.formState.errors.email ? true : undefined}
            {...form.register('email')}
          />
          <FieldError>{form.formState.errors.email?.message}</FieldError>
        </Field>

        <Field>
          <Label htmlFor="password">Password</Label>
          <PasswordInput
            id="password"
            autoComplete="new-password"
            aria-invalid={form.formState.errors.password ? true : undefined}
            {...form.register('password')}
          />
          <PasswordStrength password={password ?? ''} />
          <FieldError>{form.formState.errors.password?.message}</FieldError>
        </Field>

        <Field>
          <Label htmlFor="confirmPassword">Confirm password</Label>
          <PasswordInput
            id="confirmPassword"
            autoComplete="new-password"
            aria-invalid={form.formState.errors.confirmPassword ? true : undefined}
            {...form.register('confirmPassword')}
          />
          <FieldError>{form.formState.errors.confirmPassword?.message}</FieldError>
        </Field>

        <div className="flex flex-col gap-2 rounded-[var(--radius-control)] border border-warning/25 bg-warning-soft/70 p-3">
          <div className="flex items-start gap-2">
            <TriangleAlert className="mt-px size-4 shrink-0 text-warning" />
            <p className="text-[12px] leading-4.5 text-fg-muted">
              Your password never leaves this browser - a derived verifier proves it instead. If you forget it, a
              verified email reset can restore your vault through an{' '}
              <strong className="font-semibold text-fg">encrypted escrow copy of your key</strong>, so nothing is
              lost.
            </p>
          </div>
          <label className="flex cursor-pointer items-start gap-2.5 pl-6 text-[12px] leading-4.5 text-fg">
            <Checkbox
              checked={acknowledged === true}
              onCheckedChange={(checked) =>
                form.setValue('acknowledgeRecovery', checked === true, { shouldValidate: true })
              }
              aria-describedby="recovery-help"
            />
            <span id="recovery-help">I understand that my password unlocks my vault.</span>
          </label>
          <FieldError className="pl-6">{form.formState.errors.acknowledgeRecovery?.message}</FieldError>
        </div>

        <FieldError>{form.formState.errors.root?.message}</FieldError>

        <Button type="submit" size="lg" loading={signup.isPending} className="w-full">
          {signup.isPending ? 'Generating your keys…' : 'Create vault'}
        </Button>
      </form>
    </AuthLayout>
  );
}
