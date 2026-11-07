import { Check, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { daysSince } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { AuditReport } from '@/lib/audit';
import type { DashboardResponse, UserDto } from '@/types/api';

interface ChecklistItem {
  label: string;
  done: boolean;
  /** Where to go fix it. */
  to: string;
  hint: string;
}

/**
 * Guided security setup - every item is something the app can actually check.
 * Done items stay visible (with a tick) so the list works as a status panel
 * once setup is finished.
 */
export function SecurityChecklistCard({
  user,
  dashboard,
  report,
}: {
  user: UserDto;
  dashboard: DashboardResponse;
  report: AuditReport | null;
}) {
  const issues = report ? report.weak.length + report.reused.length + report.stale.length : 0;
  const exportAt = dashboard.security.lastExportAt;
  const staleExport = !exportAt || daysSince(exportAt) > 90;

  const items: ChecklistItem[] = [
    {
      label: 'Secrets saved',
      done: dashboard.counts.secrets > 0,
      to: '/vault/new',
      hint: dashboard.counts.secrets > 0 ? `${dashboard.counts.secrets} items` : 'Add your first item',
    },
    {
      label: 'Passwords healthy',
      done: report !== null && issues === 0,
      to: '/audit',
      hint: issues === 0 ? 'No weak, reused or stale items' : `${issues} issue${issues === 1 ? '' : 's'} to fix`,
    },
    {
      label: 'Two-factor sign-in (TOTP)',
      done: user.totpEnabled,
      to: '/security',
      hint: user.totpEnabled ? 'Enabled' : 'Protects account login',
    },
    {
      label: 'Passkey unlock',
      done: dashboard.security.passkeyCount > 0,
      to: '/security',
      hint: dashboard.security.passkeyCount > 0 ? `${dashboard.security.passkeyCount} registered` : 'Unlock with biometrics',
    },
    {
      label: 'Share key published',
      done: user.sharePublicKey !== null,
      to: '/sharing',
      hint: user.sharePublicKey ? 'Sharing & emergency access ready' : 'Needed for sharing',
    },
    {
      label: 'Recent encrypted backup',
      done: !staleExport,
      to: '/vault',
      hint: exportAt ? 'Exported - keep it somewhere safe' : 'Export an encrypted backup',
    },
  ];

  const done = items.filter((item) => item.done).length;
  const percent = Math.round((done / items.length) * 100);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-[15px]">Security checklist</CardTitle>
        <CardDescription>
          {done}/{items.length} done
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div
          className="h-2 w-full overflow-hidden rounded-full bg-surface-muted"
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Security checklist progress"
        >
          <div
            className="h-full rounded-full transition-[width] duration-500"
            style={{
              width: `${percent}%`,
              background: percent === 100 ? 'var(--color-success)' : 'var(--color-primary)',
            }}
          />
        </div>
        <ul className="flex flex-col">
          {items.map((item) => (
            <li key={item.label}>
              <Link
                to={item.to}
                className="group flex items-center gap-2.5 rounded-md px-1 py-1.5 text-[13px] transition-colors hover:bg-surface-muted/70 focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none"
              >
                <span
                  className={cn(
                    'flex size-4.5 shrink-0 items-center justify-center rounded-full border',
                    item.done
                      ? 'border-success/50 bg-success-soft text-success'
                      : 'border-line-strong text-transparent',
                  )}
                  aria-hidden
                >
                  <Check className="size-3" strokeWidth={3} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className={cn('block truncate font-medium', item.done ? 'text-fg-muted' : 'text-fg')}>
                    {item.label}
                  </span>
                  <span className="block truncate text-[11px] text-fg-subtle">{item.hint}</span>
                </span>
                {!item.done ? (
                  <ChevronRight className="size-3.5 shrink-0 text-fg-subtle transition-transform group-hover:translate-x-0.5" />
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
