import { ExternalLink } from 'lucide-react';
import { SecretValue } from '@/components/ui/secret-value';
import { categoryMeta } from '@/features/vault/categories';
import type { SecretPayload } from '@/types/api';

interface SecretFieldsProps {
  category: Parameters<typeof categoryMeta>[0];
  payload: SecretPayload;
}

/**
 * Renders a decrypted payload for the detail page: every field gets its own
 * reveal/copy control and masked values start hidden.
 */
export function SecretFields({ category, payload }: SecretFieldsProps) {
  const meta = categoryMeta(category);
  const rows: Array<{ label: string; value: string; masked: boolean; multiline?: boolean; url?: string }> = [];

  for (const field of meta.fields) {
    const value = payload.fields[field.key] ?? '';
    if (field.key === 'notes') continue;
    const isUrl = field.type === 'url' && value !== '';
    rows.push({
      label: field.label,
      value,
      masked: field.masked === true,
      multiline: field.type === 'textarea',
      url: isUrl ? (value.includes('://') ? value : `https://${value}`) : undefined,
    });
  }

  for (const entry of payload.custom ?? []) {
    if (entry.key.trim() === '') continue;
    rows.push({ label: entry.key, value: entry.value, masked: entry.masked !== false });
  }

  return (
    <dl className="flex flex-col gap-4">
      {rows.length === 0 ? (
        <p className="text-[13px] text-fg-subtle italic">This item has no fields.</p>
      ) : null}

      {rows.map((row) => (
        <div key={row.label} className="flex flex-col gap-1.5">
          <dt className="flex items-center justify-between text-xs font-medium tracking-wide text-fg-subtle uppercase">
            {row.label}
            {row.url ? (
              <a
                href={row.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[11px] font-medium normal-case text-primary hover:underline"
              >
                Open
                <ExternalLink className="size-3" />
              </a>
            ) : null}
          </dt>
          <dd>
            <SecretValue
              value={row.value}
              label={row.label}
              masked={row.masked}
              multiline={row.multiline}
              monospace={row.masked || row.multiline === true}
            />
          </dd>
        </div>
      ))}

      {payload.notes ? (
        <div className="flex flex-col gap-1.5 border-t border-line pt-4">
          <dt className="text-xs font-medium tracking-wide text-fg-subtle uppercase">Notes</dt>
          <dd>
            <SecretValue value={payload.notes} label="Notes" masked multiline monospace={false} />
          </dd>
        </div>
      ) : null}
    </dl>
  );
}
