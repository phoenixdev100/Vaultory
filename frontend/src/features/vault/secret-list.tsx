import { motion, useReducedMotion } from 'framer-motion';
import { CalendarClock, Copy, Eye, FolderInput, MoreHorizontal, Pencil, ShieldAlert, Star, Trash2 } from 'lucide-react';
import { useMemo, type ReactNode } from 'react';
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
import { SkeletonRows } from '@/components/ui/skeleton';
import { Tooltip } from '@/components/ui/tooltip';
import { categoryMeta, envExportValue, secretSubtitle } from '@/features/vault/categories';
import { flattenFolderTree, folderPath } from '@/features/folders/tree';
import { Favicon } from '@/features/vault/favicon';
import { collectExpiries, expiryStatusText, EXPIRY_SOON_DAYS, type ExpiringItem } from '@/lib/expiry';
import { formatRelative } from '@/lib/format';
import { cn, copyToClipboard } from '@/lib/utils';
import type { DecryptedSecret, FolderDto } from '@/types/api';

interface SecretListProps {
  secrets: DecryptedSecret[];
  folders: FolderDto[];
  loading?: boolean;
  empty?: ReactNode;
  onToggleFavorite?: (secret: DecryptedSecret) => void;
  onMove?: (secret: DecryptedSecret, folderId: string | null) => void;
  onDelete?: (secret: DecryptedSecret) => void;
}

export function SecretList({
  secrets,
  folders,
  loading = false,
  empty,
  onToggleFavorite,
  onMove,
  onDelete,
}: SecretListProps) {
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();

  // Worst (nearest) expiry per secret, for the row badge.
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
      <div className="rounded-[var(--radius-card)] border border-line bg-surface p-3">
        <SkeletonRows rows={6} />
      </div>
    );
  }

  if (secrets.length === 0) return <>{empty}</>;

  const folderById = new Map(folders.map((folder) => [folder.id, folder]));
  const folderName = (id: string | null) => {
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
    <div className="overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface shadow-subtle">
      <table className="w-full table-fixed border-collapse text-left">
        <thead className="hidden border-b border-line bg-surface-muted/60 sm:table-header-group">
          <tr className="text-[11px] font-semibold tracking-wide text-fg-subtle uppercase">
            <th scope="col" className="px-4 py-2.5 font-semibold">
              Name
            </th>
            <th scope="col" className="hidden w-28 px-3 py-2.5 font-semibold md:table-cell">
              Category
            </th>
            <th scope="col" className="hidden w-32 px-3 py-2.5 font-semibold lg:table-cell">
              Folder
            </th>
            <th scope="col" className="hidden w-24 px-3 py-2.5 font-semibold sm:table-cell">
              Updated
            </th>
            <th scope="col" className="w-[104px] px-3 py-2.5 text-right font-semibold">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>

        <tbody className="divide-y divide-line">
          {secrets.map((secret, index) => {
            const meta = categoryMeta(secret.category);
            const subtitle = secretSubtitle(secret.category, secret.payload);

            return (
              <motion.tr
                key={secret.id}
                initial={reduceMotion ? false : { opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.16, delay: reduceMotion ? 0 : Math.min(index * 0.015, 0.2) }}
                onClick={(event) => {
                  // Let buttons/links inside the row handle their own clicks, and
                  // ignore portaled UI (dropdown menus, dialogs): React events
                  // bubble through the component tree, so a portal inside the row
                  // still reaches this handler even though it is not a DOM child.
                  const target = event.target as HTMLElement;
                  if (!event.currentTarget.contains(target) || target.closest('a,button')) return;
                  void navigate(`/vault/${secret.id}`);
                }}
                className="group cursor-pointer transition-colors hover:bg-surface-muted/60"
              >
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-3">
                    <span
                      className={cn(
                        'flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-[var(--radius-control)] border',
                        meta.accent,
                      )}
                    >
                      <Favicon url={secret.payload?.fields.url} fallback={<meta.icon className="size-4" />} />
                    </span>

                    <div className="min-w-0">
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
                        {expiryById.has(secret.id) ? (
                          <Tooltip content={`${expiryById.get(secret.id)!.fieldLabel}: ${expiryById.get(secret.id)!.expiresAt.toLocaleDateString()}`}>
                            <span
                              className={cn(
                                'flex shrink-0 items-center gap-0.5 text-[10px] font-medium',
                                expiryById.get(secret.id)!.status === 'expired' ? 'text-danger' : 'text-warning',
                              )}
                            >
                              <CalendarClock className="size-3" />
                              {expiryStatusText(expiryById.get(secret.id)!)}
                            </span>
                          </Tooltip>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px] text-fg-subtle">
                        <span className="truncate">{subtitle ?? meta.short}</span>
                        <span className="sm:hidden">· {formatRelative(secret.updatedAt)}</span>
                      </div>
                    </div>
                  </div>
                </td>

                <td className="hidden px-3 py-2.5 md:table-cell">
                  <Badge variant="neutral" size="sm">
                    {meta.short}
                  </Badge>
                </td>

                <td className="hidden px-3 py-2.5 lg:table-cell">
                  <span className="text-[12px] text-fg-muted">{folderName(secret.folderId) ?? '-'}</span>
                </td>

                <td className="hidden px-3 py-2.5 sm:table-cell">
                  <span className="text-[12px] whitespace-nowrap text-fg-muted">
                    {formatRelative(secret.updatedAt)}
                  </span>
                </td>

                <td className="px-3 py-2.5">
                  <div className="flex items-center justify-end gap-0.5">
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
                            {flatFolders.map(({ folder }) => (
                              <DropdownMenuItem
                                key={folder.id}
                                onSelect={() => onMove(secret, folder.id)}
                                className={cn(secret.folderId === folder.id && 'text-primary')}
                              >
                                <FolderInput />
                                {folderPath(folder, folderById)}
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
                </td>
              </motion.tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
