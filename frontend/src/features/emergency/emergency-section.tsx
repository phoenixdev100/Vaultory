import { Eye, HeartHandshake, Plus, ShieldCheck } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AnimatedDialog, DialogContent } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/features/auth/auth-context';
import {
  useAddEmergencyContact,
  useApproveEmergency,
  useCancelEmergency,
  useClaimEmergencyAccess,
  useEmergencyGrants,
  useRequestEmergencyAccess,
  type EmergencyGrantDto,
} from '@/features/emergency/queries';
import { EmergencyVaultDialog } from '@/features/emergency/vault-viewer';
import { ApiError } from '@/lib/api';
import { formatRelative } from '@/lib/format';

function msg(error: unknown) {
  return error instanceof ApiError ? error.message : undefined;
}

function waitLabel(grant: EmergencyGrantDto) {
  return grant.waitDays === 0 ? 'instant access' : `${grant.waitDays}-day wait`;
}

/** True once the wait has elapsed and the handover can be claimed. */
function waitElapsed(grant: EmergencyGrantDto) {
  return grant.waitUntil !== null && Date.parse(grant.waitUntil) <= Date.now();
}

function statusBadge(grant: EmergencyGrantDto) {
  switch (grant.status) {
    case 'PENDING':
      return <Badge variant="neutral" size="sm">Set up</Badge>;
    case 'WAITING': {
      const left = grant.waitUntil ? Math.max(0, Date.parse(grant.waitUntil) - Date.now()) : 0;
      if (left === 0) return <Badge variant="success" size="sm">Ready</Badge>;
      const days = Math.ceil(left / 86_400_000);
      return <Badge variant="warning" size="sm">{days}d wait left</Badge>;
    }
    case 'APPROVED':
      return <Badge variant="success" size="sm">Access active</Badge>;
    default:
      return <Badge variant="neutral" size="sm">{grant.status}</Badge>;
  }
}

