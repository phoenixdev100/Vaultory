import {
  Clock,
  LogOut,
  Moon,
  Sun,
  Trash2,
} from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { useTheme, type Theme } from '@/app/theme-context';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { FieldError, FieldHint, Input } from '@/components/ui/input';
import { Field, Label } from '@/components/ui/label';
import { PasswordInput, PasswordStrength } from '@/components/ui/password-input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/toggle';
import { useCurrentUser } from '@/features/auth/auth-context';
import { VerifyEmailCard } from '@/features/auth/verify-email-card';
import {
  useChangePassword,
  useDeleteAccount,
  useUpdateProfile,
} from '@/features/auth/use-auth-mutations';
import { ApiError } from '@/lib/api';
import { cn } from '@/lib/utils';

const AUTO_LOCK_OPTIONS = [
  { value: '5', label: 'After 5 minutes' },
  { value: '15', label: 'After 15 minutes' },
  { value: '30', label: 'After 30 minutes' },
  { value: '60', label: 'After 1 hour' },
  { value: '240', label: 'After 4 hours' },
  { value: '0', label: 'Only when I lock it' },
] as const;

const THEME_OPTIONS: Array<{ value: Theme; label: string; icon: typeof Sun }> = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
];

export default function SettingsPage() {
  const user = useCurrentUser();
  const updateProfile = useUpdateProfile();
  const changePassword = useChangePassword();
  const deleteAccount = useDeleteAccount();
  const { theme, setTheme } = useTheme();

  const [name, setName] = useState<string | null>(null);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [revokeOthersChoice, setRevokeOthersChoice] = useState(true);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleteError, setDeleteError] = useState<string | null>(null);

  function saveName() {
    const trimmed = (name ?? '').trim();
    updateProfile.mutate(
      { name: trimmed === '' ? null : trimmed },
      {
        onSuccess: () => {
          setName(null);
          toast.success('Profile updated');
        },
        onError: (error) =>
          toast.error('Could not update your profile', {
            description: error instanceof ApiError ? error.message : undefined,
          }),
      },
    );
  }

  function submitPasswordChange(event: React.FormEvent) {
    event.preventDefault();
    setPasswordError(null);

    if (newPassword.length < 10) {
      setPasswordError('Choose a password of at least 10 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('The new passwords do not match.');
      return;
    }

    changePassword.mutate(
      { currentPassword, newPassword, revokeOtherSessions: revokeOthersChoice },
      {
        onSuccess: ({ revokedSessions }) => {
          toast.success('Password changed', {
            description:
              revokedSessions > 0
                ? `Your vault key was re-wrapped and ${revokedSessions} other ${revokedSessions === 1 ? 'session was' : 'sessions were'} signed out.`
                : 'Your vault key was re-wrapped - every secret stays decryptable.',
          });
          setCurrentPassword('');
          setNewPassword('');
          setConfirmPassword('');
        },
        onError: (error) => {
          setPasswordError(error instanceof ApiError ? error.message : 'Could not change the password.');
        },
      },
    );
  }

  function submitDelete() {
    setDeleteError(null);
    if (deleteConfirm !== 'DELETE MY VAULT') {
      setDeleteError('Type DELETE MY VAULT exactly to confirm.');
      return;
    }
    if (deletePassword === '') {
      setDeleteError('Enter your password to confirm.');
      return;
    }
    deleteAccount.mutate(
      { password: deletePassword },
      {
        onError: (error) => {
          setDeleteError(error instanceof ApiError ? error.message : 'Could not delete the account.');
        },
      },
    );
  }

  const displayName = name ?? user.name ?? '';

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Settings" description="Your account details and preferences." />

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Profile</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <Field>
                <Label htmlFor="settings-email">Email</Label>
                <Input id="settings-email" value={user.email} disabled />
                <FieldHint>Your sign-in address. Verification status is below.</FieldHint>
              </Field>

              <Field>
                <Label htmlFor="settings-name">Display name</Label>
                <div className="flex gap-2">
                  <Input
                    id="settings-name"
                    value={displayName}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="What should we call you?"
                  />
                  <Button
                    variant="secondary"
                    onClick={saveName}
                    disabled={name === null || updateProfile.isPending}
                    loading={updateProfile.isPending}
                  >
                    Save
                  </Button>
                </div>
              </Field>
            </CardContent>
          </Card>

          <VerifyEmailCard />

          <Card>
            <CardHeader>
              <CardTitle>Change password</CardTitle>
              <CardDescription>
                Your vault key is re-wrapped with the new password - everything stays decryptable.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={submitPasswordChange} className="flex flex-col gap-4" noValidate>
                <Field>
                  <Label htmlFor="current-password">Current password</Label>
                  <PasswordInput
                    id="current-password"
                    value={currentPassword}
                    onChange={(event) => setCurrentPassword(event.target.value)}
                    autoComplete="current-password"
                    required
                  />
                </Field>
                <Field>
                  <Label htmlFor="new-password">New password</Label>
                  <PasswordInput
                    id="new-password"
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    autoComplete="new-password"
                    required
                  />
                  <PasswordStrength password={newPassword} />
                </Field>
                <Field>
                  <Label htmlFor="confirm-password">Confirm new password</Label>
                  <PasswordInput
                    id="confirm-password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    autoComplete="new-password"
                    required
                  />
                  <FieldError>{passwordError}</FieldError>
                </Field>
                <label className="flex cursor-pointer items-center justify-between gap-3 rounded-[var(--radius-control)] border border-line px-3 py-2.5">
                  <span className="flex items-center gap-2 text-[13px] font-medium text-fg">
                    <LogOut className="size-4 text-fg-subtle" />
                    Sign out other sessions
                  </span>
                  <Switch checked={revokeOthersChoice} onCheckedChange={setRevokeOthersChoice} />
                </label>
                <div>
                  <Button type="submit" loading={changePassword.isPending} disabled={currentPassword === ''}>
                    Update password
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Preferences</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <Field>
                <Label htmlFor="auto-lock">Automatic vault lock</Label>
                <Select
                  value={String(user.autoLockMinutes)}
                  onValueChange={(value) =>
                    updateProfile.mutate(
                      { autoLockMinutes: Number(value) },
                      {
                        onSuccess: () => toast.success('Auto-lock preference saved'),
                        onError: () => toast.error('Could not save that preference'),
                      },
                    )
                  }
                >
                  <SelectTrigger id="auto-lock">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {AUTO_LOCK_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value} icon={<Clock />}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldHint>The vault stays unlocked across tab reloads; locking, signing out or this timer wipe the key completely.</FieldHint>
              </Field>

              <Field>
                <Label>Theme</Label>
                <div className="grid grid-cols-2 gap-2">
                  {THEME_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => {
                        setTheme(option.value);
                        updateProfile.mutate({ theme: option.value });
                      }}
                      className={cn(
                        'flex items-center justify-center gap-2 rounded-[var(--radius-control)] border px-3 py-2.5 text-[13px] font-medium transition-colors',
                        theme === option.value
                          ? 'border-primary bg-primary-soft text-primary'
                          : 'border-line bg-surface text-fg-muted hover:bg-surface-muted',
                      )}
                      aria-pressed={theme === option.value}
                    >
                      <option.icon className="size-4" />
                      {option.label}
                    </button>
                  ))}
                </div>
              </Field>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-4">
          <Card className="border-danger/30">
            <CardHeader>
              <CardTitle className="text-danger">Danger zone</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-between gap-3">
              <div className="text-[13px] text-fg-muted">
                <p className="font-medium text-fg">Delete this account</p>
                <p>Removes the account, every session, folder, secret and activity record permanently.</p>
              </div>
              <Button variant="danger" size="sm" onClick={() => setDeleteOpen(true)}>
                <Trash2 />
                Delete
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={(open) => {
          setDeleteOpen(open);
          if (!open) {
            setDeletePassword('');
            setDeleteConfirm('');
            setDeleteError(null);
          }
        }}
        title="Delete your account and vault?"
        description="This is permanent. Every encrypted item, folder, session and your account itself will be removed. There is no recovery."
        confirmLabel="Delete everything"
        destructive
        loading={deleteAccount.isPending}
        onConfirm={submitDelete}
      >
        <div className="flex flex-col gap-3">
          <Field>
            <Label htmlFor="delete-confirm">
              Type <span className="font-mono text-danger">DELETE MY VAULT</span> to confirm
            </Label>
            <Input
              id="delete-confirm"
              value={deleteConfirm}
              onChange={(event) => setDeleteConfirm(event.target.value)}
              placeholder="DELETE MY VAULT"
              autoComplete="off"
            />
          </Field>
          <Field>
            <Label htmlFor="delete-password">Your password</Label>
            <PasswordInput
              id="delete-password"
              value={deletePassword}
              onChange={(event) => setDeletePassword(event.target.value)}
              autoComplete="current-password"
            />
            <FieldError>{deleteError}</FieldError>
          </Field>
        </div>
      </ConfirmDialog>
    </div>
  );
}

