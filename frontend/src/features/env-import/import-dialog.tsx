import { FileJson, FileSpreadsheet, FileUp, Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AnimatedDialog, DialogContent } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { FieldHint, Textarea } from '@/components/ui/input';
import { Field, Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/toggle';
import { useImportSecrets, useRestoreBackup } from '@/features/vault/queries';
import { ApiError } from '@/lib/api';
import { parseEnvFile, type EnvParseResult } from '@/lib/env-file';
import { parseBackup, parsePasswordCsv, type ParsedCsv, type VaultBackup } from '@/lib/importers';
import { cn } from '@/lib/utils';
import type { FolderDto } from '@/types/api';

const MAX_FILE_BYTES = 8 * 1024 * 1024;

type ImportFormat = 'env' | 'csv' | 'backup';

const FORMATS: Array<{ value: ImportFormat; label: string; hint: string }> = [
  { value: 'env', label: '.env file', hint: 'KEY=value pairs' },
  { value: 'csv', label: 'Passwords CSV', hint: 'Bitwarden or Chrome export' },
  { value: 'backup', label: 'Vaultory backup', hint: 'Encrypted .json export' },
];

interface ImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  folders: FolderDto[];
  defaultFolderId?: string;
}

/**
 * Import from `.env`, a Bitwarden/Chrome CSV export, or a Vaultory encrypted
 * backup. All parsing happens in the browser - raw files are never uploaded,
 * and backup ciphertext is stored back exactly as it was exported.
 */
