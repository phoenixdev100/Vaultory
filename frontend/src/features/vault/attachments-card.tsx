import { Download, FileText, Paperclip, ShieldAlert, Trash2, Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import {
  downloadAttachment,
  useAttachments,
  useDeleteAttachment,
  useUploadAttachment,
} from '@/features/vault/queries';
import { useVault } from '@/features/vault/vault-context';
import { ApiError } from '@/lib/api';
import { formatRelative } from '@/lib/format';
import type { AttachmentDto } from '@/types/api';

/** Plaintext upload budget - the backend enforces the same 2 MiB limit. */
const MAX_ATTACHMENT_BYTES = 2 * 1024 * 1024;

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Encrypted file attachments on a secret: .env files, PEM/PPK keys, keystores,
 * VPN configs. Bytes are AES-256-GCM encrypted in the browser before upload and
 * decrypted in the browser on download - the server only ever stores ciphertext.
 */
export function AttachmentsCard({ secretId }: { secretId: string }) {
  const { decryptFile } = useVault();
  const attachments = useAttachments(secretId);
  const upload = useUploadAttachment(secretId);
  const remove = useDeleteAttachment(secretId);

  const inputRef = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AttachmentDto | null>(null);
  const [dragging, setDragging] = useState(false);

  function pickFile() {
    inputRef.current?.click();
  }

  function attachFile(file: File) {
    if (file.size > MAX_ATTACHMENT_BYTES) {
      toast.error('File is too large', {
        description: `Attachments are limited to ${formatSize(MAX_ATTACHMENT_BYTES)} - "${file.name}" is ${formatSize(file.size)}.`,
      });
      return;
    }

    upload.mutate(file, {
      onSuccess: (attachment) => toast.success(`Attached "${attachment.fileName}" (encrypted)`),
      onError: (error) =>
        toast.error('Upload failed', {
          description: error instanceof ApiError ? error.message : undefined,
        }),
    });
  }

  function handleChosen(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    files.forEach(attachFile);
  }

  // --- drag & drop / paste --------------------------------------------------
  function handleDragEnter(event: React.DragEvent) {
    if (!event.dataTransfer.types.includes('Files')) return;
    event.preventDefault();
    dragDepth.current += 1;
    setDragging(true);
  }

  function handleDragLeave(event: React.DragEvent) {
    if (!event.dataTransfer.types.includes('Files')) return;
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setDragging(false);
  }

  function handleDrop(event: React.DragEvent) {
    if (!event.dataTransfer.types.includes('Files')) return;
    event.preventDefault();
    dragDepth.current = 0;
    setDragging(false);
    Array.from(event.dataTransfer.files).forEach(attachFile);
  }

  function handlePaste(event: React.ClipboardEvent) {
    const files = Array.from(event.clipboardData?.files ?? []);
    if (files.length === 0) return;
    event.preventDefault();
    files.forEach(attachFile);
  }

  async function handleDownload(item: AttachmentDto) {
    setDownloadingId(item.id);
    try {
      const { bytes, fileName, mimeType } = await downloadAttachment(secretId, item.id, decryptFile);
      const url = URL.createObjectURL(new Blob([bytes.buffer as ArrayBuffer], { type: mimeType ?? 'application/octet-stream' }));
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = fileName;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast.error('Could not decrypt that file', {
        description:
          error instanceof ApiError
            ? error.message
            : 'The file may have been encrypted with a previous vault key.',
      });
    } finally {
      setDownloadingId(null);
    }
  }

  function handleDelete() {
    if (!deleteTarget) return;
    remove.mutate(deleteTarget.id, {
      onSuccess: () => toast.success(`Deleted "${deleteTarget.fileName}"`),
      onError: (error) =>
        toast.error('Could not delete that file', {
          description: error instanceof ApiError ? error.message : undefined,
        }),
      onSettled: () => setDeleteTarget(null),
    });
  }

  return (
    <Card
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={(event) => event.preventDefault()}
      onDrop={handleDrop}
      onPaste={handlePaste}
      className={dragging ? 'border-primary ring-2 ring-primary/30' : undefined}
    >
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Paperclip className="size-4 text-fg-subtle" />
          Attached files
        </CardTitle>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={pickFile}
          loading={upload.isPending}
          disabled={upload.isPending}
        >
          <Upload />
          Attach file
        </Button>
      </CardHeader>
      <CardContent>
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          onChange={handleChosen}
          aria-label="Choose a file to attach"
        />

        {attachments.isLoading ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-11 w-full" />
            <Skeleton className="h-11 w-full" />
          </div>
        ) : attachments.data && attachments.data.length > 0 ? (
          <ul className="flex flex-col divide-y divide-line">
            {attachments.data.map((item) => (
              <li key={item.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-[var(--radius-control)] border border-line bg-surface-muted">
                  <FileText className="size-4 text-fg-subtle" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-mono text-[13px] font-medium text-fg">{item.fileName}</p>
                  <p className="text-[11px] text-fg-subtle">
                    {formatSize(item.size)} · {formatRelative(item.createdAt)}
                    {item.keyVersion !== undefined ? ' · encrypted' : ''}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Download ${item.fileName}`}
                  loading={downloadingId === item.id}
                  onClick={() => void handleDownload(item)}
                >
                  <Download />
                </Button>
                <Button
                  type="button"
                  variant="danger-ghost"
                  size="icon-sm"
                  aria-label={`Delete ${item.fileName}`}
                  onClick={() => setDeleteTarget(item)}
                >
                  <Trash2 />
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="flex items-start gap-2.5 text-[13px] leading-5 text-fg-muted">
            <ShieldAlert className="mt-0.5 size-4 shrink-0 text-fg-subtle" />
            <p>
              No files yet. Attach a .env file, PEM/PPK key, keystore or VPN config - it is encrypted in your
              browser before upload, and only you can decrypt it (up to {formatSize(MAX_ATTACHMENT_BYTES)} each).
              You can also drop files onto this card or paste them.
            </p>
          </div>
        )}
      </CardContent>

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title={`Delete "${deleteTarget?.fileName ?? ''}"?`}
        description="The encrypted file is permanently removed. There is no way to recover it."
        confirmLabel="Delete file"
        destructive
        loading={remove.isPending}
        onConfirm={handleDelete}
      />
    </Card>
  );
}
