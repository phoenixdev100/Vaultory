import { FileUp, Plus, Star, Trash2, Wand2, X } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { Controller, useFieldArray, useForm, useWatch } from 'react-hook-form';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FieldError, FieldHint, Input, Textarea } from '@/components/ui/input';
import { Field, Label } from '@/components/ui/label';
import { PasswordInput } from '@/components/ui/password-input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/toggle';
import { flattenFolderTree, folderPath } from '@/features/folders/tree';
import { CATEGORY_LIST, categoryMeta, type SecretField } from '@/features/vault/categories';
import { GeneratorDialog } from '@/features/vault/generator-dialog';
import { parseEnvFile } from '@/lib/env-file';
import type { FolderDto, SecretCategory, SecretPayload } from '@/types/api';
import { cn } from '@/lib/utils';

export interface SecretFormValues {
  title: string;
  category: SecretCategory;
  folderId: string;
  isFavorite: boolean;
  tags: string[];
  fields: Record<string, string>;
  custom: Array<{ key: string; value: string }>;
  notes: string;
}

export interface SecretFormSubmit {
  title: string;
  category: SecretCategory;
  folderId: string | null;
  isFavorite: boolean;
  tags: string[];
  payload: SecretPayload;
}

interface SecretFormProps {
  folders: FolderDto[];
  defaultValues?: Partial<SecretFormValues>;
  submitLabel: string;
  pending?: boolean;
  onSubmit: (values: SecretFormSubmit) => void;
  onCancel: () => void;
}

/**
 * One form for every category: the field list comes from the category
 * definition, so adding a category never means touching this component.
 * Every value here ends up inside the encrypted payload.
 */
