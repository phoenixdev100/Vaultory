import { motion, useReducedMotion } from 'framer-motion';
import {
  Activity as ActivityIcon,
  ArrowRight,
  CalendarClock,
  Folder,
  KeyRound,
  Paperclip,
  ShieldAlert,
  Star,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { useCurrentUser } from '@/features/auth/auth-context';
import { VaultHealthCard } from '@/features/dashboard/health-card';
import { CategoryDonutCard } from '@/features/dashboard/category-donut';
import { ActivityHeatmapCard } from '@/features/dashboard/heatmap-card';
import { RotationTimelineCard } from '@/features/dashboard/timeline-card';
import { categoryMeta, secretSubtitle } from '@/features/vault/categories';
import { useDashboard, useSecrets } from '@/features/vault/queries';
import { analyzePasswords } from '@/lib/audit';
import { checkPasswordBreached } from '@/lib/breach';
import { collectExpiries, expiryStatusText, EXPIRY_SOON_DAYS } from '@/lib/expiry';
import { ACTIVITY_LABELS } from '@/features/history/activity-labels';
import { formatRelative } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';

function StatCard({ icon: Icon, label, value, to }: { icon: LucideIcon; label: string; value: number; to: string }) {
  return (
    <Link
      to={to}
      className="group flex items-center gap-3 rounded-[var(--radius-card)] border border-line bg-surface p-4 shadow-subtle transition-colors hover:border-line-strong focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none"
    >
      <span className="flex size-9 items-center justify-center rounded-[var(--radius-control)] border border-primary-line bg-primary-soft text-primary">
        <Icon className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-xl font-semibold tracking-tight text-fg tabular-nums">{value}</span>
        <span className="block text-xs text-fg-subtle">{label}</span>
      </span>
      <ArrowRight className="size-4 text-fg-subtle opacity-0 transition-opacity group-hover:opacity-100" />
    </Link>
  );
}

export default function DashboardPage() {
  const user = useCurrentUser();
  const dashboard = useDashboard();
  // Shares the audit page's decrypted list (same query key) so the score
  // costs no extra decryption work.
  const secrets = useSecrets({ limit: 100, sort: 'title' });
  const reduceMotion = useReducedMotion();

  const data = dashboard.data;
  const firstName = user.name?.split(' ')[0] ?? user.email.split('@')[0];
  const audit = useMemo(() => (secrets.data ? analyzePasswords(secrets.data.items) : null), [secrets.data]);

  // Same automatic breach sweep as the audit page - unique values only, and
  // results are cached in lib/breach so both pages share one scan.
  const [breachedValues, setBreachedValues] = useState<Set<string>>(new Set());
  const auditTotal = audit?.total ?? 0;
  useEffect(() => {
    if (!audit || auditTotal === 0) return;
    let cancelled = false;
    const uniqueValues = [...new Set(audit.findings.map((f) => f.value))];
    (async () => {
      const found = new Set<string>();
      for (const value of uniqueValues) {
        const result = await checkPasswordBreached(value);
        if (result.status === 'found') found.add(value);
        if (cancelled) return;
      }
      if (!cancelled) setBreachedValues(found);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auditTotal]);
  const expiries = secrets.data
    ? collectExpiries(secrets.data.items).filter((item) => item.daysLeft <= EXPIRY_SOON_DAYS)
    : [];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={`Welcome back, ${firstName}`}
        description="Your vault is unlocked. Values are decrypted in this browser only."
      />

      {dashboard.isLoading ? (
        <div className="flex flex-col gap-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }, (_, index) => (
              <Skeleton key={index} className="h-[74px] w-full" />
            ))}
          </div>
          <Skeleton className="h-56 w-full" />
        </div>
      ) : !data ? null : (
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="flex flex-col gap-4"
        >
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard icon={KeyRound} label="Secrets" value={data.counts.secrets} to="/vault" />
            <StatCard icon={Star} label="Favorites" value={data.counts.favorites} to="/favorites" />
            <StatCard icon={Folder} label="Folders" value={data.counts.folders} to="/folders" />
            <StatCard icon={Paperclip} label="Attached files" value={data.counts.attachments} to="/vault" />
          </div>

          {data.counts.strandedSecrets > 0 ? (
            <div className="flex items-start gap-2.5 rounded-[var(--radius-card)] border border-warning/40 bg-warning-soft px-4 py-3 text-[13px] leading-5 text-fg">
              <ShieldAlert className="mt-0.5 size-4 shrink-0 text-warning" />
              <p>
                {data.counts.strandedSecrets}{' '}
                {data.counts.strandedSecrets === 1 ? 'item was' : 'items were'} encrypted with a previous vault key
                and can no longer be opened with your current password. This is expected after a password reset.
              </p>
            </div>
          ) : null}

          {expiries.length > 0 ? (
            <Card className="border-warning/40">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-[15px]">
                  <CalendarClock className="size-4 text-warning" />
                  Expiring soon
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ul className="flex flex-col divide-y divide-line">
                  {expiries.slice(0, 5).map((item) => (
                    <li key={`${item.secret.id}:${item.fieldLabel}`}>
                      <Link
                        to={`/vault/${item.secret.id}`}
                        className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-surface-muted/60"
                      >
                        <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-fg">
                          {item.secret.title}
                        </span>
                        <Badge
                          variant={
                            item.status === 'expired'
                              ? 'danger'
                              : item.status === 'critical'
                                ? 'warning'
                                : 'neutral'
                          }
                          size="sm"
                        >
                          {expiryStatusText(item)}
                        </Badge>
                      </Link>
                    </li>
                  ))}
                </ul>
                {expiries.length > 5 ? (
                  <p className="border-t border-line px-4 py-2 text-[12px] text-fg-subtle">
                    + {expiries.length - 5} more - see the vault for the full list.
                  </p>
                ) : null}
              </CardContent>
            </Card>
          ) : null}

          <div className="grid gap-4 lg:grid-cols-2">
            <VaultHealthCard report={audit} breachedValues={breachedValues} />
            <CategoryDonutCard categories={data.categories} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <ActivityHeatmapCard />
            <RotationTimelineCard secrets={secrets.data?.items ?? []} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Recently updated</CardTitle>
                <Button variant="ghost" size="sm" asChild>
                  <Link to="/vault">
                    View all
                    <ArrowRight />
                  </Link>
                </Button>
              </CardHeader>
              <CardContent>
                {data.recentSecrets.length === 0 ? (
                  <EmptyState
                    dense
                    icon={KeyRound}
                    title="Nothing saved yet"
                    description="Your newest secrets will show up here."
                  />
                ) : (
                  <ul className="flex flex-col divide-y divide-line">
                    {data.recentSecrets.map((secret) => {
                      const meta = categoryMeta(secret.category);
                      return (
                        <li key={secret.id}>
                          <Link
                            to={`/vault/${secret.id}`}
                            className="flex items-center gap-3 rounded-md px-1 py-2.5 transition-colors hover:bg-surface-muted/70"
                          >
                            <span
                              className={cn(
                                'flex size-8 shrink-0 items-center justify-center rounded-[var(--radius-control)] border',
                                meta.accent,
                              )}
                            >
                              <meta.icon className="size-4" />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-[13px] font-medium text-fg">{secret.title}</span>
                              <span className="block truncate text-[11px] text-fg-subtle">
                                {secretSubtitle(secret.category, secret.payload) ?? meta.short}
                              </span>
                            </span>
                            <span className="shrink-0 text-[11px] text-fg-subtle">
                              {formatRelative(secret.updatedAt)}
                            </span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </CardContent>
            </Card>

            <div className="flex flex-col gap-4">
              <Card className="flex h-full flex-col">
                <CardHeader>
                  <CardTitle>Latest activity</CardTitle>
                  <Button variant="ghost" size="sm" asChild>
                    <Link to="/activity">
                      View all
                      <ArrowRight />
                    </Link>
                  </Button>
                </CardHeader>
                <CardContent>
                  {data.recentActivity.length === 0 ? (
                    <EmptyState
                      dense
                      icon={ActivityIcon}
                      title="No activity yet"
                      description="Sign-ins, edits and deletions are listed here."
                    />
                  ) : (
                    <ul className="flex flex-col gap-2.5">
                      {data.recentActivity.slice(0, 5).map((event) => (
                        <li key={event.id} className="flex items-center gap-2.5 text-[13px]">
                          <span className="size-1.5 shrink-0 rounded-full bg-primary/70" />
                          <span className="min-w-0 flex-1 truncate text-fg-muted">
                            {ACTIVITY_LABELS[event.type] ?? event.type}
                            {event.targetLabel ? (
                              <span className="text-fg"> · {event.targetLabel}</span>
                            ) : null}
                          </span>
                          <span className="shrink-0 text-[11px] text-fg-subtle">
                            {formatRelative(event.createdAt)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