export function EmergencySection({
  addOpen,
  onAddOpenChange,
}: {
  /** Dialog open state - lifted to the page so the header action can open it. */
  addOpen: boolean;
  onAddOpenChange: (open: boolean) => void;
}) {
  const { user } = useAuth();
  const grants = useEmergencyGrants();
  const add = useAddEmergencyContact();
  const requestAccess = useRequestEmergencyAccess();
  const approve = useApproveEmergency();
  const cancel = useCancelEmergency();
  const claim = useClaimEmergencyAccess();
  const [email, setEmail] = useState('');
  const [waitDays, setWaitDays] = useState('7');

  const trimmedEmail = email.trim();
  const isSelf = trimmedEmail !== '' && trimmedEmail.toLowerCase() === user?.email.toLowerCase();
  const [viewer, setViewer] = useState<{ grantId: string; vaultKey: CryptoKey; owner: string } | null>(null);

  const asGrantor = useMemo(() => grants.data?.asGrantor ?? [], [grants.data]);
  const asGrantee = useMemo(() => grants.data?.asGrantee ?? [], [grants.data]);

  function handleAdd() {
    if (isSelf) return;
    add.mutate(
      { email: trimmedEmail, waitDays: Number(waitDays) },
      {
        onSuccess: () => {
          toast.success('Trusted contact added');
          onAddOpenChange(false);
          setEmail('');
        },
        onError: (error) => toast.error('Could not add that contact', { description: msg(error) }),
      },
    );
  }

  function handleOpenVault(grant: EmergencyGrantDto) {
    claim.mutate(grant.id, {
      onSuccess: ({ vaultKey }) =>
        setViewer({ grantId: grant.id, vaultKey, owner: grant.peer?.email ?? 'the owner' }),
      onError: (error) => toast.error('Could not open that vault', { description: msg(error) }),
    });
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-[var(--radius-control)] border border-rose-200/60 bg-rose-500/10 text-rose-500 dark:border-rose-400/20">
              <HeartHandshake className="size-5" />
            </span>
            <div>
              <CardTitle>Emergency access</CardTitle>
              <CardDescription>
                Trusted contacts can request read-only access to your vault after a wait period you
                set. You can cancel any time before access is granted.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {asGrantor.length === 0 ? (
            <div className="flex items-center gap-3 rounded-[var(--radius-control)] border border-dashed border-line px-4 py-3.5">
              <ShieldCheck className="size-4 shrink-0 text-fg-subtle" />
              <p className="text-[13px] text-fg-subtle">
                No trusted contacts yet - use <span className="font-medium text-fg">Add contact</span> above to nominate
                someone you trust.
              </p>
            </div>
          ) : (
            <ul className="flex flex-col divide-y divide-line">
              {asGrantor.map((grant) => (
                <li key={grant.id} className="flex flex-wrap items-center gap-3 py-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-[var(--radius-control)] border border-line bg-surface-muted/40">
                    <HeartHandshake className="size-4 text-fg-muted" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-[13px] font-medium text-fg">{grant.peer?.email}</p>
                      {statusBadge(grant)}
                    </div>
                    <p className="text-xs text-fg-subtle">
                      {waitLabel(grant)}
                      {grant.requestedAt ? ` · requested ${formatRelative(grant.requestedAt)}` : ''}
                    </p>
                  </div>
                  <div className="ml-auto flex shrink-0 items-center gap-1.5">
                    {grant.status === 'WAITING' ? (
                      <Button
                        variant="secondary"
                        size="sm"
                        loading={approve.isPending && approve.variables === grant.id}
                        onClick={() =>
                          approve.mutate(grant.id, {
                            onSuccess: () => toast.success('Access approved'),
                            onError: (e) => toast.error('Could not approve', { description: msg(e) }),
                          })
                        }
                      >
                        <ShieldCheck />
                        Approve now
                      </Button>
                    ) : null}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        cancel.mutate(grant.id, {
                          onSuccess: () => toast.success('Grant removed'),
                          onError: (e) => toast.error('Could not remove', { description: msg(e) }),
                        })
                      }
                    >
                      Remove
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {asGrantee.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>You are a trusted contact</CardTitle>
            <CardDescription>
              Request access; it unlocks once the owner's wait period passes without them cancelling.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <ul className="flex flex-col divide-y divide-line">
              {asGrantee.map((grant) => (
                <li key={grant.id} className="flex flex-wrap items-center gap-3 py-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-[var(--radius-control)] border border-line bg-surface-muted/40">
                    <HeartHandshake className="size-4 text-fg-muted" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-[13px] font-medium text-fg">{grant.peer?.email}</p>
                      {statusBadge(grant)}
                    </div>
                    <p className="text-xs text-fg-subtle">
                      {waitLabel(grant)}
                      {grant.waitUntil && !waitElapsed(grant) ? ` · unlocks ${formatRelative(grant.waitUntil)}` : ''}
                    </p>
                  </div>
                  <div className="ml-auto flex shrink-0 items-center gap-1.5">
                    {grant.status === 'PENDING' ? (
                      <Button
                        size="sm"
                        loading={requestAccess.isPending && requestAccess.variables === grant.id}
                        onClick={() =>
                          requestAccess.mutate(grant.id, {
                            onSuccess: () =>
                              toast.success(
                                grant.waitDays === 0
                                  ? 'Access granted - you can open the vault now'
                                  : `Access requested - ${grant.waitDays}-day wait started`,
                              ),
                            onError: (e) => toast.error('Could not request access', { description: msg(e) }),
                          })
                        }
                      >
                        Request access
                      </Button>
                    ) : null}
                    {grant.status === 'WAITING' && !waitElapsed(grant) ? (
                      <Button variant="ghost" size="sm" disabled>
                        <Eye />
                        Waiting…
                      </Button>
                    ) : null}
                    {grant.status === 'APPROVED' || (grant.status === 'WAITING' && waitElapsed(grant)) ? (
                      <Button
                        size="sm"
                        loading={claim.isPending && claim.variables === grant.id}
                        onClick={() => handleOpenVault(grant)}
                      >
                        <Eye />
                        Open vault
                      </Button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      <AnimatedDialog open={addOpen} onOpenChange={onAddOpenChange}>
        <DialogContent
          title="Add a trusted contact"
          description="Your vault key is wrapped to their key in your browser and released only after the wait period - cancel any time before that."
          footer={
            <>
              <Button variant="ghost" onClick={() => onAddOpenChange(false)}>
                Cancel
              </Button>
              <Button disabled={!trimmedEmail || isSelf} loading={add.isPending} onClick={handleAdd}>
                <Plus />
                Add contact
              </Button>
            </>
          }
        >
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="em-email">Contact's Vaultory email</Label>
              <Input
                id="em-email"
                type="email"
                placeholder="family@example.com"
                value={email}
                aria-invalid={isSelf}
                onChange={(e) => setEmail(e.target.value)}
              />
              {isSelf ? (
                <p className="text-xs text-danger">
                  That's your own email - a trusted contact has to be a different Vaultory account.
                </p>
              ) : null}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="em-wait">Wait period before access</Label>
              <Select value={waitDays} onValueChange={setWaitDays}>
                <SelectTrigger id="em-wait">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">No wait - instant</SelectItem>
                  <SelectItem value="1">1 day</SelectItem>
                  <SelectItem value="3">3 days</SelectItem>
                  <SelectItem value="7">7 days</SelectItem>
                  <SelectItem value="14">14 days</SelectItem>
                  <SelectItem value="30">30 days</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-fg-subtle">
                {waitDays === '0'
                  ? 'They get access the moment they request it - you won\'t get a window to cancel.'
                  : "You'll see the request on this page and can cancel it during the wait."}
              </p>
            </div>
          </div>
        </DialogContent>
      </AnimatedDialog>

      {viewer ? (
        <EmergencyVaultDialog
          grantId={viewer.grantId}
          vaultKey={viewer.vaultKey}
          owner={viewer.owner}
          open
          onOpenChange={(open) => {
            if (!open) setViewer(null);
          }}
        />
      ) : null}
    </>
  );
}