export function ImportDialog({ open, onOpenChange, folders, defaultFolderId }: ImportDialogProps) {
  const fileInput = useRef<HTMLInputElement>(null);
  const importSecrets = useImportSecrets();
  const restoreBackup = useRestoreBackup();

  const [format, setFormat] = useState<ImportFormat>('env');
  const [parsed, setParsed] = useState<EnvParseResult | null>(null);
  const [csvParsed, setCsvParsed] = useState<ParsedCsv | null>(null);
  const [backupParsed, setBackupParsed] = useState<VaultBackup | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [fileName, setFileName] = useState<string | null>(null);
  const [folderId, setFolderId] = useState<string>(defaultFolderId ?? 'none');
  const [tooLarge, setTooLarge] = useState(false);

  function reset() {
    setParsed(null);
    setCsvParsed(null);
    setBackupParsed(null);
    setParseError(null);
    setSelected(new Set());
    setFileName(null);
    setTooLarge(false);
    setFolderId(defaultFolderId ?? 'none');
    if (fileInput.current) fileInput.current.value = '';
  }

  function acceptContent(name: string, content: string) {
    setFileName(name);
    setTooLarge(false);
    setParseError(null);

    if (format === 'env') {
      const result = parseEnvFile(content);
      setParsed(result);
      // Pre-select everything that is not a duplicate - the user can opt back in.
      setSelected(new Set(result.entries.map((entry, index) => (entry.duplicate ? -1 : index)).filter((i) => i >= 0)));
      return;
    }

    if (format === 'csv') {
      const result = parsePasswordCsv(content);
      if ('error' in result) {
        setParseError(result.error);
        return;
      }
      setCsvParsed(result);
      setSelected(new Set(result.items.map((_item, index) => index)));
      return;
    }

    const result = parseBackup(content);
    if ('error' in result) {
      setParseError(result.error);
      return;
    }
    setBackupParsed(result);
  }

  async function acceptFile(file: File) {
    if (file.size > MAX_FILE_BYTES) {
      setTooLarge(true);
      return;
    }
    acceptContent(file.name, await file.text());
  }

  function toggle(index: number) {
    setSelected((previous) => {
      const next = new Set(previous);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  function submitEnv() {
    if (!parsed) return;
    const entries = parsed.entries.filter((_entry, index) => selected.has(index));
    if (entries.length === 0) return;

    importSecrets.mutate(
      {
        inputs: entries.map((entry) => ({
          title: entry.key,
          category: 'CUSTOM' as const,
          folderId: folderId === 'none' ? null : folderId,
          tags: ['env-import'],
          payload: { v: 1 as const, fields: {}, custom: [{ key: entry.key, value: entry.value }] },
        })),
        source: 'env-import',
      },
      {
        onSuccess: ({ created }) => {
          toast.success(`Imported ${created} ${created === 1 ? 'secret' : 'secrets'}`, {
            description: 'Each value was encrypted in your browser before saving.',
          });
          onOpenChange(false);
          reset();
        },
        onError: (error) => {
          toast.error('Import failed', { description: error instanceof ApiError ? error.message : undefined });
        },
      },
    );
  }

  function submitCsv() {
    if (!csvParsed) return;
    const inputs = csvParsed.items
      .filter((_item, index) => selected.has(index))
      .map((item) => ({ ...item, folderId: folderId === 'none' ? null : folderId }));
    if (inputs.length === 0) return;

    importSecrets.mutate(
      { inputs, source: 'csv-import' },
      {
        onSuccess: ({ created }) => {
          toast.success(`Imported ${created} ${created === 1 ? 'login' : 'logins'}`, {
            description: 'Each password was encrypted in your browser before saving.',
          });
          onOpenChange(false);
          reset();
        },
        onError: (error) => {
          toast.error('Import failed', { description: error instanceof ApiError ? error.message : undefined });
        },
      },
    );
  }

  function submitBackup() {
    if (!backupParsed) return;
    restoreBackup.mutate(backupParsed, {
      onSuccess: ({ created, attached }) => {
        toast.success(`Restored ${created} ${created === 1 ? 'item' : 'items'}`, {
          description: attached > 0 ? `Plus ${attached} attached ${attached === 1 ? 'file' : 'files'}.` : undefined,
        });
        onOpenChange(false);
        reset();
      },
      onError: (error) => {
        toast.error('Restore failed', { description: error instanceof ApiError ? error.message : undefined });
      },
    });
  }

  const busy = importSecrets.isPending || restoreBackup.isPending;
  const hasParsed = parsed !== null || csvParsed !== null || backupParsed !== null;
  const selectedCount = selected.size;
  const accept =
    format === 'env' ? '.env,text/plain' : format === 'csv' ? '.csv,text/csv,text/plain' : '.json,application/json';

  return (
    <AnimatedDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent
        title="Import into your vault"
        description="Parsing happens locally - the file is never uploaded. Values stay encrypted or become encrypted before saving."
        className="max-w-2xl"
        footer={
          backupParsed ? (
            <>
              <p className="mr-auto text-xs text-fg-subtle">
                {backupParsed.secrets.length} secrets · {backupParsed.folders.length} folders ·{' '}
                {backupParsed.attachments.length} files
              </p>
              <Button variant="secondary" size="sm" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button size="sm" loading={busy} onClick={submitBackup}>
                Restore backup
              </Button>
            </>
          ) : hasParsed ? (
            <>
              <p className="mr-auto text-xs text-fg-subtle">
                {selectedCount > 0 ? `${selectedCount} selected` : 'Select at least one entry'}
              </p>
              <Button variant="secondary" size="sm" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button size="sm" disabled={selectedCount === 0} loading={busy} onClick={format === 'csv' ? submitCsv : submitEnv}>
                Import {selectedCount > 0 ? selectedCount : ''} {selectedCount === 1 ? 'entry' : 'entries'}
              </Button>
            </>
          ) : null
        }
      >
        {!hasParsed ? (
          <div className="flex flex-col gap-4">
            <Field>
              <Label>Format</Label>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                {FORMATS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      setFormat(option.value);
                      setParseError(null);
                      setTooLarge(false);
                      if (fileInput.current) fileInput.current.value = '';
                    }}
                    className={cn(
                      'flex flex-col items-start gap-0.5 rounded-[var(--radius-control)] border px-3 py-2.5 text-left transition-colors',
                      format === option.value
                        ? 'border-primary bg-primary-soft'
                        : 'border-line bg-surface hover:bg-surface-muted',
                    )}
                    aria-pressed={format === option.value}
                  >
                    <span className="text-[13px] font-medium text-fg">{option.label}</span>
                    <span className="text-[11px] text-fg-subtle">{option.hint}</span>
                  </button>
                ))}
              </div>
            </Field>

            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              onDrop={(event) => {
                event.preventDefault();
                const file = event.dataTransfer.files[0];
                if (file) void acceptFile(file);
              }}
              onDragOver={(event) => event.preventDefault()}
              className={cn(
                'flex flex-col items-center justify-center gap-2 rounded-[var(--radius-card)] border border-dashed border-line-strong px-6 py-10 text-center transition-colors',
                'hover:border-primary hover:bg-primary-soft/40 focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none',
              )}
            >
              <Upload className="size-5 text-fg-subtle" />
              <p className="text-[13px] font-medium text-fg">
                Drop a {format === 'env' ? '.env' : format === 'csv' ? 'CSV' : 'backup .json'} file here, or browse
              </p>
              <p className="text-xs text-fg-subtle">Up to 8 MB - processed in this tab only</p>
            </button>
            <input
              ref={fileInput}
              type="file"
              accept={accept}
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void acceptFile(file);
              }}
            />

            {tooLarge ? (
              <p className="text-xs font-medium text-danger">That file is over 8 MB. Trim it and try again.</p>
            ) : null}
            {parseError ? <p className="text-xs font-medium text-danger">{parseError}</p> : null}

            {format === 'env' ? (
              <Field>
                <Label htmlFor="env-paste">Or paste the contents</Label>
                <Textarea
                  id="env-paste"
                  placeholder={'DATABASE_URL=postgres://…\nAPI_KEY="quoted value"\n# comments are ignored'}
                  className="min-h-28 font-mono text-xs"
                  onPaste={(event) => {
                    const text = event.clipboardData.getData('text');
                    if (text.trim() !== '') {
                      event.preventDefault();
                      acceptContent('Pasted contents', text);
                    }
                  }}
                  onChange={(event) => {
                    if (event.target.value.trim() !== '') acceptContent('Pasted contents', event.target.value);
                  }}
                />
                <FieldHint>Paste to parse instantly - nothing leaves this device.</FieldHint>
              </Field>
            ) : null}
          </div>
        ) : backupParsed ? (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="flex items-center gap-2 text-[13px] font-medium text-fg">
                <FileJson className="size-4 text-fg-subtle" />
                {fileName}
              </p>
              <Button variant="ghost" size="sm" onClick={reset}>
                Choose another file
              </Button>
            </div>
            <div className="rounded-[var(--radius-control)] border border-line bg-surface-muted/50 px-4 py-3 text-[13px] leading-6 text-fg-muted">
              <p>
                <strong className="text-fg">{backupParsed.secrets.length} secrets</strong> and{' '}
                <strong className="text-fg">{backupParsed.attachments.length} attached files</strong> across{' '}
                {backupParsed.folders.length} folders, exported {new Date(backupParsed.exportedAt).toLocaleString()}.
              </p>
              <p className="mt-1">
                The backup is ciphertext: items decrypt again only for an account holding the same vault key
                (usually this account - after a reset that rotated keys they may not open).
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="flex items-center gap-2 text-[13px] font-medium text-fg">
                {csvParsed ? <FileSpreadsheet className="size-4 text-fg-subtle" /> : <FileUp className="size-4 text-fg-subtle" />}
                {fileName}
              </p>
              <Button variant="ghost" size="sm" onClick={reset}>
                Choose another file
              </Button>
            </div>

            {parsed && parsed.issues.length > 0 ? (
              <div className="rounded-[var(--radius-control)] border border-warning/40 bg-warning-soft px-3 py-2">
                <p className="text-xs font-medium text-warning">
                  {parsed.issues.length} {parsed.issues.length === 1 ? 'line was' : 'lines were'} skipped:
                </p>
                <ul className="mt-1 flex max-h-24 flex-col gap-0.5 overflow-y-auto text-xs text-fg-muted">
                  {parsed.issues.map((issue, index) => (
                    <li key={index}>
                      Line {issue.line}: {issue.message}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {csvParsed && csvParsed.skipped > 0 ? (
              <p className="rounded-[var(--radius-control)] border border-warning/40 bg-warning-soft px-3 py-2 text-xs font-medium text-warning">
                {csvParsed.skipped} {csvParsed.skipped === 1 ? 'row was' : 'rows were'} skipped (no name or empty login).
              </p>
            ) : null}

            <ul className="flex max-h-72 flex-col divide-y divide-line overflow-y-auto rounded-[var(--radius-control)] border border-line">
              {csvParsed
                ? csvParsed.items.map((item, index) => (
                    <li key={index} className="flex items-center gap-3 px-3 py-2">
                      <Checkbox
                        checked={selected.has(index)}
                        onCheckedChange={() => toggle(index)}
                        aria-label={`Import ${item.title}`}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-medium text-fg">{item.title}</p>
                        <p className="truncate font-mono text-xs text-fg-subtle">
                          {item.payload.fields.username || item.payload.fields.url || '••••••••'}
                        </p>
                      </div>
                      <Badge variant="neutral" size="sm">
                        login
                      </Badge>
                    </li>
                  ))
                : parsed
                  ? parsed.entries.map((entry, index) => (
                      <li key={`${entry.key}-${index}`} className="flex items-center gap-3 px-3 py-2">
                        <Checkbox
                          checked={selected.has(index)}
                          onCheckedChange={() => toggle(index)}
                          aria-label={`Import ${entry.key}`}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="truncate font-mono text-[13px] font-medium text-fg">{entry.key}</p>
                            {entry.duplicate ? (
                              <Badge variant="warning" size="sm">
                                Duplicate
                              </Badge>
                            ) : null}
                          </div>
                          <p className="truncate font-mono text-xs text-fg-subtle">
                            {entry.value === '' ? '(empty value)' : '••••••••'}
                          </p>
                        </div>
                        <span className="shrink-0 text-[11px] text-fg-subtle">line {entry.line}</span>
                      </li>
                    ))
                  : null}
            </ul>

            {parsed && parsed.entries.length === 0 ? (
              <EmptyState
                dense
                icon={FileUp}
                title="No entries found"
                description="The file parsed cleanly but contained no KEY=value lines."
              />
            ) : null}
            {csvParsed && csvParsed.items.length === 0 ? (
              <EmptyState
                dense
                icon={FileSpreadsheet}
                title="No logins found"
                description="The file parsed but every row was empty or skipped."
              />
            ) : null}

            <Field>
              <Label htmlFor="import-folder">Save imported entries into</Label>
              <Select value={folderId} onValueChange={setFolderId}>
                <SelectTrigger id="import-folder">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No folder</SelectItem>
                  {folders.map((folder) => (
                    <SelectItem key={folder.id} value={folder.id}>
                      {folder.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldHint>
                {csvParsed ? 'Each row becomes a Website / App login.' : 'Each entry becomes a custom secret.'}
              </FieldHint>
            </Field>
          </div>
        )}
      </DialogContent>
    </AnimatedDialog>
  );
}