export function SecretForm({
  folders,
  defaultValues,
  submitLabel,
  pending = false,
  onSubmit,
  onCancel,
}: SecretFormProps) {
  const form = useForm<SecretFormValues>({
    defaultValues: {
      title: '',
      category: 'LOGIN',
      folderId: '',
      isFavorite: false,
      tags: [],
      fields: {},
      custom: [],
      notes: '',
      ...defaultValues,
    },
  });

  const customFields = useFieldArray({ control: form.control, name: 'custom' });
  const [generatorFor, setGeneratorFor] = useState<string | null>(null);
  const [tagDraft, setTagDraft] = useState('');
  const envFileInput = useRef<HTMLInputElement>(null);
  const folderById = useMemo(() => new Map(folders.map((folder) => [folder.id, folder])), [folders]);

  const category = useWatch({ control: form.control, name: 'category' });
  const tags = useWatch({ control: form.control, name: 'tags' });
  const meta = categoryMeta(category);

  /** Loads a .env file into the Variables field - parsed and verified locally. */
  async function importEnvFile(file: File) {
    const content = await file.text();
    const result = parseEnvFile(content);
    if (result.entries.length === 0) {
      toast.error('No KEY=value pairs found in that file.');
      return;
    }
    form.setValue('fields.variables', content.trim(), { shouldDirty: true });

    // Fill empty neighbours: title from the filename, environment from a
    // `.env.<name>` suffix when it matches a known environment.
    const title = form.getValues('title');
    if (title.trim() === '') {
      form.setValue('title', file.name.replace(/^\.?env\.?/i, '').replace(/\.(txt|env)$/i, '') || file.name);
    }
    const suffix = /\.env\.([a-z]+)$/i.exec(file.name)?.[1]?.toLowerCase();
    if (suffix && ['development', 'staging', 'production', 'test', 'local'].includes(suffix)) {
      form.setValue('fields.environment', suffix);
    }

    toast.success(`Loaded ${result.entries.length} variable${result.entries.length === 1 ? '' : 's'}`, {
      description:
        result.issues.length > 0
          ? `${result.issues.length} line${result.issues.length === 1 ? '' : 's'} had issues - check the pasted text.`
          : undefined,
    });
  }

  function addTag() {
    const value = tagDraft.trim().slice(0, 32);
    if (value === '' || tags.includes(value) || tags.length >= 12) {
      setTagDraft('');
      return;
    }
    form.setValue('tags', [...tags, value]);
    setTagDraft('');
  }

  function submit(values: SecretFormValues) {
    // Only keep fields that belong to the selected category, so switching
    // category does not smuggle stale values into the payload.
    const allowed = new Set(meta.fields.map((field) => field.key));
    const fields: Record<string, string> = {};
    for (const [key, value] of Object.entries(values.fields)) {
      if (allowed.has(key) && value !== '' && key !== 'notes') fields[key] = value;
    }

    const custom = values.custom
      .map((entry) => ({ key: entry.key.trim(), value: entry.value }))
      .filter((entry) => entry.key !== '');

    const notes = (values.fields.notes ?? values.notes ?? '').trim();

    onSubmit({
      title: values.title.trim(),
      category: values.category,
      folderId: values.folderId === '' ? null : values.folderId,
      isFavorite: values.isFavorite,
      tags: values.tags,
      payload: {
        v: 1,
        fields,
        ...(custom.length > 0 ? { custom } : {}),
        ...(notes !== '' ? { notes } : {}),
      },
    });
  }

  function renderField(field: SecretField) {
    const id = `field-${field.key}`;
    const registration = form.register(`fields.${field.key}`, {
      required: field.required ? `${field.label} is required` : false,
    });
    const error = form.formState.errors.fields?.[field.key]?.message;

    return (
      <Field key={field.key} className={cn(field.half ? 'sm:col-span-1' : 'sm:col-span-2')}>
        <div className="flex items-center justify-between">
          <Label htmlFor={id}>
            {field.label}
            {field.required ? <span className="text-danger">*</span> : null}
          </Label>
          {field.masked && field.type !== 'textarea' ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 px-1.5 text-[11px]"
              onClick={() => setGeneratorFor(field.key)}
            >
              <Wand2 className="size-3" />
              Generate
            </Button>
          ) : null}
          {category === 'ENV_VARS' && field.key === 'variables' ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 px-1.5 text-[11px]"
              onClick={() => envFileInput.current?.click()}
            >
              <FileUp className="size-3" />
              Import .env
            </Button>
          ) : null}
        </div>

        {field.type === 'textarea' ? (
          <Textarea id={id} placeholder={field.placeholder} className={cn(field.mono && 'font-mono text-xs')} {...registration} />
        ) : field.type === 'select' ? (
          <Controller
            control={form.control}
            name={`fields.${field.key}`}
            render={({ field: controlled }) => (
              <Select value={controlled.value ?? ''} onValueChange={controlled.onChange}>
                <SelectTrigger id={id}>
                  <SelectValue placeholder="Select…" />
                </SelectTrigger>
                <SelectContent>
                  {field.options?.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        ) : field.masked ? (
          <PasswordInput id={id} placeholder={field.placeholder} autoComplete="new-password" {...registration} />
        ) : (
          <Input
            id={id}
            type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
            placeholder={field.placeholder}
            className={cn(field.mono && 'font-mono')}
            {...registration}
          />
        )}

        <FieldError>{error}</FieldError>
      </Field>
    );
  }

  return (
    <form onSubmit={form.handleSubmit(submit)} className="flex flex-col gap-5" noValidate>
      <Card>
        <CardHeader>
          <CardTitle>Item details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field className="sm:col-span-2">
            <Label htmlFor="title">
              Title<span className="text-danger">*</span>
            </Label>
            <Input
              id="title"
              placeholder="GitHub personal account"
              autoFocus
              aria-invalid={form.formState.errors.title ? true : undefined}
              {...form.register('title', { required: 'Give this item a title' })}
            />
            <FieldHint>Titles stay unencrypted so you can search your vault.</FieldHint>
            <FieldError>{form.formState.errors.title?.message}</FieldError>
          </Field>

          <Field>
            <Label htmlFor="category">Category</Label>
            <Controller
              control={form.control}
              name="category"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORY_LIST.map((item) => (
                      <SelectItem key={item.category} value={item.category} icon={<item.icon />}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            <FieldHint>{meta.description}</FieldHint>
          </Field>

          <Field>
            <Label htmlFor="folder">Folder</Label>
            <Controller
              control={form.control}
              name="folderId"
              render={({ field }) => (
                <Select value={field.value === '' ? 'none' : field.value} onValueChange={(value) => field.onChange(value === 'none' ? '' : value)}>
                  <SelectTrigger id="folder">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No folder</SelectItem>
                    {flattenFolderTree(folders).map(({ folder }) => (
                      <SelectItem key={folder.id} value={folder.id}>
                        {folderPath(folder, folderById)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>

          <Field className="sm:col-span-2">
            <Label htmlFor="tags">Tags</Label>
            <div className="flex flex-wrap items-center gap-1.5">
              {tags.map((tag) => (
                <Badge key={tag} variant="neutral" className="gap-1 pr-1">
                  {tag}
                  <button
                    type="button"
                    onClick={() => form.setValue('tags', tags.filter((item) => item !== tag))}
                    className="rounded-full p-0.5 text-fg-subtle transition-colors hover:bg-line hover:text-fg"
                    aria-label={`Remove tag ${tag}`}
                  >
                    <X className="size-3" />
                  </button>
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                id="tags"
                value={tagDraft}
                onChange={(event) => setTagDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ',') {
                    event.preventDefault();
                    addTag();
                  }
                }}
                placeholder="production, personal…"
              />
              <Button type="button" variant="secondary" onClick={addTag} disabled={tagDraft.trim() === ''}>
                Add
              </Button>
            </div>
          </Field>

          <Field className="sm:col-span-2">
            <label className="flex cursor-pointer items-center justify-between gap-3 rounded-[var(--radius-control)] border border-line bg-surface-muted/50 px-3 py-2.5">
              <span className="flex items-center gap-2 text-[13px] font-medium text-fg">
                <Star className="size-4 text-fg-subtle" />
                Add to favorites
              </span>
              <Controller
                control={form.control}
                name="isFavorite"
                render={({ field }) => <Switch checked={field.value} onCheckedChange={field.onChange} />}
              />
            </label>
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span className={cn('flex size-6 items-center justify-center rounded-md border', meta.accent)}>
              <meta.icon className="size-3.5" />
            </span>
            {meta.label}
          </CardTitle>
          <span className="text-[11px] text-fg-subtle">Encrypted before saving</span>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          {meta.warning ? (
            <div className="sm:col-span-2 flex gap-2.5 rounded-[var(--radius-control)] border border-warning/30 bg-warning-soft px-3 py-2.5 text-[12.5px] leading-relaxed text-warning">
              <span className="shrink-0 font-semibold">Warning:</span>
              <span>{meta.warning}</span>
            </div>
          ) : null}
          {meta.fields.map(renderField)}
        </CardContent>
      </Card>

      {meta.supportsCustomFields ? (
        <Card>
          <CardHeader>
            <CardTitle>Custom fields</CardTitle>
            <Button type="button" variant="secondary" size="sm" onClick={() => customFields.append({ key: '', value: '' })}>
              <Plus />
              Add field
            </Button>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {customFields.fields.length === 0 ? (
              <p className="text-[13px] text-fg-muted">No custom fields yet. Add key/value pairs you need.</p>
            ) : null}

            {customFields.fields.map((item, index) => (
              <div key={item.id} className="flex flex-col gap-2 sm:flex-row sm:items-end">
                <Field className="flex-1">
                  <Label htmlFor={`custom-key-${index}`}>Name</Label>
                  <Input id={`custom-key-${index}`} placeholder="WEBHOOK_SECRET" {...form.register(`custom.${index}.key`)} />
                </Field>
                <Field className="flex-1">
                  <Label htmlFor={`custom-value-${index}`}>Value</Label>
                  <PasswordInput id={`custom-value-${index}`} {...form.register(`custom.${index}.value`)} />
                </Field>
                <Button
                  type="button"
                  variant="danger-ghost"
                  size="icon"
                  className="self-end"
                  onClick={() => customFields.remove(index)}
                  aria-label={`Remove custom field ${index + 1}`}
                >
                  <Trash2 />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <div className="flex items-center justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={pending}>
          Cancel
        </Button>
        <Button type="submit" loading={pending}>
          {submitLabel}
        </Button>
      </div>

      <GeneratorDialog
        open={generatorFor !== null}
        onOpenChange={(open) => setGeneratorFor(open ? generatorFor : null)}
        onUse={(value) => {
          if (generatorFor) form.setValue(`fields.${generatorFor}`, value, { shouldDirty: true });
        }}
      />

      <input
        ref={envFileInput}
        type="file"
        accept=".env,.env.*,text/plain"
        className="hidden"
        aria-hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (file) void importEnvFile(file);
        }}
      />
    </form>
  );
}
