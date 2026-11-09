import { AlertTriangle, Download } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AnimatedDialog, DialogContent } from '@/components/ui/dialog';
import { FieldHint } from '@/components/ui/input';
import { Field, Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/toggle';
import { envExportValue } from '@/features/vault/categories';
import { useRecordExport } from '@/features/vault/queries';
import { api } from '@/lib/api';
import { serializeEnvFile, toEnvKey } from '@/lib/env-file';
import { BACKUP_FORMAT, BACKUP_VERSION, type VaultBackup } from '@/lib/importers';
import { cn } from '@/lib/utils';
import type { AttachmentDto, DecryptedSecret, FolderDto } from '@/types/api';

type ExportFormat = 'env' | 'backup';

interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  secrets: DecryptedSecret[];
  folders: FolderDto[];
}

function downloadBlob(content: string, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  // Revoke right away: the blob may hold plaintext.
  URL.revokeObjectURL(url);
}

/**
 * Two export shapes: a plaintext `.env` (assembled locally) and an encrypted
 * JSON backup that stores ciphertext exactly as the server holds it - safe to
 * keep anywhere, restorable via Import.
 */
export function ExportDialog({ open, onOpenChange, secrets, folders }: ExportDialogProps) {
  const recordExport = useRecordExport();
  const [format, setFormat] = useState<ExportFormat>('env');
  const [folderId, setFolderId] = useState('all');
  const [selected, setSelected] = useState<Set<string> | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [busy, setBusy] = useState(false);

  const candidates = useMemo(
    () =>
      secrets.filter(
        (secret) =>
          !secret.decryptError &&
          (folderId === 'all' || (folderId === 'none' ? !secret.folderId : secret.folderId === folderId)),
      ),
    [secrets, folderId],
  );

  // null selection = "everything in scope" without tracking every id.
  const isSelected = (id: string) => selected === null || selected.has(id);
  const selectedCount = selected === null ? candidates.length : candidates.filter((s) => selected.has(s.id)).length;

  function toggle(id: string) {
    setSelected((previous) => {
      const base = previous ?? new Set(candidates.map((s) => s.id));
      const next = new Set(base);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function picked(): DecryptedSecret[] {
    return candidates.filter((secret) => isSelected(secret.id));
  }

  function exportEnv() {
    const items = picked();
    if (items.length === 0) return;

    const usedKeys = new Map<string, number>();
    const entries = items.map((secret) => {
      const base = toEnvKey(secret.title);
      const seen = usedKeys.get(base) ?? 0;
      usedKeys.set(base, seen + 1);
      return {
        key: seen === 0 ? base : `${base}_${seen + 1}`,
        value: envExportValue(secret.category, secret.payload),
      };
    });

    downloadBlob(
      serializeEnvFile(entries, { header: `Exported from Vaultory on ${new Date().toISOString()}` }),
      'vaultory-export.env',
      'text/plain',
    );

    recordExport.mutate(items.length);
    toast.success(`Exported ${items.length} ${items.length === 1 ? 'entry' : 'entries'}`);
    close();
  }

  /** Pulls ciphertext rows + attachment blobs into a single encrypted file. */
  async function exportBackup() {
    const items = picked();
    if (items.length === 0) return;
    setBusy(true);

    try {
      const folderNameById = new Map(folders.map((f) => [f.id, f]));
      const usedFolderNames = new Map<string, { name: string; color: string | null }>();

      const backup: VaultBackup = {
        format: BACKUP_FORMAT,
        version: BACKUP_VERSION,
        exportedAt: new Date().toISOString(),
        folders: [],
        secrets: items.map((secret) => {
          const folder = secret.folderId ? (folderNameById.get(secret.folderId) ?? null) : null;
          if (folder) usedFolderNames.set(folder.name, { name: folder.name, color: folder.color });
          return {
            title: secret.title,
            category: secret.category,
            tags: secret.tags,
            isFavorite: secret.isFavorite,
            folder: folder?.name ?? null,
            encVersion: secret.encVersion,
            keyVersion: secret.keyVersion,
            nonce: secret.nonce,
            ciphertext: secret.ciphertext,
          };
        }),
        attachments: [],
      };
      backup.folders = [...usedFolderNames.values()];

      for (let index = 0; index < items.length; index += 1) {
        const secret = items[index]!;
        const list = await api.get<{ items: AttachmentDto[] }>(`/secrets/${secret.id}/attachments`);
        for (const meta of list.items) {
          const { attachment } = await api.get<{ attachment: AttachmentDto & { ciphertext: string } }>(
            `/secrets/${secret.id}/attachments/${meta.id}`,
          );
          backup.attachments.push({
            secretIndex: index,
            fileName: attachment.fileName,
            mimeType: attachment.mimeType,
            size: attachment.size,
            encVersion: attachment.encVersion,
            keyVersion: attachment.keyVersion,
            nonce: attachment.nonce,
            ciphertext: attachment.ciphertext,
          });
        }
      }

      downloadBlob(JSON.stringify(backup, null, 2), 'vaultory-backup.json', 'application/json');
      recordExport.mutate(items.length);
      toast.success(
        `Backed up ${items.length} ${items.length === 1 ? 'item' : 'items'}${backup.attachments.length > 0 ? ` + ${backup.attachments.length} files` : ''}`,
        { description: 'The file contains ciphertext only - it stays encrypted exactly as stored.' },
      );
      close();
    } catch (error) {
      toast.error('Backup failed', { description: error instanceof Error ? error.message : undefined });
    } finally {
      setBusy(false);
    }
  }

  function close() {
    onOpenChange(false);
    setAcknowledged(false);
    setSelected(null);
  }

  const needsAck = format === 'env';

  return (
    <AnimatedDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setAcknowledged(false);
          setSelected(null);
          setFolderId('all');
          setFormat('env');
        }
        onOpenChange(next);
      }}
    >
      <DialogContent
        title="Export your vault"
        description="Everything is assembled in this tab - the server only records that an export happened."
        className="max-w-2xl"
        footer={
          <>
            <p className="mr-auto text-xs text-fg-subtle">
              {selectedCount} of {candidates.length} selected
            </p>
            <Button variant="secondary" size="sm" onClick={close}>
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={selectedCount === 0 || (needsAck && !acknowledged) || busy}
              loading={busy}
              onClick={format === 'env' ? exportEnv : () => void exportBackup()}
            >
              <Download />
              {format === 'env' ? 'Download .env' : 'Download backup'}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <Field>
            <Label htmlFor="export-format">Format</Label>
            <Select value={format} onValueChange={(value) => setFormat(value as ExportFormat)}>
              <SelectTrigger id="export-format">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="backup">Encrypted backup (.json)</SelectItem>
                <SelectItem value="env">Plaintext .env</SelectItem>
              </SelectContent>
            </Select>
            <FieldHint>
              {format === 'env'
                ? "Each item's primary secret value becomes one KEY=value line - unencrypted."
                : 'Ciphertext exactly as stored - safe to keep anywhere, restorable via Import for this account.'}
            </FieldHint>
          </Field>

          {needsAck ? (
            <div className="flex items-start gap-2.5 rounded-[var(--radius-control)] border border-warning/40 bg-warning-soft px-3 py-2.5">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
              <label className="flex cursor-pointer items-start gap-2.5 text-[13px] leading-5 text-fg">
                <Checkbox
                  checked={acknowledged}
                  onCheckedChange={(checked) => setAcknowledged(checked === true)}
                  className="mt-0.5"
                  aria-label="I understand the export contains plaintext secrets"
                />
                The downloaded file contains <strong>unencrypted secrets</strong>. Store it somewhere safe and
                delete it when you are done.
              </label>
            </div>
          ) : null}

          <Field>
            <Label htmlFor="export-scope">Scope</Label>
            <Select value={folderId} onValueChange={setFolderId}>
              <SelectTrigger id="export-scope">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Entire vault</SelectItem>
                <SelectItem value="none">No folder</SelectItem>
                {folders.map((folder) => (
                  <SelectItem key={folder.id} value={folder.id}>
                    {folder.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          {candidates.length === 0 ? (
            <p className="rounded-[var(--radius-control)] border border-line px-3 py-6 text-center text-[13px] text-fg-muted">
              Nothing exportable in this scope.
            </p>
          ) : (
            <ul
              className={cn(
                'flex max-h-64 flex-col divide-y divide-line overflow-y-auto rounded-[var(--radius-control)] border border-line',
              )}
            >
              {candidates.map((secret) => (
                <li key={secret.id} className="flex items-center gap-3 px-3 py-2">
                  <Checkbox
                    checked={isSelected(secret.id)}
                    onCheckedChange={() => toggle(secret.id)}
                    aria-label={`Export ${secret.title}`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium text-fg">{secret.title}</p>
                    <p className="truncate font-mono text-[11px] text-fg-subtle">{toEnvKey(secret.title)}</p>
                  </div>
                  <Badge variant="neutral" size="sm">
                    {secret.category}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </AnimatedDialog>
  );
}
