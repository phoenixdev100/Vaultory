import { ChevronDown } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { AnimatedDialog, DialogContent } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useEmergencyVault, type EmergencySecretDto } from '@/features/emergency/queries';
import { categoryMeta } from '@/features/vault/categories';
import { SecretFields } from '@/features/vault/secret-fields';
import { decryptPayload } from '@/lib/crypto/vault';
import { cn } from '@/lib/utils';
import type { SecretPayload } from '@/types/api';

interface DecryptedRow extends EmergencySecretDto {
  payload: SecretPayload | null;
}

/**
 * Read-only emergency vault view. Decryption happens in-memory with the
 * handover key; nothing is persisted, so locking or closing discards it.
 */
export function EmergencyVaultDialog({
  grantId,
  vaultKey,
  owner,
  open,
  onOpenChange,
}: {
  grantId: string;
  vaultKey: CryptoKey;
  owner: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const vault = useEmergencyVault(open ? grantId : null);
  const [rows, setRows] = useState<DecryptedRow[] | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    const secrets = vault.data?.secrets;
    if (!secrets) return;
    let cancelled = false;
    void Promise.all(
      secrets.map(async (row) => {
        try {
          const payload = await decryptPayload<SecretPayload>(vaultKey, row);
          return { ...row, payload };
        } catch {
          return { ...row, payload: null };
        }
      }),
    ).then((decrypted) => {
      if (!cancelled) setRows(decrypted);
    });
    return () => {
      cancelled = true;
    };
  }, [vault.data, vaultKey]);

  return (
    <AnimatedDialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={`${owner}'s vault`}
        description="Emergency read-only access. Items decrypt only on this device and disappear when you close this window."
        className="sm:max-w-2xl"
      >
        {vault.isLoading || rows === null ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : rows.length === 0 ? (
          <p className="py-6 text-center text-[13px] text-fg-subtle">This vault is empty.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-line">
            {rows.map((row) => {
              const meta = categoryMeta(row.category as never);
              const openRow = expanded === row.id;
              return (
                <li key={row.id}>
                  <button
                    type="button"
                    className="flex w-full items-center gap-3 py-2.5 text-left"
                    onClick={() => setExpanded(openRow ? null : row.id)}
                    disabled={!row.payload}
                  >
                    <span
                      className={`flex size-8 shrink-0 items-center justify-center rounded-[var(--radius-control)] border ${meta.accent}`}
                    >
                      <meta.icon className="size-3.5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-[13px] font-medium text-fg">{row.title}</p>
                        {!row.payload ? (
                          <Badge variant="warning" size="sm">Undecryptable</Badge>
                        ) : null}
                      </div>
                      <p className="truncate text-xs text-fg-subtle">{meta.label}</p>
                    </div>
                    {row.payload ? (
                      <ChevronDown
                        className={cn('size-4 shrink-0 text-fg-subtle transition-transform', openRow && 'rotate-180')}
                      />
                    ) : null}
                  </button>
                  {openRow && row.payload ? (
                    <div className="pb-3 pl-11 pr-1">
                      <SecretFields category={row.category as never} payload={row.payload} />
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </DialogContent>
    </AnimatedDialog>
  );
}
