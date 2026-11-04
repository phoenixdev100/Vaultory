import { motion, useReducedMotion } from 'framer-motion';
import { CalendarClock, Copy, Eye, FolderInput, MoreHorizontal, Pencil, ShieldAlert, Star, Trash2 } from 'lucide-react';
import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip } from '@/components/ui/tooltip';
import { categoryMeta, envExportValue, secretSubtitle } from '@/features/vault/categories';
import { Favicon } from '@/features/vault/favicon';
import { flattenFolderTree, folderPath } from '@/features/folders/tree';
import { collectExpiries, expiryStatusText, EXPIRY_SOON_DAYS, type ExpiringItem } from '@/lib/expiry';
import { formatRelative } from '@/lib/format';
import { cn, copyToClipboard } from '@/lib/utils';
import type { DecryptedSecret, FolderDto } from '@/types/api';
import type { ReactNode } from 'react';

interface SecretGridProps {
  secrets: DecryptedSecret[];
  folders: FolderDto[];
  loading?: boolean;
  empty?: ReactNode;
  onToggleFavorite?: (secret: DecryptedSecret) => void;
  onMove?: (secret: DecryptedSecret, folderId: string | null) => void;
  onDelete?: (secret: DecryptedSecret) => void;
}

/** Card layout alternative to the vault table - same actions, larger targets. */
export function SecretGrid({
  secrets,
  folders,
  loading = false,
  empty,
  onToggleFavorite,
  onMove,
  onDelete,
}: SecretGridProps) {
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();

  const expiryById = useMemo(() => {
    const map = new Map<string, ExpiringItem>();
    for (const item of collectExpiries(secrets)) {
      if (item.daysLeft > EXPIRY_SOON_DAYS) continue;
      const current = map.get(item.secret.id);
      if (!current || item.daysLeft < current.daysLeft) map.set(item.secret.id, item);
    }
    return map;
  }, [secrets]);

  const flatFolders = useMemo(() => flattenFolderTree(folders), [folders]);

  if (loading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton key={index} className="h-28 w-full" />
        ))}
      </div>
    );
  }

  if (secrets.length === 0) return <>{empty}</>;

  const folderById = new Map(folders.map((folder) => [folder.id, folder]));
  const folderLabel = (id: string | null) => {
    const folder = id ? folderById.get(id) : undefined;
    return folder ? folderPath(folder, folderById) : null;
  };

  async function copyPrimary(secret: DecryptedSecret) {
    const value = envExportValue(secret.category, secret.payload);
    if (!value) {
      toast.error('Nothing to copy', { description: 'This item has no primary value set.' });
      return;
    }
    const ok = await copyToClipboard(value);
    toast[ok ? 'success' : 'error'](ok ? 'Copied to clipboard' : 'Your browser blocked clipboard access');
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {secrets.map((secret, index) => {
        const meta = categoryMeta(secret.category);
        const subtitle = secretSubtitle(secret.category, secret.payload);
        const expiry = expiryById.get(secret.id);
        const folder = folderLabel(secret.folderId);

        return (
          <motion.div
            key={secret.id}
            initial={reduceMotion ? false : { opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.16, delay: reduceMotion ? 0 : Math.min(index * 0.02, 0.25) }}
            className="group flex flex-col rounded-[var(--radius-card)] border border-line bg-surface p-4 shadow-subtle transition-colors hover:border-line-strong"
          >
            <div className="flex items-start gap-3">
              <span
                className={cn(
                  'flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-[var(--radius-control)] border',
                  meta.accent,
                )}
              >
                <Favicon url={secret.payload?.fields.url} fallback={<meta.icon className="size-4" />} />
              </span>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <Link
                    to={`/vault/${secret.id}`}
                    className="truncate text-[13px] font-medium text-fg hover:text-primary"
                  >
                    {secret.title}
                  </Link>
                  {secret.isFavorite ? (
                    <Star className="size-3 shrink-0 fill-warning text-warning" aria-label="Favorite" />
                  ) : null}
                  {secret.decryptError ? (
                    <Tooltip content={secret.decryptError}>
                      <ShieldAlert className="size-3.5 shrink-0 text-danger" aria-label="Cannot decrypt" />
                    </Tooltip>
                  ) : null}
                </div>
                <p className="truncate text-[11px] text-fg-subtle">{subtitle ?? meta.short}</p>
              </div>

              <div className="flex shrink-0 items-center gap-0.5">
                {!secret.decryptError ? (
                  <Tooltip content="Copy main value">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 pointer-coarse:opacity-100"
                      onClick={() => void copyPrimary(secret)}
                      aria-label={`Copy main value of ${secret.title}`}
                    >
                      <Copy />
                    </Button>
                  </Tooltip>
                ) : null}

                {onToggleFavorite ? (
                  <Tooltip content={secret.isFavorite ? 'Remove from favorites' : 'Add to favorites'}>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => onToggleFavorite(secret)}
                      aria-label={secret.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                      aria-pressed={secret.isFavorite}
                    >
                      <Star className={cn(secret.isFavorite && 'fill-warning text-warning')} />
                    </Button>
                  </Tooltip>
                ) : null}

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${secret.title}`}>
                      <MoreHorizontal />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem onSelect={() => void navigate(`/vault/${secret.id}`)}>
                      <Eye />
                      View details
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => void navigate(`/vault/${secret.id}/edit`)}>
                      <Pencil />
                      Edit
                    </DropdownMenuItem>

                    {onMove ? (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuLabel>Move to folder</DropdownMenuLabel>
                        <DropdownMenuItem
                          onSelect={() => onMove(secret, null)}
                          className={cn(!secret.folderId && 'text-primary')}
                        >
                          <FolderInput />
                          No folder
                        </DropdownMenuItem>
                        {flatFolders.map(({ folder: f }) => (
                          <DropdownMenuItem
                            key={f.id}
                            onSelect={() => onMove(secret, f.id)}
                            className={cn(secret.folderId === f.id && 'text-primary')}
                          >
                            <FolderInput />
                            {folderPath(f, folderById)}
                          </DropdownMenuItem>
                        ))}
                      </>
                    ) : null}

                    {onDelete ? (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          destructive
                          // Defer past the dropdown's close so its pointerup
                          // cannot dismiss the freshly-mounted dialog as an
                          // "outside press".
                          onSelect={() => window.setTimeout(() => onDelete(secret), 0)}
                        >
                          <Trash2 />
                          Delete
                        </DropdownMenuItem>
                      </>
                    ) : null}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between gap-2 border-t border-line pt-2.5">
              <div className="flex min-w-0 items-center gap-1.5">
                <Badge variant="neutral" size="sm">
                  {meta.short}
                </Badge>
                {folder ? (
                  <span className="truncate text-[11px] text-fg-subtle">{folder}</span>
                ) : null}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {expiry ? (
                  <Tooltip content={`${expiry.fieldLabel}: ${expiry.expiresAt.toLocaleDateString()}`}>
                    <span
                      className={cn(
                        'flex items-center gap-0.5 text-[10px] font-medium',
                        expiry.status === 'expired' ? 'text-danger' : 'text-warning',
                      )}
                    >
                      <CalendarClock className="size-3" />
                      {expiryStatusText(expiry)}
                    </span>
                  </Tooltip>
                ) : null}
                <span className="text-[11px] whitespace-nowrap text-fg-subtle">
                  {formatRelative(secret.updatedAt)}
                </span>
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
