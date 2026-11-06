import {
  CalendarClock,
  Copy,
  FolderInput,
  History,
  MoreHorizontal,
  Pencil,
  QrCode,
  Share2,
  ShieldAlert,
  Star,
  Trash2,
} from 'lucide-react';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { useFolders } from '@/features/folders/queries';
import { ShareDialog } from '@/features/sharing/share-dialog';
import { AttachmentsCard } from '@/features/vault/attachments-card';
import { categoryMeta, envExportValue, secretSubtitle } from '@/features/vault/categories';
import { Favicon } from '@/features/vault/favicon';
import {
  useDeleteSecret,
  useMoveSecret,
  useSecret,
  useSecretVersions,
  useToggleFavorite,
} from '@/features/vault/queries';
import { passwordRotatedAt } from '@/lib/audit';
import { collectExpiries, expiryStatusText, EXPIRY_SOON_DAYS } from '@/lib/expiry';
import { SecretFields } from '@/features/vault/secret-fields';
import { VersionsDialog } from '@/features/vault/versions-dialog';
import { WifiQrDialog } from '@/features/vault/wifi-qr-dialog';
import { ApiError } from '@/lib/api';
import { formatDateTime, formatRelative } from '@/lib/format';
import { cn, copyToClipboard } from '@/lib/utils';

