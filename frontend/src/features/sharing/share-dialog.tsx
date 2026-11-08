import { Share2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { AnimatedDialog, DialogContent } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/features/auth/auth-context';
import { useLookupRecipient, useSendShare } from '@/features/sharing/queries';
import { ApiError } from '@/lib/api';
import type { SecretPayload } from '@/types/api';

interface ShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  category: string;
  payload: SecretPayload;
}

export function ShareDialog({ open, onOpenChange, title, category, payload }: ShareDialogProps) {
  const [email, setEmail] = useState('');
  const [expiresInDays, setExpiresInDays] = useState('30');
  const { user } = useAuth();
  const lookup = useLookupRecipient();
  const send = useSendShare();

  const recipient = lookup.data;
  const trimmedEmail = email.trim();
  const isSelf = trimmedEmail !== '' && trimmedEmail.toLowerCase() === user?.email.toLowerCase();

  function handleLookup() {
    if (isSelf) return;
    lookup.mutate(trimmedEmail, {
      onError: (error) =>
        toast.error('Cannot share to that address', {
          description: error instanceof ApiError ? error.message : undefined,
        }),
    });
  }

  function handleSend() {
    send.mutate(
      {
        recipientEmail: trimmedEmail,
        title,
        category,
        payload,
        expiresInDays: Number(expiresInDays),
      },
      {
        onSuccess: () => {
          toast.success(`Shared “${title}” with ${trimmedEmail}`);
          onOpenChange(false);
          setEmail('');
          lookup.reset();
        },
        onError: (error) =>
          toast.error('Could not send the share', {
            description: error instanceof ApiError ? error.message : undefined,
          }),
      },
    );
  }

  return (
    <AnimatedDialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) {
          setEmail('');
          lookup.reset();
        }
      }}
    >
      <DialogContent
        title={`Share “${title}”`}
        description="The item is re-encrypted to the recipient's key in your browser - the server only relays ciphertext. File attachments are not shared."
        footer={
          <>
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button disabled={!recipient} loading={send.isPending} onClick={handleSend}>
              <Share2 />
              Send encrypted copy
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="share-email">Recipient's Vaultory email</Label>
            <div className="flex gap-2">
              <Input
                id="share-email"
                type="email"
                placeholder="friend@example.com"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  lookup.reset();
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && trimmedEmail) handleLookup();
                }}
              />
              <Button
                type="button"
                variant="secondary"
                disabled={!trimmedEmail || isSelf}
                loading={lookup.isPending}
                onClick={handleLookup}
              >
                Look up
              </Button>
            </div>
            {isSelf ? (
              <p className="text-xs text-danger">
                That's your own email - shares have to go to a different Vaultory account.
              </p>
            ) : null}
          </div>

          {recipient ? (
            <>
              <div className="flex items-center gap-2.5 rounded-[var(--radius-control)] border border-line bg-surface-muted/40 px-3 py-2.5">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent">
                  <Share2 className="size-3.5" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-medium text-fg">
                    {recipient.name ?? recipient.email}
                  </p>
                  {recipient.name ? (
                    <p className="truncate text-xs text-fg-subtle">{recipient.email}</p>
                  ) : null}
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="share-expiry">Pending share expires</Label>
                <Select value={expiresInDays} onValueChange={setExpiresInDays}>
                  <SelectTrigger id="share-expiry">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7">After 7 days</SelectItem>
                    <SelectItem value="30">After 30 days</SelectItem>
                    <SelectItem value="90">After 90 days</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          ) : null}
        </div>
      </DialogContent>
    </AnimatedDialog>
  );
}