export default function SecretDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const secret = useSecret(id);
  const versions = useSecretVersions(id);
  const folders = useFolders();
  const toggleFavorite = useToggleFavorite();
  const moveSecret = useMoveSecret();
  const deleteSecret = useDeleteSecret();

  const [versionsOpen, setVersionsOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  if (secret.isLoading) {
    return (
      <div className="flex flex-col gap-5">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }

  if (secret.isError || !secret.data) {
    return (
      <EmptyState
        icon={ShieldAlert}
        title="That item is not available"
        description={
          secret.error instanceof ApiError && secret.error.status === 404
            ? 'It may have been deleted, or the link is wrong.'
            : 'Something went wrong loading this item.'
        }
        action={
          <Button size="sm" variant="secondary" onClick={() => void navigate('/vault')}>
            Back to vault
          </Button>
        }
      />
    );
  }

  const item = secret.data;
  const meta = categoryMeta(item.category);
  const folder = folders.data?.items.find((entry) => entry.id === item.folderId);
  const subtitle = secretSubtitle(item.category, item.payload);
  const itemExpiries = collectExpiries([item]).filter((entry) => entry.daysLeft <= EXPIRY_SOON_DAYS);
  const wifiQr =
    item.category === 'WIFI_VPN' && item.payload?.fields.network && item.payload.fields.password
      ? { ssid: item.payload.fields.network, password: item.payload.fields.password }
      : null;

  async function copyPrimary() {
    const value = envExportValue(item.category, item.payload);
    if (!value) {
      toast.error('Nothing to copy', { description: 'This item has no primary value set.' });
      return;
    }
    const ok = await copyToClipboard(value);
    toast[ok ? 'success' : 'error'](ok ? 'Copied to clipboard' : 'Your browser blocked clipboard access');
  }

  function handleDelete() {
    deleteSecret.mutate(item.id, {
      onSuccess: () => {
        toast.success(`Moved “${item.title}” to the trash`);
        void navigate('/vault');
      },
      onError: (error) => {
        toast.error('Could not delete that item', {
          description: error instanceof ApiError ? error.message : undefined,
        });
      },
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={item.title}
        titleIcon={
          <span
            className={cn(
              'flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-[var(--radius-control)] border',
              meta.accent,
            )}
          >
            <Favicon url={item.payload?.fields.url} fallback={<meta.icon className="size-4" />} />
          </span>
        }
        description={subtitle ? `${meta.label} · ${subtitle}` : meta.label}
        breadcrumbs={[
          { label: 'Vault', to: '/vault' },
          { label: item.title },
        ]}
        actions={
          <>
            {!item.decryptError ? (
              <Button variant="secondary" size="sm" onClick={() => void copyPrimary()}>
                <Copy />
                Copy value
              </Button>
            ) : null}
            {wifiQr ? (
              <Button variant="secondary" size="sm" onClick={() => setQrOpen(true)} aria-label="Show Wi-Fi QR code">
                <QrCode />
                <span className="hidden sm:inline">QR code</span>
              </Button>
            ) : null}
            <Button variant="secondary" size="sm" onClick={() => setVersionsOpen(true)} aria-label="Version history">
              <History />
              <span className="hidden sm:inline">History</span>
            </Button>
            {!item.decryptError ? (
              <Button size="sm" onClick={() => void navigate(`/vault/${item.id}/edit`)}>
                <Pencil />
                Edit
              </Button>
            ) : null}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label="More actions">
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem
                  onSelect={() =>
                    toggleFavorite.mutate(
                      { id: item.id, isFavorite: !item.isFavorite },
                      { onError: () => toast.error('Could not update favorites') },
                    )
                  }
                >
                  <Star className={cn(item.isFavorite && 'fill-warning text-warning')} />
                  {item.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                </DropdownMenuItem>

                <DropdownMenuSeparator />
                <DropdownMenuLabel>Move to folder</DropdownMenuLabel>
                <DropdownMenuItem
                  onSelect={() =>
                    moveSecret.mutate(
                      { id: item.id, folderId: null },
                      { onError: () => toast.error('Could not move that item') },
                    )
                  }
                >
                  <FolderInput />
                  No folder
                </DropdownMenuItem>
                {(folders.data?.items ?? []).map((entry) => (
                  <DropdownMenuItem
                    key={entry.id}
                    onSelect={() =>
                      moveSecret.mutate(
                        { id: item.id, folderId: entry.id },
                        {
                          onSuccess: () => toast.success(`Moved to “${entry.name}”`),
                          onError: () => toast.error('Could not move that item'),
                        },
                      )
                    }
                  >
                    <FolderInput />
                    {entry.name}
                  </DropdownMenuItem>
                ))}

                <DropdownMenuSeparator />
                <DropdownMenuItem
                  disabled={!item.payload || !!item.decryptError}
                  // Defer past the dropdown's close so its pointerup cannot
                  // dismiss the freshly-mounted dialog as an "outside press".
                  onSelect={() => window.setTimeout(() => setShareOpen(true), 0)}
                >
                  <Share2 />
                  Share…
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  destructive
                  onSelect={() => window.setTimeout(() => setDeleteOpen(true), 0)}
                >
                  <Trash2 />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
      />

      {itemExpiries.length > 0 ? (
        <div
          className={cn(
            'flex items-center gap-2.5 rounded-[var(--radius-card)] border px-4 py-3 text-[13px]',
            itemExpiries[0]!.status === 'expired'
              ? 'border-danger/40 bg-danger-soft text-danger'
              : 'border-warning/40 bg-warning-soft text-fg',
          )}
        >
          <CalendarClock className="size-4 shrink-0" />
          <p>
            {itemExpiries[0]!.status === 'expired' ? 'This item has expired' : 'This item expires soon'} -{' '}
            {itemExpiries[0]!.fieldLabel.toLowerCase()} {expiryStatusText(itemExpiries[0]!)} (
            {itemExpiries[0]!.expiresAt.toLocaleDateString()}).
          </p>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
        <div className="flex min-w-0 flex-col gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className={cn('flex size-6 items-center justify-center rounded-md border', meta.accent)}>
                <meta.icon className="size-3.5" />
              </span>
              {meta.label}
            </CardTitle>
            {item.isFavorite ? (
              <Badge variant="warning" size="sm">
                <Star className="fill-warning" />
                Favorite
              </Badge>
            ) : null}
          </CardHeader>
          <CardContent>
            {item.decryptError || !item.payload ? (
              <div className="flex items-start gap-3 rounded-[var(--radius-control)] border border-danger/40 bg-danger-soft px-3 py-3">
                <ShieldAlert className="mt-0.5 size-4 shrink-0 text-danger" />
                <div className="text-[13px] leading-5 text-fg">
                  <p className="font-medium">This item cannot be decrypted</p>
                  <p className="text-fg-muted">
                    {item.decryptError} If you remember the password that was in use when it was created, it can only
                    be recovered by re-encrypting it - otherwise it is safest to delete it.
                  </p>
                </div>
              </div>
            ) : (
              <SecretFields category={item.category} payload={item.payload} />
            )}
          </CardContent>
        </Card>

        {item.decryptError ? null : <AttachmentsCard secretId={item.id} />}
        </div>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="flex flex-col gap-3 text-[13px]">
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-fg-subtle">Folder</dt>
                  <dd className="text-fg">{folder?.name ?? 'No folder'}</dd>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-fg-subtle">Version</dt>
                  <dd className="text-fg">v{item.version}</dd>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-fg-subtle">Created</dt>
                  <dd className="text-fg" title={formatDateTime(item.createdAt)}>
                    {formatRelative(item.createdAt)}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-fg-subtle">Updated</dt>
                  <dd className="text-fg" title={formatDateTime(item.updatedAt)}>
                    {formatRelative(item.updatedAt)}
                  </dd>
                </div>
                {!item.decryptError && versions.data ? (
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-fg-subtle">Password rotated</dt>
                    <dd className="text-right">
                      {(() => {
                        const rotated = passwordRotatedAt(item, versions.data);
                        return (
                          <span className="text-fg" title={formatDateTime(rotated.at)}>
                            {rotated.everRotated ? formatRelative(rotated.at) : 'never'}
                          </span>
                        );
                      })()}
                    </dd>
                  </div>
                ) : null}
              </dl>

              {item.tags.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-1.5 border-t border-line pt-3">
                  {item.tags.map((tag) => (
                    <Badge key={tag} variant="neutral" size="sm">
                      {tag}
                    </Badge>
                  ))}
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card className="border-primary-line/60 bg-primary-soft/30">
            <CardContent className="flex items-start gap-2.5 py-3.5 text-[12px] leading-5 text-fg-muted">
              <History className="mt-0.5 size-4 shrink-0 text-primary" />
              Stored as AES-256-GCM ciphertext. The server only ever sees the encrypted blob - title, category and
              tags stay searchable.
            </CardContent>
          </Card>
        </div>
      </div>

      <VersionsDialog secret={item} open={versionsOpen} onOpenChange={setVersionsOpen} />

      {wifiQr ? (
        <WifiQrDialog ssid={wifiQr.ssid} password={wifiQr.password} open={qrOpen} onOpenChange={setQrOpen} />
      ) : null}
      {item.payload && !item.decryptError ? (
        <ShareDialog
          open={shareOpen}
          onOpenChange={setShareOpen}
          title={item.title}
          category={item.category}
          payload={item.payload}
        />
      ) : null}

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={`Move “${item.title}” to the trash?`}
        description="It stays recoverable for 30 days from the Trash page, together with its version history and attachments. After that it is permanently removed."
        confirmLabel="Move to trash"
        destructive
        loading={deleteSecret.isPending}
        onConfirm={handleDelete}
      />
    </div>
  );
}
